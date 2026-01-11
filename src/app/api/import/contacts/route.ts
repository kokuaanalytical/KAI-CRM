import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ContactRow = {
  account_clia_number?: string;
  account_name?: string;
  state?: string;

  contact_name: string;
  title?: string;
  email?: string;
  phone?: string;
  notes?: string;

  owner_email?: string; // admin-only, same policy as accounts
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = (await req.json()) as { rows: ContactRow[] };

  const roleRes = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  const isAdmin = roleRes.data?.role === "admin";

  // Pull accounts for matching (within RLS scope)
  const accRes = await supabase.from("accounts").select("id,name,state,clia_number").limit(5000);
  if (accRes.error) return NextResponse.json({ error: accRes.error.message }, { status: 400 });

  const byClia = new Map<string, string>();
  const byNameState = new Map<string, string>();

  for (const a of accRes.data ?? []) {
    const clia = (a.clia_number ?? "").trim();
    if (clia) byClia.set(clia, String(a.id));
    const key = `${String(a.name).trim().toLowerCase()}|${String(a.state ?? "").trim().toUpperCase()}`;
    byNameState.set(key, String(a.id));
  }

  const errors: Array<{ row: number; error: string }> = [];
  const inserts: any[] = [];

  (body.rows ?? []).forEach((r, idx) => {
    const rowNum = idx + 2;
    const name = (r.contact_name ?? "").trim();
    if (!name) return errors.push({ row: rowNum, error: "Missing contact_name" });

    const clia = (r.account_clia_number ?? "").trim();
    const acctName = (r.account_name ?? "").trim();
    const state = (r.state ?? "").trim().toUpperCase();

    let account_id: string | undefined;
    if (clia && byClia.has(clia)) account_id = byClia.get(clia);
    if (!account_id && acctName && state) {
      const key = `${acctName.toLowerCase()}|${state}`;
      if (byNameState.has(key)) account_id = byNameState.get(key);
    }
    if (!account_id) {
      return errors.push({ row: rowNum, error: "Could not match contact to an account (use account_clia_number or account_name+state)" });
    }

    // owner_email admin-only (same optional profiles support)
    let owner_user_id = user.id;

    inserts.push({
      account_id,
      name,
      title: (r.title ?? "").trim() || null,
      email: (r.email ?? "").trim() || null,
      phone: (r.phone ?? "").trim() || null,
      notes: (r.notes ?? "").trim() || null,
      owner_user_id,
    });
  });

  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const ins = await supabase.from("contacts").insert(inserts);
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

  return NextResponse.json({ inserted: inserts.length, isAdmin });
}
