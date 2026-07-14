"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(error);
      } else {
        const { error, needsConfirmation } = await signUp(
          email.trim(),
          password
        );
        if (error) setError(error);
        else if (needsConfirmation)
          setNotice(
            "Account created. Check your email to confirm, then sign in."
          );
        else setNotice("Account created. You're signed in.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
            T
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Tasteology &amp; Co
          </h1>
          <p className="text-sm text-slate-500">CRM · sign in to continue</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === "signin"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === "signup"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@tasteology.co"
                required
                autoFocus
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {notice}
              </p>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy
                ? "Please wait…"
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Access is restricted to Tasteology &amp; Co team members.
        </p>
      </div>
    </div>
  );
}
