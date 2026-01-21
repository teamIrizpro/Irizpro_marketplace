-- ==================================================
-- SECURITY IMPROVEMENTS MIGRATION
-- ==================================================
-- This migration adds:
-- 1. Performance indexes
-- 2. Audit logging table
-- 3. Atomic credit operation RPC functions
-- 4. Payment idempotency constraints
-- 5. Soft delete support
-- 6. Check constraints for data integrity
-- ==================================================

-- ==================================================
-- 1. CREATE INDEXES FOR PERFORMANCE
-- ==================================================

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON profiles(credits);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE role IS NOT NULL;

-- Agents table indexes
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);

-- Credit purchases indexes (CRITICAL for idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_purchases_payment_id
ON credit_purchases(razorpay_payment_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id
ON credit_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_order_id
ON credit_purchases(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_status
ON credit_purchases(status);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_created_at
ON credit_purchases(created_at DESC);

-- Credit transactions indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id
ON credit_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_type
ON credit_transactions(type);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_purchase_id
ON credit_transactions(purchase_id)
WHERE purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at
ON credit_transactions(created_at DESC);

-- User agents indexes
CREATE INDEX IF NOT EXISTS idx_user_agents_user_id
ON user_agents(user_id);

CREATE INDEX IF NOT EXISTS idx_user_agents_agent_id
ON user_agents(agent_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_agents_unique
ON user_agents(user_id, agent_id);

-- Executions indexes
CREATE INDEX IF NOT EXISTS idx_executions_user_id
ON executions(user_id);

CREATE INDEX IF NOT EXISTS idx_executions_agent_id
ON executions(agent_id);

CREATE INDEX IF NOT EXISTS idx_executions_status
ON executions(status);

CREATE INDEX IF NOT EXISTS idx_executions_started_at
ON executions(started_at DESC);

-- ==================================================
-- 2. CREATE AUDIT LOGS TABLE
-- ==================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
ON audit_logs(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
ON audit_logs(resource);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs(created_at DESC);

-- ==================================================
-- 3. ADD SOFT DELETE SUPPORT
-- ==================================================

-- Add deleted_at column to tables (if not exists)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE credit_packages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE executions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Indexes for soft deletes
CREATE INDEX IF NOT EXISTS idx_agents_deleted_at
ON agents(deleted_at)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_credit_packages_deleted_at
ON credit_packages(deleted_at)
WHERE deleted_at IS NULL;

-- ==================================================
-- 4. ADD CHECK CONSTRAINTS
-- ==================================================

-- Ensure credits are never negative
ALTER TABLE profiles
ADD CONSTRAINT IF NOT EXISTS check_profiles_credits_positive
CHECK (credits >= 0);

-- Ensure credit transactions have valid amounts
ALTER TABLE credit_transactions
ADD CONSTRAINT IF NOT EXISTS check_credit_transactions_valid
CHECK (
  (type = 'purchase' AND amount > 0) OR
  (type = 'usage' AND amount < 0) OR
  (type = 'refund' AND amount > 0) OR
  (type = 'bonus' AND amount > 0) OR
  (type = 'adjustment')
);

-- Ensure agents have positive credit costs
ALTER TABLE agents
ADD CONSTRAINT IF NOT EXISTS check_agents_credit_cost_positive
CHECK (credit_cost > 0);

-- ==================================================
-- 5. ATOMIC CREDIT OPERATIONS (RPC FUNCTIONS)
-- ==================================================

-- Function: Atomically deduct credits with balance check
CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_user_id UUID,
  p_amount INTEGER,
  p_agent_id UUID DEFAULT NULL,
  p_execution_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the user row to prevent race conditions
  SELECT credits INTO v_current_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Check if sufficient credits
  IF v_current_credits < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_credits', v_current_credits,
      'required_credits', p_amount
    );
  END IF;

  -- Deduct credits
  v_new_balance := v_current_credits - p_amount;

  UPDATE profiles
  SET credits = v_new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    execution_id,
    created_at
  ) VALUES (
    p_user_id,
    'usage',
    -p_amount,
    v_new_balance,
    p_execution_id,
    NOW()
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_credits,
    'amount_deducted', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function: Atomically add credits
CREATE OR REPLACE FUNCTION add_credits_atomic(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'purchase',
  p_purchase_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the user row
  SELECT credits INTO v_current_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Add credits
  v_new_balance := v_current_credits + p_amount;

  UPDATE profiles
  SET credits = v_new_balance,
      total_spent = COALESCE(total_spent, 0) + (CASE WHEN p_type = 'purchase' THEN p_amount ELSE 0 END),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    purchase_id,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_amount,
    v_new_balance,
    p_purchase_id,
    NOW()
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_credits,
    'amount_added', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function: Process payment atomically (idempotent)
CREATE OR REPLACE FUNCTION process_payment_atomic(
  p_user_id UUID,
  p_package_id UUID,
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature TEXT,
  p_amount_paid INTEGER,
  p_credits_purchased INTEGER,
  p_agent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_id UUID;
  v_credit_result JSONB;
  v_existing_purchase UUID;
BEGIN
  -- Check for duplicate payment (idempotency)
  SELECT id INTO v_existing_purchase
  FROM credit_purchases
  WHERE razorpay_payment_id = p_razorpay_payment_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment already processed',
      'purchase_id', v_existing_purchase
    );
  END IF;

  -- Insert credit purchase record
  INSERT INTO credit_purchases (
    user_id,
    package_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount_paid,
    credits_purchased,
    total_credits,
    bonus_credits,
    status,
    currency,
    created_at
  ) VALUES (
    p_user_id,
    p_package_id,
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_razorpay_signature,
    p_amount_paid,
    p_credits_purchased,
    p_credits_purchased,
    0,
    'paid',
    'INR',
    NOW()
  ) RETURNING id INTO v_purchase_id;

  -- Add credits to user atomically
  SELECT add_credits_atomic(
    p_user_id,
    p_credits_purchased,
    'purchase',
    v_purchase_id
  ) INTO v_credit_result;

  -- Check if credit addition was successful
  IF (v_credit_result->>'success')::boolean = false THEN
    RAISE EXCEPTION 'Failed to add credits: %', v_credit_result->>'error';
  END IF;

  -- Grant agent access if agent_id provided
  IF p_agent_id IS NOT NULL THEN
    INSERT INTO user_agents (user_id, agent_id, purchased_at)
    VALUES (p_user_id, p_agent_id, NOW())
    ON CONFLICT (user_id, agent_id) DO NOTHING;
  END IF;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'credits_added', p_credits_purchased,
    'new_balance', (v_credit_result->>'new_balance')::integer
  );
END;
$$;

-- ==================================================
-- 6. ADD ROLE COLUMN TO PROFILES (if not exists)
-- ==================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create index for role
CREATE INDEX IF NOT EXISTS idx_profiles_role
ON profiles(role)
WHERE role IS NOT NULL;

-- ==================================================
-- 7. ADD MISSING COLUMNS
-- ==================================================

-- Add balance_after to credit_transactions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_transactions' AND column_name = 'balance_after'
  ) THEN
    ALTER TABLE credit_transactions ADD COLUMN balance_after INTEGER DEFAULT 0;
  END IF;
END $$;

-- ==================================================
-- 8. GRANT PERMISSIONS
-- ==================================================

-- Grant execute permissions on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION deduct_credits_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION process_payment_atomic TO authenticated;

-- Grant permissions on audit_logs table
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT ALL ON audit_logs TO service_role;

-- ==================================================
-- 9. CREATE TRIGGERS FOR AUTO-TIMESTAMPS
-- ==================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to tables (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_agents_updated_at'
  ) THEN
    CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ==================================================
-- MIGRATION COMPLETE
-- ==================================================

-- Insert migration record
INSERT INTO _migrations (name, executed_at)
VALUES ('20260121_security_improvements', NOW())
ON CONFLICT DO NOTHING;

-- Create migrations tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE _migrations IS 'Tracks which migrations have been executed';
