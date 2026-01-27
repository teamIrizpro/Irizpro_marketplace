/**
 * Create Razorpay Order Route
 * Creates a Razorpay payment order with metadata
 *
 * Security Features:
 * - Rate limiting (10 requests/minute)
 * - Input validation with Zod
 * - Standard error handling
 * - Audit logging
 * - Profile creation if needed
 */

import { NextRequest } from 'next/server';
import Razorpay from 'razorpay';
import { supabaseServer } from '@/lib/supabase/server';
import {
  asyncHandler,
  successResponse,
  AuthenticationError,
  ValidationError,
} from '@/lib/error-handler';
import { createOrderSchema } from '@/lib/validation-schemas';
import { withRateLimit, paymentRateLimiter } from '@/lib/rate-limiter';
import { recordAuditLog } from '@/lib/database-utils';
import {
  PAYMENT,
  ERROR_MESSAGES,
  HTTP_STATUS,
  AUDIT_LOG,
  DATABASE,
} from '@/lib/constants';

export const POST = withRateLimit(
  paymentRateLimiter,
  asyncHandler(async (req: NextRequest) => {
    // 1. Validate environment variables
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('[PAYMENT] Razorpay credentials missing');
      throw new Error('Payment configuration error. Please contact support.');
    }

    // 2. Validate request body
    const validatedData = await req.json().then((data) =>
      createOrderSchema.parse(data)
    );

    const { packageId, amount, credits, currency = 'USD' } = validatedData;

    // 3. Authenticate user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(ERROR_MESSAGES.AUTH.UNAUTHORIZED);
    }

    const userId = user.id;
    const userEmail = user.email ?? '';

    // 4. Ensure user profile exists
    const { data: existingProfile } = await supabase
      .from(DATABASE.TABLES.PROFILES)
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      // Create user profile if it doesn't exist
      const { error: profileError } = await supabase
        .from(DATABASE.TABLES.PROFILES)
        .insert({
          id: userId,
          email: userEmail,
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            userEmail.split('@')[0],
          credits: 0,
          total_spent: 0,
          total_executions: 0,
          membership_tier: 'free',
          is_active: true,
        });

      if (profileError) {
        console.error('[PROFILE] Failed to create profile', profileError);
        throw new Error('Failed to create user profile');
      }

      console.log('[PROFILE] Created new profile', { user_id: userId });
    }

    // 5. Create Razorpay order
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * PAYMENT.PAISE_MULTIPLIER),
      currency: currency,
      receipt: `cp_${Date.now().toString().slice(-8)}`,
      notes: {
        user_id: userId,
        user_email: userEmail,
        package_id: packageId,
        credits: String(credits),
        amount: String(amount),
        currency: currency,
      },
    });

    console.log('[PAYMENT] Razorpay order created', {
      order_id: order.id,
      user_id: userId,
      amount,
      credits,
    });

    // 6. Record audit log
    await recordAuditLog({
      userId,
      action: AUDIT_LOG.ACTION.CREATE,
      resource: AUDIT_LOG.RESOURCE.PAYMENT,
      resourceId: order.id,
      details: {
        order_id: order.id,
        package_id: packageId,
        amount,
        credits,
        currency: currency,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // 7. Return order ID
    return successResponse(
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      HTTP_STATUS.CREATED
    );
  })
);