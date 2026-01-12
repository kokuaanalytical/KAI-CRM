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
  lab_type?: string; // TEXT now
  notes?: string;    // NOT NULL in DB (we'll default to "")
  owner_email?: string; // admin-only
};

function normNullable(v: unknown): string | null {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s ? s : null;
}

function normRequiredString(v: unknown): string {
  // For NOT NULL text columns like notes: always return a string
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  // ─── AUTH ─────────────────────────────────────────
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = (await req.json()) as { rows: AccountRow[] };

  // ─── ROLE CHECK ───────────────────────────────────
  const roleRes = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = roleRes.data?.role === "admin";

  // ─── TERRITORIES ─────────────────────────────────
  const terrRes = await supabase.from("territories").select("id,code");
  if (terrRes.error) {
    return NextResponse.json({ error: terrRes.error.message }, { status: 400 });
  }

  const terrByCode = new Map<string, string>();
  for (const t of terrRes.data ?? []) {
    terrByCode.set(String(t.code).toUpperCase(), String(t.id));
  }

  // ─── ADMIN OWNER EMAIL MAP ───────────────────────
  const ownerByEmail = new Map<string, string>();

  if (isAdmin) {
    const uniqueEmails = Array.from(
      new Set(
        (body.rows ?? [])
          .map((r) => (r.owner_email ?? "").trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (uniqueEmails.length) {
      const prof = await supabase
        .from("profiles")
        .select("id,email")
        .in("email", uniqueEmails);

      if (!prof.error) {
        for (const p of prof.data ?? []) {
          ownerByEmail.set(String(p.email).toLowerCase(), String(p.id));
        }
      }
    }
  }

  // ─── BUILD INSERTS ───────────────────────────────
  const errors: Array<{ row: number; error: string }> = [];
  const inserts: any[] = [];

  (body.rows ?? []).forEach((r, idx) => {
    const rowNum = idx + 2;

    const name = normRequiredString(r.account_name);
    const state = normRequiredString(r.state).toUpperCase();

    if (!name) {
      errors.push({ row: rowNum, error: "Missing account_name" });
      return;
    }

    if (!state) {
      errors.push({ row: rowNum, error: "Missing state" });
      return;
    }

    const territory_id = terrByCode.get(state);
    if (!territory_id) {
      errors.push({
        row: rowNum,
        error: `Unknown state '${state}' (seed territories first)`,
      });
      return;
    }

    // ─── OPTION B: UNASSIGNED POOL ────────────────
    let owner_user_id: string | null = null;
    let assignment_status: "unassigned" | "assigned" = "unassigned";

    if (isAdmin) {
      const oe = normRequiredString(r.owner_email).toLowerCase();
      if (oe && ownerByEmail.has(oe)) {
        owner_user_id = ownerByEmail.get(oe)!;
        assignment_status = "assigned";
      }
    }

    inserts.push({
      name,
      clia_name: normNullable(r.clia_name),
      clia_number: normNullable(r.clia_number),
      address1: normNullable(r.address1),
      city: normNullable(r.city),
      state,
      phone: normNullable(r.phone),
      website: normNullable(r.website),

      // lab_type is TEXT now → accept any string (or null)
      lab_type: normNullable(r.lab_type),

      // notes is NOT NULL in DB → always send a string
      notes: normRequiredString(r.notes),

      territory_id,
      owner_user_id,
      assignment_status,
      assigned_at: owner_user_id ? new Date().toISOString() : null,
      assigned_by_user_id: owner_user_id ? user.id : null,
    });
  });

  if (errors.length) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  // ─── INSERT (RETURN ROWS) ───────────────────────
  const ins = await supabase
    .from("accounts")
    .insert(inserts)
    .select("id,state,assignment_status,owner_user_id");

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message }, { status: 400 });
  }

  return NextResponse.json({
    inserted: ins.data?.length ?? 0,
    sample: ins.data?.slice(0, 5),
    mode: "unassigned_pool",
    isAdmin,
  });
}
