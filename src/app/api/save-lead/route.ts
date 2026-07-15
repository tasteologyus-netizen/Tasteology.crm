import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseAdmin";

// Runs on the server so the shared secret + Supabase key never reach the client.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SaveLeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  requirements?: string;
  lead_source?: string;
}

// Verify "Authorization: Bearer <token>" against CRM_API_SECRET_KEY.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRM_API_SECRET_KEY;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return match[1].trim() === secret;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: SaveLeadPayload;
    try {
      body = (await request.json()) as SaveLeadPayload;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const name = body.name?.trim();
    const email = body.email?.trim() || null;
    const phone = body.phone?.trim() || null;
    const requirements = body.requirements?.trim() || null;
    const leadSource = body.lead_source?.trim() || "manual";

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    if (!isSupabaseAdminConfigured) {
      console.error(
        "[save-lead] Supabase admin not configured. Set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel env."
      );
      return NextResponse.json(
        { success: false, error: "server_misconfigured" },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Map the web-form fields onto the CRM's actual columns.
    const record = {
      full_name: name,
      email,
      phone,
      project_brief: requirements,
      source: leadSource,
      status: "pending" as const,
    };

    // Idempotency: if a lead with this email already exists, refresh its
    // details instead of creating a duplicate (protects against double posts).
    if (email) {
      const { data: existing, error: findErr } = await supabase
        .from("leads")
        .select("id, status")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (findErr) {
        console.error("[save-lead] Lookup failed:", findErr.message);
        return NextResponse.json({ success: false }, { status: 500 });
      }

      if (existing) {
        // Don't downgrade a lead that already progressed (booked/won/etc).
        const keepStatus = existing.status && existing.status !== "new";
        const { error: updErr } = await supabase
          .from("leads")
          .update({
            full_name: name,
            phone,
            project_brief: requirements,
            source: leadSource,
            ...(keepStatus ? {} : { status: "pending" }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updErr) {
          console.error("[save-lead] Update failed:", updErr.message);
          return NextResponse.json({ success: false }, { status: 500 });
        }
        return NextResponse.json({ success: true, deduped: true });
      }
    }

    const { error: insErr } = await supabase.from("leads").insert(record);
    if (insErr) {
      // 23505 = unique_violation: treat as an already-saved lead, not a failure.
      if ((insErr as { code?: string }).code === "23505") {
        return NextResponse.json({ success: true, deduped: true });
      }
      console.error("[save-lead] Insert failed:", insErr.message);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[save-lead] Unexpected error:", (err as Error).message);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
