-- ==================================================
-- COMPATIBLE MIGRATION FOR POSTGRESQL 17.6
-- ==================================================
-- This migration is compatible with your existing database
-- It only adds what's missing without duplicating existing structures
-- ==================================================

-- ==================================================
-- 1. ADD MISSING COLUMNS
-- ==================================================

-- Add role column to profiles (for RBAC)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
    CREATE INDEX idx_profiles_role ON profiles(role) WHERE role IS NOT NULL;
  END IF;
END $$;

-- Add deleted_at to agents (soft delete support)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE agents ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    CREATE INDEX idx_agents_deleted_at ON agents(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Add deleted_at to credit_packages (soft delete support)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_packages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE credit_packages ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    CREATE INDEX idx_credit_packages_deleted_at ON credit_packages(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Add balance_after to credit_transactions (for tracking)
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ==================================================
-- 3. ADD MISSING INDEXES (ONLY IF NOT EXISTS)
-- ==================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON profiles(credits);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Agents indexes
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);

-- Credit transactions indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- User agents indexes
CREATE INDEX IF NOT EXISTS idx_user_agents_user_id ON user_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agents_agent_id ON user_agents(agent_id);

-- Agent executions indexes (your table is called agent_executions, not executions)
CREATE INDEX IF NOT EXISTS idx_agent_executions_user_id ON agent_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);

-- ==================================================
-- 4. ATOMIC CREDIT OPERATIONS (RPC FUNCTIONS)
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
  v_current_total_spent NUMERIC;
BEGIN
  -- Lock the user row
  SELECT credits, COALESCE(total_spent, 0) INTO v_current_credits, v_current_total_spent
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
      total_spent = v_current_total_spent + (CASE WHEN p_type = 'purchase' THEN p_amount ELSE 0 END),
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
-- 5. GRANT PERMISSIONS
-- ==================================================

-- Grant execute permissions on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION deduct_credits_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION process_payment_atomic TO authenticated;

-- Grant permissions on audit_logs table
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT ALL ON audit_logs TO service_role;

-- ==================================================
-- 6. CREATE TRIGGERS FOR AUTO-TIMESTAMPS
-- ==================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to profiles (if not exists)
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
END $$;

-- Add trigger to agents (if not exists)
DO $$
BEGIN
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
-- 7. CREATE UNIQUE CONSTRAINT ON USER_AGENTS
-- ==================================================

-- This prevents duplicate agent purchases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_agents_user_id_agent_id_key'
  ) THEN
    ALTER TABLE user_agents
    ADD CONSTRAINT user_agents_user_id_agent_id_key
    UNIQUE (user_id, agent_id);
  END IF;
END $$;

-- ==================================================
-- MIGRATION COMPLETE
-- ==================================================

SELECT 'MIGRATION COMPLETED SUCCESSFULLY' as status, NOW() as timestamp;

-- Verify RPC functions were created
SELECT 'RPC Functions Created:' as info,
  COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('deduct_credits_atomic', 'add_credits_atomic', 'process_payment_atomic');

-- Verify audit_logs table was created
SELECT 'Audit Logs Table:' as info,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'audit_logs'
  ) THEN 'Created' ELSE 'Failed' END as status;

-- Verify new indexes
SELECT 'New Indexes:' as info,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';
