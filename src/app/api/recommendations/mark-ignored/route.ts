import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json();
  const horizon = String(body.horizon || "24h"); // '24h' | '7d'
  const cutoff = new Date(body.cutoff || new Date().toISOString()).toISOString();

  const col = horizon === "7d" ? "ignored_at_7d" : "ignored_at_24h";

  // mark any shown recs before cutoff that haven't executed yet
  const up = await supabase
    .from("recommendation_events")
    .update({ [col]: new Date().toISOString() } as any)
    .eq("user_id", uid)
    .lte("shown_at", cutoff)
    .is("executed_at", null);

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
