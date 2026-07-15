"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "@/components/AuthGate";
import { Sidebar } from "@/components/Sidebar";
import { MeetingReminders } from "@/components/MeetingReminders";

// Routes that are shown to external people (e.g. the Calendly redirect) and
// must not require login or render the internal CRM chrome.
const PUBLIC_PREFIXES = ["/booking-success"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) return <>{children}</>;

  return (
    <AuthProvider>
      <AuthGate>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-x-hidden pb-20 lg:pb-0">
            {children}
          </main>
        </div>
        <MeetingReminders />
      </AuthGate>
    </AuthProvider>
  );
}
