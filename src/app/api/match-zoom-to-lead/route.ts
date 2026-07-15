import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseAdmin";

// This route runs on the server (Node runtime) so secrets stay private.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BookingPayload {
  invitee_email?: string;
  location?: string;
  event_start_time?: string;
}

// fetch() with a hard timeout so a slow Zoom API can't hang the request.
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 6000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Pull the numeric Zoom meeting id out of a join URL, e.g.
// https://us05web.zoom.us/j/85312345678?pwd=... -> "85312345678"
function extractZoomMeetingId(location: string): string | null {
  if (!location) return null;
  const byPath = location.match(/\/j\/(\d+)/);
  if (byPath) return byPath[1];
  const byQuery = location.match(/[?&]confno=(\d+)/);
  if (byQuery) return byQuery[1];
  return null;
}

async function getZoomAccessToken(): Promise<string | null> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  try {
    const res = await fetchWithTimeout(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
        accountId
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    if (!res.ok) {
      console.error("[match-zoom] Zoom token request failed:", res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (err) {
    console.error("[match-zoom] Zoom token error:", (err as Error).message);
    return null;
  }
}

// Best-effort verification that the meeting exists / is active.
async function verifyZoomMeeting(
  token: string,
  meetingId: string
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      console.error("[match-zoom] Zoom meeting lookup failed:", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[match-zoom] Zoom meeting verify error:", (err as Error).message);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    let body: BookingPayload;
    try {
      body = (await request.json()) as BookingPayload;
    } catch {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const inviteeEmail = body.invitee_email?.trim();
    const location = body.location?.trim();
    const eventStartTime = body.event_start_time?.trim();

    if (!inviteeEmail) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured) {
      console.error("[match-zoom] Supabase admin not configured.");
      // Do not leak internal details to the caller.
      return NextResponse.json({ success: false }, { status: 500 });
    }

    // Zoom verification is best-effort: if Zoom is slow or misconfigured we
    // still record the booking so the client-facing flow never breaks.
    if (location) {
      const meetingId = extractZoomMeetingId(location);
      if (meetingId) {
        const token = await getZoomAccessToken();
        if (token) {
          const active = await verifyZoomMeeting(token, meetingId);
          if (!active) {
            console.error(
              `[match-zoom] Meeting ${meetingId} could not be verified; continuing.`
            );
          }
        }
      } else {
        console.error("[match-zoom] Could not parse meeting id from location.");
      }
    }

    const supabase = getSupabaseAdmin();

    // Parameterized update (supabase-js escapes all values). Match the lead by
    // email that is still awaiting its booking (status = 'pending') and flip
    // it to 'booked' with the Zoom link + meeting time.
    const { data, error } = await supabase
      .from("leads")
      .update({
        status: "booked",
        zoom_link: location ?? null,
        meeting_at: eventStartTime ?? null,
        updated_at: new Date().toISOString(),
      })
      .ilike("email", inviteeEmail)
      .eq("status", "pending")
      .select("id");

    if (error) {
      console.error("[match-zoom] DB update failed:", error.message);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true, matched: data?.length ?? 0 });
  } catch (err) {
    console.error("[match-zoom] Unexpected error:", (err as Error).message);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
