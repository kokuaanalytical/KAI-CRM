import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const up = await supabase
    .from("nudges")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", uid);

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
