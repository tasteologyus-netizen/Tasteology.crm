"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLeads } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Lead } from "@/lib/types";

const NOTIFIED_KEY = "tasteology_notified_meetings";
const LEAD_REFRESH_MS = 5 * 60 * 1000; // refresh lead list every 5 min
const CHECK_MS = 30 * 1000; // check upcoming meetings every 30s
const WINDOW_MIN = 60; // remind within 60 minutes

function loadNotified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveNotified(set: Set<string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]));
}

export function MeetingReminders() {
  const leadsRef = useRef<Lead[]>([]);
  const [needsEnable, setNeedsEnable] = useState(false);

  const refreshLeads = useCallback(async () => {
    try {
      leadsRef.current = (await getLeads()).filter(
        (l) => l.status === "booked" && l.meeting_at
      );
    } catch {
      /* ignore transient fetch errors */
    }
  }, []);

  const check = useCallback(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const notified = loadNotified();
    const now = Date.now();
    let changed = false;

    for (const lead of leadsRef.current) {
      if (!lead.meeting_at) continue;
      const key = `${lead.id}:${lead.meeting_at}`;
      if (notified.has(key)) continue;
      const diffMin = (new Date(lead.meeting_at).getTime() - now) / 60000;
      if (diffMin <= WINDOW_MIN && diffMin > -5) {
        const whenText =
          diffMin < 1
            ? "now"
            : `in ${Math.round(diffMin)} min`;
        const n = new Notification(`Meeting ${whenText}: ${lead.full_name}`, {
          body: lead.project_brief || "Upcoming meeting",
          tag: key,
        });
        if (lead.zoom_link) {
          n.onclick = () => window.open(lead.zoom_link!, "_blank");
        }
        notified.add(key);
        changed = true;
      }
    }
    if (changed) saveNotified(notified);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((p) =>
          setNeedsEnable(p !== "granted")
        );
      } else if (Notification.permission === "denied") {
        setNeedsEnable(true);
      }
    }

    refreshLeads();
    check();
    const refreshId = setInterval(refreshLeads, LEAD_REFRESH_MS);
    const checkId = setInterval(check, CHECK_MS);
    return () => {
      clearInterval(refreshId);
      clearInterval(checkId);
    };
  }, [refreshLeads, check]);

  const enable = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNeedsEnable(p !== "granted");
    if (p === "granted") check();
  };

  if (!needsEnable) return null;

  return (
    <button
      onClick={enable}
      className="fixed bottom-24 right-4 z-40 rounded-full bg-brand-600 px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-brand-700 lg:bottom-4"
      title="Allow browser notifications for meeting reminders"
    >
      🔔 Enable meeting reminders
    </button>
  );
}
