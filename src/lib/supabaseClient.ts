import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// A single shared browser client. If env vars are missing we still create a
// dummy client so imports don't crash; the UI shows a setup banner instead.
export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "public-anon-placeholder-key"
);
