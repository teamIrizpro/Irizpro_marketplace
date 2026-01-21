-- ============================================
-- QUICK DATABASE CHECK
-- ============================================
-- Just run this and share the output!
-- This is the SIMPLEST version
-- ============================================

-- 1. What version of PostgreSQL?
SELECT version();

-- 2. What tables do you have?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 3. Show me the profiles table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Show me the credit_purchases table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'credit_purchases'
ORDER BY ordinal_position;

-- 5. Show me the credit_transactions table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'credit_transactions'
ORDER BY ordinal_position;

-- 6. What indexes exist on credit_purchases?
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'credit_purchases';

-- 7. What constraints exist on profiles?
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'profiles' AND table_schema = 'public';

-- 8. Do these RPC functions already exist?
SELECT proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname IN ('deduct_credits_atomic', 'add_credits_atomic', 'process_payment_atomic');

-- DONE! Copy all the output above and share it.
