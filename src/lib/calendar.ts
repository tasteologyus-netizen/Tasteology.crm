// Helpers to export a meeting to the user's real calendar. The .ics file
// includes a 1-hour reminder (VALARM) so the phone/desktop calendar app
// notifies before the meeting even when this CRM isn't open.

const DEFAULT_DURATION_MIN = 30;

function toCalDate(iso: string): string {
  // -> YYYYMMDDTHHMMSSZ (UTC)
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface MeetingEvent {
  title: string;
  startIso: string;
  durationMin?: number;
  details?: string;
  location?: string;
}

export function googleCalendarUrl(ev: MeetingEvent): string {
  const start = new Date(ev.startIso);
  const end = new Date(
    start.getTime() + (ev.durationMin ?? DEFAULT_DURATION_MIN) * 60000
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${toCalDate(ev.startIso)}/${toCalDate(end.toISOString())}`,
    details: ev.details ?? "",
    location: ev.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcs(ev: MeetingEvent): string {
  const start = new Date(ev.startIso);
  const end = new Date(
    start.getTime() + (ev.durationMin ?? DEFAULT_DURATION_MIN) * 60000
  );
  const uid = `${toCalDate(ev.startIso)}-${Math.random()
    .toString(36)
    .slice(2)}@tasteology-crm`;
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tasteology CRM//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toCalDate(new Date().toISOString())}`,
    `DTSTART:${toCalDate(ev.startIso)}`,
    `DTEND:${toCalDate(end.toISOString())}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.details ? `DESCRIPTION:${esc(ev.details)}` : "",
    ev.location ? `LOCATION:${esc(ev.location)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)} in 1 hour`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function downloadIcs(ev: MeetingEvent, filename = "meeting.ics") {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// datetime-local <-> ISO helpers (datetime-local has no timezone)
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO -> YYYY-MM-DD for <input type="date"> (local calendar day). */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD -> ISO timestamptz.
 * Keeps existing time-of-day when updating; otherwise uses local noon
 * so the chosen calendar day doesn't flip across timezones.
 */
export function dateInputToIso(
  value: string,
  keepTimeFrom?: string | null
): string | null {
  if (!value) return null;
  const [y, m, day] = value.split("-").map(Number);
  if (!y || !m || !day) return null;

  const d = new Date();
  if (keepTimeFrom) {
    const existing = new Date(keepTimeFrom);
    if (!isNaN(existing.getTime())) {
      d.setTime(existing.getTime());
    }
  } else {
    d.setHours(12, 0, 0, 0);
  }
  d.setFullYear(y, m - 1, day);
  return d.toISOString();
}

/** Today's date as YYYY-MM-DD (local). */
export function todayDateInput(): string {
  return isoToDateInput(new Date().toISOString());
}
