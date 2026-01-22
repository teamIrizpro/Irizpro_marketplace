/**
 * Workflow Execution Route
 * Handles workflow execution with atomic credit deduction
 *
 * Security Features:
 * - Atomic credit deduction (no race conditions)
 * - Rate limiting (30 requests/minute)
 * - Input validation with Zod
 * - Audit logging
 * - Agent access verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  asyncHandler,
  successResponse,
  ResourceNotFoundError,
  PaymentError,
  AuthenticationError,
} from '@/lib/error-handler';
import { runWorkflowSchema } from '@/lib/validation-schemas';
import { withRateLimit, workflowRateLimiter } from '@/lib/rate-limiter';
import {
  getAgentById,
  hasUserPurchasedAgent,
  recordExecution,
  updateExecutionResult,
  recordAuditLog,
} from '@/lib/database-utils';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  HTTP_STATUS,
  DATABASE,
  EXECUTION,
  AUDIT_LOG,
  API,
} from '@/lib/constants';

/**
 * Calls n8n workflow with timeout and error handling
 */
async function callN8nWorkflow(
  n8nWorkflowId: string | number,
  inputs: Record<string, unknown>
) {
  const N8N_API_URL = process.env.N8N_API_URL;
  const N8N_API_KEY = process.env.N8N_API_KEY;

  if (!N8N_API_URL || !N8N_API_KEY) {
    throw new Error('N8N configuration is missing');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API.TIMEOUT.N8N_REQUEST);

  try {
    const res = await fetch(
      `${N8N_API_URL}/api/v1/workflows/${n8nWorkflowId}/run`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': N8N_API_KEY,
        },
        body: JSON.stringify({ input: inputs }),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`n8n API error ${res.status}: ${errorText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withRateLimit(
  workflowRateLimiter,
  asyncHandler(async (req: NextRequest) => {
    // 1. Validate request body
    const validatedData = await req.json().then((data) =>
      runWorkflowSchema.parse(data)
    );

    const { agentId, inputs = {} } = validatedData;

    // 2. Authenticate user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(ERROR_MESSAGES.AUTH.UNAUTHORIZED);
    }

    // 3. Get agent details
    const agent = await getAgentById(agentId);

    if (!agent.is_active) {
      throw new ResourceNotFoundError(ERROR_MESSAGES.WORKFLOW.AGENT_INACTIVE);
    }

    // 4. Verify user has purchased this agent
    const hasPurchased = await hasUserPurchasedAgent(user.id, agentId);

    if (!hasPurchased) {
      throw new PaymentError(
        'You must purchase this agent before using it',
        'AGENT_NOT_PURCHASED'
      );
    }

    // 5. Get n8n workflow ID
    const { data: workflow } = await supabase
      .from(DATABASE.TABLES.WORKFLOWS)
      .select('n8n_workflow_id')
      .eq('agent_id', agentId)
      .maybeSingle();

    if (!workflow?.n8n_workflow_id) {
      throw new ResourceNotFoundError('Workflow configuration not found');
    }

    const creditCost = agent.credit_cost || 0;

    // 6. Create execution record (pending status)
    const executionId = await recordExecution({
      userId: user.id,
      agentId: agent.id,
      workflowId: workflow.n8n_workflow_id.toString(),
      inputs,
      credits_used: creditCost,
      status: EXECUTION.STATUS.PENDING,
    });

    // 7. Atomically deduct credits (prevents race conditions)
    const { data: deductResult, error: rpcError } = await supabaseAdmin.rpc(
      DATABASE.RPC.DEDUCT_CREDITS_ATOMIC,
      {
        p_user_id: user.id,
        p_amount: creditCost,
        p_agent_id: agentId,
        p_execution_id: executionId,
      }
    );

    // 8. Check if deduction was successful
    if (rpcError || !deductResult || !deductResult.success) {
      const errorMessage = rpcError?.message || deductResult?.error || 'Unknown error';

      // Update execution with failure
      await updateExecutionResult(
        executionId,
        EXECUTION.STATUS.FAILED,
        null,
        `Credit deduction failed: ${errorMessage}`
      );

      // Check if insufficient credits
      if (errorMessage.includes('Insufficient credits')) {
        throw new PaymentError(
          ERROR_MESSAGES.PAYMENT.INSUFFICIENT_CREDITS,
          'INSUFFICIENT_CREDITS'
        );
      }

      throw new PaymentError(errorMessage);
    }

    console.log('[WORKFLOW] Credits deducted successfully', {
      user_id: user.id,
      agent_id: agentId,
      credits_deducted: creditCost,
      new_balance: deductResult.new_balance,
      execution_id: executionId,
    });

    // 9. Execute n8n workflow
    let workflowResult;
    let executionStatus: string = EXECUTION.STATUS.SUCCESS;
    let executionError: string | undefined;

    try {
      // Update execution status to running
      await updateExecutionResult(
        executionId,
        EXECUTION.STATUS.RUNNING,
        undefined,
        undefined
      );

      workflowResult = await callN8nWorkflow(workflow.n8n_workflow_id, inputs);

      console.log('[WORKFLOW] Execution completed successfully', {
        execution_id: executionId,
        agent_id: agentId,
      });
    } catch (error) {
      executionStatus = EXECUTION.STATUS.FAILED;
      executionError = error instanceof Error ? error.message : 'Unknown error';

      console.error('[WORKFLOW] Execution failed', {
        execution_id: executionId,
        error: executionError,
      });

      // Note: Credits are NOT refunded on failure (by design)
      // You may want to implement a refund policy here
    }

    // 10. Update execution with result
    await updateExecutionResult(
      executionId,
      executionStatus,
      workflowResult,
      executionError
    );

    // 11. Record audit log
    await recordAuditLog({
      userId: user.id,
      action: AUDIT_LOG.ACTION.WORKFLOW_EXECUTION,
      resource: AUDIT_LOG.RESOURCE.WORKFLOW,
      resourceId: executionId,
      details: {
        agent_id: agentId,
        agent_name: agent.name,
        credits_used: creditCost,
        new_balance: deductResult.new_balance,
        status: executionStatus,
        error: executionError,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // 12. Return result
    if (executionStatus === EXECUTION.STATUS.FAILED) {
      throw new Error(
        executionError || ERROR_MESSAGES.WORKFLOW.EXECUTION_FAILED
      );
    }

    return successResponse(
      {
        success: true,
        message: SUCCESS_MESSAGES.WORKFLOW.EXECUTED,
        data: {
          execution_id: executionId,
          result: workflowResult,
          credits_used: creditCost,
          remaining_credits: deductResult.new_balance,
        },
      },
      HTTP_STATUS.OK
    );
  })
);
