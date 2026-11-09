/**
 * Service-role Supabase client: bypasses RLS. SERVER ONLY. Used by route
 * handlers and scripts, never imported by client components. The secret key
 * has no NEXT_PUBLIC_ prefix, so Next.js never inlines it into browser bundles.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | undefined;

export function adminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("adminClient() must never run in the browser");
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
