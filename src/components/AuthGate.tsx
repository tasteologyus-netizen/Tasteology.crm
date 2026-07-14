"use client";

import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  // Without Supabase configured, skip the gate so the setup banner can show.
  if (!isSupabaseConfigured) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return <>{children}</>;
}
