import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json();
  const surface = String(body.surface || "");
  const recs = Array.isArray(body.recs) ? body.recs : [];

  if (!surface || recs.length === 0) {
    return NextResponse.json({ error: "Missing surface/recs" }, { status: 400 });
  }

  const rows = recs.map((r: any) => ({
    user_id: uid,
    account_id: r.account_id ?? null,
    surface,
    rec_type: String(r.rec_type || ""),
    rec_score: typeof r.rec_score === "number" ? r.rec_score : null,
    rec_reason: r.rec_reason ?? null,
    rec_payload: r.rec_payload ?? {},
    shown_at: new Date().toISOString(),
  }));

  const ins = await supabase.from("recommendation_events").insert(rows).select("id");
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

  return NextResponse.json({ ok: true, ids: (ins.data ?? []).map((x: any) => x.id) });
}
