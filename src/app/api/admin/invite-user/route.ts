import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const me = data.user;
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // must be admin
  const role = await supabase.from("user_roles").select("role").eq("user_id", me.id).maybeSingle();
  if (role.error || role.data?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const setRole = (String(body.role || "rep") as "rep" | "admin");

  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const admin = createSupabaseAdminClient();

  // Invite (Supabase Auth sends email)
  const invited = await admin.auth.admin.inviteUserByEmail(email);
  if (invited.error) return NextResponse.json({ error: invited.error.message }, { status: 400 });

  const invitedUserId = invited.data?.user?.id;
  if (!invitedUserId) return NextResponse.json({ error: "Invite succeeded but no user id returned" }, { status: 500 });

  // Set role immediately
  const upRole = await admin.from("user_roles").upsert({ user_id: invitedUserId, role: setRole }, { onConflict: "user_id" });
  if (upRole.error) return NextResponse.json({ error: upRole.error.message }, { status: 400 });

  return NextResponse.json({ ok: true, user_id: invitedUserId, email, role: setRole });
}
