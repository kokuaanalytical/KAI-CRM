import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function originFromRequest(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  try {
    // 1) Verify requester is logged in (cookie-based)
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    // 2) Verify requester is admin
    const roleRes = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleRes.data?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Parse request
    const body = (await req.json()) as { email?: string; role?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const role = (body.role ?? "rep").trim();

    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    // 4) Create ADMIN client using Service Role (server-only)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in env" },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 5) Send invite (redirect user to your reset page)
    const origin = new URL(req.url).origin;
const redirectTo = `${origin}/accept-invite?next=/auth/reset-password`;



    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (invited.error) {
      return NextResponse.json({ error: invited.error.message }, { status: 400 });
    }

    const invitedUserId = invited.data.user?.id;
    if (!invitedUserId) {
      return NextResponse.json({ error: "Invite succeeded but no user id returned" }, { status: 500 });
    }

    // 6) Upsert app role for invited user
    await admin.from("user_roles").upsert(
      { user_id: invitedUserId, role },
      { onConflict: "user_id" }
    );

    return NextResponse.json({
      ok: true,
      invited_user_id: invitedUserId,
      email,
      role,
      redirectTo,
    });
  } catch (e: any) {
    console.error("INVITE_USER_FATAL", e);
    return NextResponse.json({ error: e?.message ?? "Unknown server error" }, { status: 500 });
  }
}
