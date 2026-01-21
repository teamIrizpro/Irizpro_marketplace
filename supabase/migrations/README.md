# Database Migrations

This directory contains SQL migration files for the n8n Marketplace database.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of the migration file
5. Paste and click **Run**
6. Verify success in the results panel

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Initialize Supabase (if first time)
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Apply migration
supabase db push

# Or apply specific migration
supabase db execute --file supabase/migrations/20260121_security_improvements.sql
```

### Option 3: Direct PostgreSQL Connection

```bash
# Using psql
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" < supabase/migrations/20260121_security_improvements.sql

# Or using any PostgreSQL client (DBeaver, pgAdmin, etc.)
```

## Migrations in This Directory

### 20260121_security_improvements.sql

**Purpose:** Security and performance improvements

**Changes:**
- ✅ Adds performance indexes on all tables
- ✅ Creates `audit_logs` table for audit trail
- ✅ Adds soft delete support (`deleted_at` columns)
- ✅ Implements check constraints for data integrity
- ✅ Creates atomic credit operation RPC functions:
  - `deduct_credits_atomic()` - Race-condition-safe credit deduction
  - `add_credits_atomic()` - Safe credit addition
  - `process_payment_atomic()` - Idempotent payment processing
- ✅ Adds unique constraint on `razorpay_payment_id` for idempotency
- ✅ Adds `role` column to profiles for RBAC
- ✅ Creates auto-update triggers for `updated_at` columns

**Safety:** This migration is non-destructive (uses `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`)

**Rollback:** Not needed - migration is additive only

**Required Actions After Migration:**
1. Update your `.env` file if needed
2. Deploy updated API code that uses the new RPC functions
3. Test payment flow thoroughly before processing live transactions

## Testing Migrations

Before applying to production:

1. **Test on Development:**
   ```bash
   # Apply to dev database first
   supabase db push --db-url "postgresql://..."
   ```

2. **Verify Indexes:**
   ```sql
   SELECT schemaname, tablename, indexname
   FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename, indexname;
   ```

3. **Test RPC Functions:**
   ```sql
   -- Test deduct credits
   SELECT deduct_credits_atomic(
     'user-uuid'::uuid,
     10,
     'agent-uuid'::uuid,
     null
   );

   -- Test add credits
   SELECT add_credits_atomic(
     'user-uuid'::uuid,
     100,
     'purchase',
     null
   );
   ```

## Troubleshooting

### Error: "relation already exists"
This is safe to ignore - the migration uses `IF NOT EXISTS`.

### Error: "column already exists"
This is safe to ignore - the migration uses `ADD COLUMN IF NOT EXISTS`.

### Error: "permission denied"
Make sure you're connected as the `postgres` user or have sufficient privileges.

### Error: "function already exists"
The migration uses `CREATE OR REPLACE FUNCTION` which will update existing functions.

## Post-Migration Checklist

After successfully applying migrations:

- [ ] Verify all indexes exist: `\di` in psql
- [ ] Check RPC functions: `\df` in psql
- [ ] Test atomic credit operations
- [ ] Test payment idempotency (try processing same payment twice)
- [ ] Verify audit log table is writable
- [ ] Check that soft deletes work
- [ ] Monitor query performance improvements
- [ ] Update application code to use new RPC functions

## Performance Impact

**Expected improvements:**
- 10-100x faster queries on frequently accessed columns
- No more race conditions in credit operations
- Duplicate payment prevention (saved financial losses)
- Better query performance with proper indexes

**Monitoring:**
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

## Support

If you encounter issues:
1. Check Supabase logs in dashboard
2. Verify database connection
3. Ensure you have sufficient permissions
4. Contact support with specific error messages
