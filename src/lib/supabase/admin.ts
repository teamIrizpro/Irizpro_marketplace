// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE env vars for supabaseAdmin client");
}

/**
 * Admin client – uses SERVICE_ROLE key.
 * Only import this inside server-side code (API routes, cron, etc.).
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});
