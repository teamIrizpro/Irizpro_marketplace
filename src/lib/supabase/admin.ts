// src/lib/supabase/admin.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton pattern - only create when accessed
let adminClientInstance: SupabaseClient | null = null;

function getSupabaseAdminInstance(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE environment variables for admin client');
  }

  adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return adminClientInstance;
}

// Export as a Proxy to make it behave like a regular Supabase client
// but initialize lazily on first property access
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabaseAdminInstance();
    const value = client[prop as keyof SupabaseClient];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// Helper function for explicit admin client creation if needed
export function getSupabaseAdmin() {
  return getSupabaseAdminInstance();
}

export default supabaseAdmin;