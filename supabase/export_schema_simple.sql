-- ============================================
-- SIMPLE SUPABASE SCHEMA EXPORT
-- ============================================
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- After running, copy ALL the results and share them
-- ============================================

-- 1. LIST ALL TABLES
SELECT '=== TABLES ===' as info;
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. ALL COLUMNS WITH DETAILS
SELECT '=== COLUMNS ===' as info;
SELECT
  table_name || '.' || column_name as full_column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. ALL INDEXES
SELECT '=== INDEXES ===' as info;
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 4. ALL CONSTRAINTS
SELECT '=== CONSTRAINTS ===' as info;
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  COALESCE(kcu.column_name, '') as column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- 5. ALL FOREIGN KEY RELATIONSHIPS
SELECT '=== FOREIGN_KEYS ===' as info;
SELECT
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 6. ALL FUNCTIONS (RPC)
SELECT '=== FUNCTIONS ===' as info;
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;

-- 7. CHECK IF SPECIFIC TABLES EXIST
SELECT '=== TABLE_EXISTENCE_CHECK ===' as info;
SELECT
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') as has_profiles,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') as has_agents,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_purchases') as has_credit_purchases,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_transactions') as has_credit_transactions,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_agents') as has_user_agents,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'executions') as has_executions,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflows') as has_workflows,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_packages') as has_credit_packages,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') as has_audit_logs;

-- 8. CHECK EXISTING COLUMNS
SELECT '=== COLUMN_EXISTENCE_CHECK ===' as info;
SELECT
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'credits') as profiles_has_credits,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') as profiles_has_role,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'total_spent') as profiles_has_total_spent,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'deleted_at') as agents_has_deleted_at,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'balance_after') as credit_transactions_has_balance_after;

-- 9. CHECK EXISTING INDEXES
SELECT '=== INDEX_EXISTENCE_CHECK ===' as info;
SELECT
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_credits') as has_idx_profiles_credits,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_credit_purchases_payment_id') as has_idx_credit_purchases_payment_id,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_agents_unique') as has_idx_user_agents_unique;

-- 10. CHECK EXISTING FUNCTIONS
SELECT '=== FUNCTION_EXISTENCE_CHECK ===' as info;
SELECT
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'deduct_credits_atomic') as has_deduct_credits_atomic,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'add_credits_atomic') as has_add_credits_atomic,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'process_payment_atomic') as has_process_payment_atomic;

-- 11. POSTGRESQL VERSION
SELECT '=== VERSION ===' as info;
SELECT version() as postgresql_version;

-- DONE
SELECT '=== EXPORT_COMPLETE ===' as info, NOW() as timestamp;
