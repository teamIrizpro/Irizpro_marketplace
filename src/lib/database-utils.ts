/**
 * Database Utility Functions
 * Common database operations to eliminate code duplication
 */

import { supabaseServer } from './supabase/server';
import { supabaseAdmin } from './supabase/admin';
import { DATABASE, PAYMENT, CREDIT_TRANSACTION } from './constants';
import { ResourceNotFoundError, AppError } from './error-handler';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// USER & PROFILE OPERATIONS
// ============================================

/**
 * Gets user profile with credits
 */
export async function getUserProfile(userId: string, useAdmin = false) {
  const supabase = useAdmin ? supabaseAdmin : await supabaseServer();

  const { data, error } = await supabase
    .from(DATABASE.TABLES.PROFILES)
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new ResourceNotFoundError('User profile');
  }

  return data;
}

/**
 * Checks if user has sufficient credits
 */
export async function hassufficientCredits(
  userId: string,
  requiredCredits: number
): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile.credits >= requiredCredits;
}

/**
 * Gets current user from session
 */
export async function getCurrentUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Requires authenticated user (throws if not authenticated)
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  return user;
}

/**
 * Checks if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile.role === 'admin';
}

/**
 * Requires admin access (throws if not admin)
 */
export async function requireAdmin() {
  const user = await requireAuth();
  const admin = await isAdmin(user.id);

  if (!admin) {
    throw new AppError(403, 'Admin access required', 'ADMIN_REQUIRED');
  }

  return user;
}

// ============================================
// AGENT OPERATIONS
// ============================================

/**
 * Gets agent by ID with validation
 */
export async function getAgentById(agentId: string) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from(DATABASE.TABLES.AGENTS)
    .select('*')
    .eq('id', agentId)
    .single();

  if (error || !data) {
    throw new ResourceNotFoundError('Agent');
  }

  return data;
}

/**
 * Checks if agent is active
 */
export async function isAgentActive(agentId: string): Promise<boolean> {
  const agent = await getAgentById(agentId);
  return agent.is_active;
}

/**
 * Checks if user has purchased an agent
 */
export async function hasUserPurchasedAgent(
  userId: string,
  agentId: string
): Promise<boolean> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from(DATABASE.TABLES.USER_AGENTS)
    .select('id')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .maybeSingle();

  return !!data && !error;
}

/**
 * Grants user access to an agent
 */
export async function grantAgentAccess(userId: string, agentId: string) {
  const supabase = await supabaseServer();

  // Check if already exists
  const exists = await hasUserPurchasedAgent(userId, agentId);
  if (exists) {
    return; // Already has access
  }

  const { error } = await supabase
    .from(DATABASE.TABLES.USER_AGENTS)
    .insert({
      user_id: userId,
      agent_id: agentId,
      purchased_at: new Date().toISOString(),
    });

  if (error) {
    throw new AppError(500, 'Failed to grant agent access', 'DB_ERROR', error);
  }
}

// ============================================
// CREDIT OPERATIONS
// ============================================

/**
 * Records a credit transaction for audit trail
 */
export async function recordCreditTransaction(params: {
  userId: string;
  type: string;
  amount: number;
  description?: string;
  purchaseId?: string;
  executionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin;

  const { error } = await supabase
    .from(DATABASE.TABLES.CREDIT_TRANSACTIONS)
    .insert({
      user_id: params.userId,
      type: params.type,
      amount: params.amount,
      description: params.description,
      purchase_id: params.purchaseId,
      execution_id: params.executionId,
      metadata: params.metadata,
      balance_after: 0, // Will be updated by trigger or RPC
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to record credit transaction:', error);
    // Don't throw - this is audit trail, shouldn't block operations
  }
}

// ============================================
// PAYMENT OPERATIONS
// ============================================

/**
 * Checks if payment ID has already been processed (idempotency check)
 */
export async function isPaymentProcessed(paymentId: string): Promise<boolean> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from(DATABASE.TABLES.CREDIT_PURCHASES)
    .select('id')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();

  return !!data && !error;
}

/**
 * Gets or creates default credit package for agent purchases
 */
export async function getOrCreateDefaultPackage(
  amount: number,
  credits: number
) {
  const supabase = supabaseAdmin;

  // Look for existing default package
  const { data: existingPackage } = await supabase
    .from(DATABASE.TABLES.CREDIT_PACKAGES)
    .select('id')
    .eq('name', 'Agent Purchase Credits')
    .maybeSingle();

  if (existingPackage) {
    return existingPackage.id;
  }

  // Create new default package
  const { data: newPackage, error } = await supabase
    .from(DATABASE.TABLES.CREDIT_PACKAGES)
    .insert({
      name: 'Agent Purchase Credits',
      description: 'Credits for individual agent purchases',
      credits,
      price_inr: Math.round(amount),
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !newPackage) {
    throw new AppError(500, 'Failed to create credit package', 'DB_ERROR', error);
  }

  return newPackage.id;
}

/**
 * Records a credit purchase in the database
 */
export async function recordCreditPurchase(params: {
  userId: string;
  packageId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  amount: number;
  credits: number;
  currency?: string;
}) {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from(DATABASE.TABLES.CREDIT_PURCHASES)
    .insert({
      user_id: params.userId,
      package_id: params.packageId,
      razorpay_order_id: params.orderId,
      razorpay_payment_id: params.paymentId,
      razorpay_signature: params.signature,
      amount_paid: Math.round(params.amount * 100), // in paise
      credits_purchased: params.credits,
      total_credits: params.credits,
      bonus_credits: 0,
      status: PAYMENT.STATUS.PAID,
      currency: params.currency || PAYMENT.DEFAULT_CURRENCY,
      original_amount: params.amount,
      exchange_rate: 1.0,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new AppError(500, 'Failed to record purchase', 'DB_ERROR', error);
  }

  return data.id;
}

// ============================================
// WORKFLOW EXECUTION OPERATIONS
// ============================================

/**
 * Gets workflow execution by ID
 */
export async function getExecutionById(executionId: string) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from(DATABASE.TABLES.EXECUTIONS)
    .select('*')
    .eq('id', executionId)
    .single();

  if (error || !data) {
    throw new ResourceNotFoundError('Execution');
  }

  return data;
}

/**
 * Records a workflow execution
 */
export async function recordExecution(params: {
  userId: string;
  agentId: string;
  workflowId?: string;
  inputs?: Record<string, unknown>;
  credits_used: number;
  status?: string;
}) {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from(DATABASE.TABLES.EXECUTIONS)
    .insert({
      user_id: params.userId,
      agent_id: params.agentId,
      workflow_id: params.workflowId,
      inputs: params.inputs,
      credits_used: params.credits_used,
      status: params.status || 'pending',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new AppError(500, 'Failed to record execution', 'DB_ERROR', error);
  }

  return data.id;
}

/**
 * Updates execution status and result
 */
export async function updateExecutionResult(
  executionId: string,
  status: string,
  result?: unknown,
  error?: string
) {
  const supabase = supabaseAdmin;

  const { error: updateError } = await supabase
    .from(DATABASE.TABLES.EXECUTIONS)
    .update({
      status,
      result,
      error,
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId);

  if (updateError) {
    console.error('Failed to update execution:', updateError);
    // Don't throw - this shouldn't block the response
  }
}

// ============================================
// AUDIT LOG OPERATIONS
// ============================================

/**
 * Records an audit log entry
 */
export async function recordAuditLog(params: {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const supabase = supabaseAdmin;

  const { error } = await supabase
    .from(DATABASE.TABLES.AUDIT_LOGS)
    .insert({
      user_id: params.userId,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId,
      details: params.details,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to record audit log:', error);
    // Don't throw - audit logging shouldn't block operations
  }
}

// ============================================
// TRANSACTION HELPERS
// ============================================

/**
 * Executes multiple operations in a transaction using Supabase RPC
 * Note: Requires RPC functions to be created in Supabase
 */
export async function executeTransaction<T>(
  rpcFunction: string,
  params: Record<string, unknown>
): Promise<T> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase.rpc(rpcFunction, params);

  if (error) {
    throw new AppError(500, `Transaction failed: ${error.message}`, 'TRANSACTION_ERROR', error);
  }

  return data as T;
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Batch insert with error handling
 */
export async function batchInsert<T>(
  table: string,
  records: T[]
): Promise<void> {
  if (records.length === 0) return;

  const supabase = supabaseAdmin;

  // Supabase has a limit on batch size, split if needed
  const BATCH_SIZE = 1000;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { error } = await supabase.from(table).insert(batch);

    if (error) {
      throw new AppError(500, `Batch insert failed: ${error.message}`, 'BATCH_ERROR', error);
    }
  }
}

/**
 * Batch update with error handling
 */
export async function batchUpdate<T extends { id: string }>(
  table: string,
  records: T[]
): Promise<void> {
  if (records.length === 0) return;

  const supabase = supabaseAdmin;

  // Update one by one (Supabase doesn't support batch updates well)
  for (const record of records) {
    const { id, ...updateData } = record;

    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error(`Failed to update record ${id}:`, error);
      // Continue with other records
    }
  }
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Generic pagination helper
 */
export async function paginate<T>(
  query: any,
  page: number = 1,
  limit: number = 20
): Promise<{ data: T[]; total: number; page: number; limit: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query
    .range(from, to)
    .limit(limit);

  if (error) {
    throw new AppError(500, `Query failed: ${error.message}`, 'QUERY_ERROR', error);
  }

  return {
    data: data || [],
    total: count || 0,
    page,
    limit,
  };
}
