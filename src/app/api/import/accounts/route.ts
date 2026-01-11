import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AccountRow = {
  account_name: string;
  clia_name?: string;
  clia_number?: string;
  address1?: string;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  lab_type?: string;
  notes?: string;
  owner_email?: string; // admin-only (optional)
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = (await req.json()) as { rows: AccountRow[] };

  const roleRes = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = roleRes.data?.role === "admin";

  // Territories map
  const terrRes = await supabase.from("territories").select("id,code");
  if (terrRes.error) return NextResponse.json({ error: terrRes.error.message }, { status: 400 });

  const terrByCode = new Map<string, string>();
  for (const t of terrRes.data ?? []) terrByCode.set(String(t.code).toUpperCase(), String(t.id));

  // NOTE:
  // Admin-only owner_email support requires a user directory table.
  // If you have public.profiles(email,id), we can map it here. Otherwise we ignore owner_email safely.
  const ownerByEmail = new Map<string, string>();
  if (isAdmin) {
    const unique = Array.from(
      new Set((body.rows ?? []).map((r) => (r.owner_email ?? "").trim().toLowerCase()).filter(Boolean))
    );
    if (unique.length) {
      const prof = await supabase.from("profiles").select("id,email").in("email", unique);
      if (!prof.error) {
        for (const p of prof.data ?? []) ownerByEmail.set(String(p.email).toLowerCase(), String(p.id));
      }
    }
  }

  const errors: Array<{ row: number; error: string }> = [];
  const inserts: any[] = [];

  (body.rows ?? []).forEach((r, idx) => {
    const rowNum = idx + 2;
    const name = (r.account_name ?? "").trim();
    const state = (r.state ?? "").trim().toUpperCase();
    if (!name) return errors.push({ row: rowNum, error: "Missing account_name" });
    if (!state) return errors.push({ row: rowNum, error: "Missing state" });

    const territory_id = terrByCode.get(state);
    if (!territory_id) return errors.push({ row: rowNum, error: `Unknown state '${state}' (seed territories first)` });

    // Default: UNASSIGNED bucket
    let owner_user_id: string | null = null;
    let assignment_status: "unassigned" | "assigned" = "unassigned";

    // Admin-only: allow owner_email assignment (if we can map it)
    if (isAdmin) {
      const oe = (r.owner_email ?? "").trim().toLowerCase();
      if (oe && ownerByEmail.has(oe)) {
        owner_user_id = ownerByEmail.get(oe)!;
        assignment_status = "assigned";
      }
    }

    inserts.push({
      name,
      clia_name: (r.clia_name ?? "").trim() || null,
      clia_number: (r.clia_number ?? "").trim() || null,
      address1: (r.address1 ?? "").trim() || null,
      city: (r.city ?? "").trim() || null,
      state,
      phone: (r.phone ?? "").trim() || null,
      website: (r.website ?? "").trim() || null,
      lab_type: (r.lab_type ?? "").trim() || null,
      notes: (r.notes ?? "").trim() || null,
      territory_id,
      owner_user_id,
      assignment_status,
      assigned_at: owner_user_id ? new Date().toISOString() : null,
      assigned_by_user_id: owner_user_id ? user.id : null,
    });
  });

  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const ins = await supabase.from("accounts").insert(inserts);
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

  return NextResponse.json({ inserted: inserts.length, isAdmin, defaultedToUnassigned: true });
}
