/**
 * Payment Verification Route
 * Verifies Razorpay payment signature and processes payment atomically
 *
 * Security Features:
 * - HMAC signature verification
 * - Idempotency (duplicate payment detection)
 * - Atomic database operations (no race conditions)
 * - Rate limiting (10 requests/minute)
 * - Input validation with Zod
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';
import {
  asyncHandler,
  handleError,
  successResponse,
  PaymentError,
  DuplicateResourceError,
} from '@/lib/error-handler';
import { verifyPaymentSchema } from '@/lib/validation-schemas';
import { withRateLimit, paymentRateLimiter } from '@/lib/rate-limiter';
import { getOrCreateDefaultPackage, recordAuditLog } from '@/lib/database-utils';
import {
  PAYMENT,
  AGENT,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  HTTP_STATUS,
  DATABASE,
  AUDIT_LOG,
} from '@/lib/constants';

export const POST = withRateLimit(
  paymentRateLimiter,
  asyncHandler(async (req: NextRequest) => {
    // 1. Validate request body
    const validatedData = await req.json().then((data) =>
      verifyPaymentSchema.parse(data)
    );

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      packageId,
      amount,
      credits,
    } = validatedData;

    // 2. Authenticate user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new PaymentError(ERROR_MESSAGES.AUTH.UNAUTHORIZED);
    }

    // 3. Verify Razorpay signature (CRITICAL SECURITY CHECK)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('[SECURITY] Invalid Razorpay signature', {
        payment_id: razorpay_payment_id,
        user_id: user.id,
      });

      await recordAuditLog({
        userId: user.id,
        action: AUDIT_LOG.ACTION.PAYMENT,
        resource: AUDIT_LOG.RESOURCE.PAYMENT,
        details: {
          status: 'failed',
          reason: 'invalid_signature',
          payment_id: razorpay_payment_id,
        },
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      });

      throw new PaymentError(ERROR_MESSAGES.PAYMENT.INVALID_SIGNATURE);
    }

    console.log('[PAYMENT] Signature verified successfully', {
      payment_id: razorpay_payment_id,
      user_id: user.id,
    });

    // 4. Handle agent purchase package ID
    let finalPackageId = packageId;
    let agentId: string | null = null;

    if (packageId.startsWith(AGENT.PACKAGE_PREFIX)) {
      agentId = packageId.replace(AGENT.PACKAGE_PREFIX, '');
      finalPackageId = await getOrCreateDefaultPackage(amount, credits);
    }

    // 5. Process payment atomically (includes idempotency check)
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      DATABASE.RPC.PROCESS_PAYMENT_ATOMIC,
      {
        p_user_id: user.id,
        p_package_id: finalPackageId,
        p_razorpay_order_id: razorpay_order_id,
        p_razorpay_payment_id: razorpay_payment_id,
        p_razorpay_signature: razorpay_signature,
        p_amount_paid: Math.round(amount * PAYMENT.PAISE_MULTIPLIER),
        p_credits_purchased: credits,
        p_agent_id: agentId,
      }
    );

    // 6. Check result
    if (rpcError || !result || !result.success) {
      const errorMessage = rpcError?.message || result?.error || 'Unknown error';

      // Check if duplicate payment
      if (errorMessage.includes('already processed')) {
        console.warn('[PAYMENT] Duplicate payment detected', {
          payment_id: razorpay_payment_id,
          user_id: user.id,
        });

        throw new DuplicateResourceError(ERROR_MESSAGES.PAYMENT.DUPLICATE_PAYMENT);
      }

      console.error('[PAYMENT] Processing failed', {
        payment_id: razorpay_payment_id,
        error: errorMessage,
      });

      throw new PaymentError(errorMessage);
    }

    // 7. Log successful payment
    console.log('[PAYMENT] Payment processed successfully', {
      payment_id: razorpay_payment_id,
      user_id: user.id,
      credits_added: credits,
      new_balance: result.new_balance,
      agent_access: agentId ? 'granted' : 'n/a',
    });

    // 8. Record audit log
    await recordAuditLog({
      userId: user.id,
      action: AUDIT_LOG.ACTION.CREDIT_PURCHASE,
      resource: AUDIT_LOG.RESOURCE.PAYMENT,
      resourceId: result.purchase_id,
      details: {
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        credits_purchased: credits,
        amount_paid: amount,
        currency: PAYMENT.DEFAULT_CURRENCY,
        agent_id: agentId,
        new_balance: result.new_balance,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // 9. Return success response
    return successResponse(
      {
        success: true,
        message: SUCCESS_MESSAGES.PAYMENT.VERIFIED,
        data: {
          credits_added: credits,
          new_balance: result.new_balance,
          purchase_id: result.purchase_id,
          agent_access: agentId ? 'granted' : 'n/a',
        },
      },
      HTTP_STATUS.OK
    );
  })
);
