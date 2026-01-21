-- ============================================
-- SUPABASE DATABASE SCHEMA EXPORT SCRIPT
-- ============================================
-- Run this script in Supabase SQL Editor to get complete database information
-- Copy the results and share them for detailed analysis
-- ============================================

-- Enable expanded display for better readability
\x on

-- ============================================
-- 1. DATABASE VERSION & INFO
-- ============================================
SELECT
  'DATABASE INFO' as section,
  version() as postgresql_version,
  current_database() as database_name,
  current_schema() as current_schema;

-- ============================================
-- 2. ALL TABLES IN PUBLIC SCHEMA
-- ============================================
SELECT
  'TABLES' as section,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- 3. DETAILED COLUMN INFORMATION
-- ============================================
SELECT
  'COLUMNS' as section,
  table_name,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================
-- 4. PRIMARY KEYS
-- ============================================
SELECT
  'PRIMARY_KEYS' as section,
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================
-- 5. FOREIGN KEYS (RELATIONSHIPS)
-- ============================================
SELECT
  'FOREIGN_KEYS' as section,
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================
-- 6. UNIQUE CONSTRAINTS
-- ============================================
SELECT
  'UNIQUE_CONSTRAINTS' as section,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================
-- 7. CHECK CONSTRAINTS
-- ============================================
SELECT
  'CHECK_CONSTRAINTS' as section,
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
  AND tc.table_schema = cc.constraint_schema
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================
-- 8. INDEXES
-- ============================================
SELECT
  'INDEXES' as section,
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- 9. FUNCTIONS (RPC FUNCTIONS)
-- ============================================
SELECT
  'FUNCTIONS' as section,
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- regular functions (not aggregates or window functions)
ORDER BY p.proname;

-- ============================================
-- 10. TRIGGERS
-- ============================================
SELECT
  'TRIGGERS' as section,
  event_object_table as table_name,
  trigger_name,
  event_manipulation as event,
  action_timing as timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 11. VIEWS
-- ============================================
SELECT
  'VIEWS' as section,
  table_name as view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- 12. TABLE ROW COUNTS (SAMPLE DATA)
-- ============================================
-- This will show how many records are in each table

DO $$
DECLARE
  tbl_name text;
  row_count bigint;
BEGIN
  RAISE NOTICE 'TABLE_ROW_COUNTS';
  FOR tbl_name IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', tbl_name) INTO row_count;
    RAISE NOTICE 'Table: %, Rows: %', tbl_name, row_count;
  END LOOP;
END $$;

-- ============================================
-- 13. STORAGE/ROLE POLICIES (RLS)
-- ============================================
SELECT
  'RLS_POLICIES' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- 14. SEQUENCES
-- ============================================
SELECT
  'SEQUENCES' as section,
  sequence_schema,
  sequence_name,
  data_type,
  start_value,
  minimum_value,
  maximum_value,
  increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- ============================================
-- 15. TABLE SIZES (STORAGE)
-- ============================================
SELECT
  'TABLE_SIZES' as section,
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- END OF SCHEMA EXPORT
-- ============================================

SELECT 'EXPORT_COMPLETE' as status, NOW() as timestamp;
