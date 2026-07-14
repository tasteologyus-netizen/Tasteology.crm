"use client";

import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function SetupBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-semibold">Connect your Supabase database to get started</p>
      <p className="mt-1 text-amber-700">
        Create a file named{" "}
        <code className="rounded bg-amber-100 px-1">.env.local</code> in the
        project root with your{" "}
        <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="rounded bg-amber-100 px-1">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>
        , then run the SQL in{" "}
        <code className="rounded bg-amber-100 px-1">supabase/schema.sql</code>.
        See the README for step-by-step instructions.
      </p>
    </div>
  );
}
