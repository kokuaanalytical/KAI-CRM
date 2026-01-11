import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const me = data.user;
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const role = await supabase.from("user_roles").select("role").eq("user_id", me.id).maybeSingle();
  if (role.error || role.data?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  const users = await admin.auth.admin.listUsers({ perPage: 2000 }); // plenty for reps
  if (users.error) return NextResponse.json({ error: users.error.message }, { status: 400 });

  const ids = (users.data?.users ?? []).map((u) => u.id);

  const rolesRes = await admin.from("user_roles").select("user_id,role").in("user_id", ids);
  const terrRes = await admin.from("rep_territories").select("user_id,territory_code").in("user_id", ids);
  const profRes = await admin.from("profiles").select("id,email,display_name,created_at").in("id", ids);

  const roleById = new Map((rolesRes.data ?? []).map((r: any) => [r.user_id, r.role]));
  const terrById = new Map<string, string[]>();
  for (const t of (terrRes.data ?? []) as any[]) {
    terrById.set(t.user_id, [...(terrById.get(t.user_id) ?? []), t.territory_code]);
  }
  const profById = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));

  const out = (users.data?.users ?? []).map((u) => {
    const p = profById.get(u.id);
    return {
      id: u.id,
      email: (p?.email ?? u.email ?? "").toLowerCase(),
      display_name: p?.display_name ?? null,
      created_at: p?.created_at ?? u.created_at,
      role: roleById.get(u.id) ?? "rep",
      territories: (terrById.get(u.id) ?? []).sort(),
      invited_at: u.invited_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json({ users: out });
}
