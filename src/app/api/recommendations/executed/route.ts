import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const executed_via = String(body.executed_via || "manual");
  const executed_event_id = body.executed_event_id ?? null;

  if (ids.length === 0) return NextResponse.json({ error: "Missing ids" }, { status: 400 });

  const now = new Date().toISOString();
  const up = await supabase
    .from("recommendation_events")
    .update({ executed_at: now, executed_via, executed_event_id })
    .in("id", ids)
    .eq("user_id", uid);

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
