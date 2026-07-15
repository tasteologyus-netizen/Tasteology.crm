"use client";

import { useEffect, useState } from "react";

type Status = "processing" | "done" | "error";

export default function BookingSuccessPage() {
  const [status, setStatus] = useState<Status>("processing");
  const [meetingTime, setMeetingTime] = useState<string | null>(null);

  useEffect(() => {
    // Parse the parameters Calendly appends to the redirect URL.
    const params = new URLSearchParams(window.location.search);
    const invitee_email = params.get("invitee_email");
    const location = params.get("location"); // Zoom meeting URL
    const event_start_time = params.get("event_start_time");

    if (event_start_time) {
      const d = new Date(event_start_time);
      if (!isNaN(d.getTime())) {
        setMeetingTime(
          d.toLocaleString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        );
      }
    }

    // Fire-and-forget: record the booking against the matching lead.
    const send = async () => {
      try {
        const res = await fetch("/api/match-zoom-to-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitee_email, location, event_start_time }),
        });
        const json = await res.json().catch(() => ({ success: false }));
        setStatus(json?.success ? "done" : "error");
      } catch {
        setStatus("error");
      }
    };
    send();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#059669"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          You&apos;re booked!
        </h1>
        <p className="mt-2 text-slate-500">
          Thank you for scheduling a call with{" "}
          <span className="font-medium text-slate-700">Tasteology &amp; Co</span>
          . We&apos;re looking forward to speaking with you.
        </p>

        {meetingTime && (
          <div className="mt-6 rounded-xl bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Your meeting
            </p>
            <p className="mt-1 text-base font-semibold text-slate-800">
              {meetingTime}
            </p>
          </div>
        )}

        <p className="mt-6 text-xs text-slate-400">
          {status === "processing" &&
            "Finalizing your booking details…"}
          {status === "done" &&
            "A calendar invite with your Zoom link is on its way to your inbox."}
          {status === "error" &&
            "Your meeting is confirmed. If you don't receive a confirmation email shortly, please reach out to us."}
        </p>
      </div>
    </div>
  );
}
