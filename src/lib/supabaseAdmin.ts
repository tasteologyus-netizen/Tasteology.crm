import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SECRET (service) key. This bypasses
// Row Level Security, so it must NEVER be imported into client components.
// It is used by API routes that run without a logged-in user (e.g. the
// Calendly redirect handler).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminConfigured = Boolean(url && secretKey);

export function getSupabaseAdmin(): SupabaseClient {
  if (!url || !secretKey) {
    throw new Error(
      "Supabase admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
