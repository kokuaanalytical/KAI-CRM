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
  lab_type?: string; // TEXT
  notes?: string;    // NOT NULL in your DB
  owner_email?: string; // admin-only
};

function normNullable(v: unknown): string | null {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s ? s : null;
}

function normRequired(v: unknown): string {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function makeImportKey(name: string, address1: string | null, city: string | null, state: string) {
  return [name, address1 ?? "", city ?? "", state].map((x) => x.trim().toLowerCase()).join("|");
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body: { rows: AccountRow[] };
  try {
    body = (await req.json()) as { rows: AccountRow[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) return NextResponse.json({ error: "No rows provided" }, { status: 400 });

  // role check (kept)
  const roleRes = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = roleRes.data?.role === "admin";

  // territories map
  const terrRes = await supabase.from("territories").select("id,code");
  if (terrRes.error) return NextResponse.json({ error: terrRes.error.message }, { status: 400 });

  const terrByCode = new Map<string, string>();
  for (const t of terrRes.data ?? []) terrByCode.set(String(t.code).toUpperCase(), String(t.id));

  // admin owner_email map (optional)
  const ownerByEmail = new Map<string, string>();
  if (isAdmin) {
    const uniqueEmails = Array.from(
      new Set(rows.map((r) => (r.owner_email ?? "").trim().toLowerCase()).filter(Boolean))
    );
    if (uniqueEmails.length) {
      const prof = await supabase.from("profiles").select("id,email").in("email", uniqueEmails);
      if (!prof.error) {
        for (const p of prof.data ?? []) ownerByEmail.set(String(p.email).toLowerCase(), String(p.id));
      }
    }
  }

  // build account upserts + site inserts
  const errors: Array<{ row: number; error: string }> = [];

  // key -> account payload
  const accountByKey = new Map<string, any>();
  // rowNum -> (key + site payload)
  const siteDrafts: Array<{ row: number; key: string; site: any }> = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 2;

    const name = normRequired(r.account_name);
    const state = normRequired(r.state).toUpperCase();
    const city = normNullable(r.city);
    const address1 = normNullable(r.address1);

    if (!name) return errors.push({ row: rowNum, error: "Missing account_name" });
    if (!state) return errors.push({ row: rowNum, error: "Missing state" });

    const territory_id = terrByCode.get(state);
    if (!territory_id) {
      return errors.push({ row: rowNum, error: `Unknown state '${state}' (seed territories first)` });
    }

    // Option B: unassigned pool default
    let owner_user_id: string | null = null;
    let assignment_status: "unassigned" | "assigned" = "unassigned";

    if (isAdmin) {
      const oe = (r.owner_email ?? "").trim().toLowerCase();
      if (oe && ownerByEmail.has(oe)) {
        owner_user_id = ownerByEmail.get(oe)!;
        assignment_status = "assigned";
      }
    }

    const import_key = makeImportKey(name, address1, city, state);

    if (!accountByKey.has(import_key)) {
      accountByKey.set(import_key, {
        import_key,
        name,
        city,
        state,
        phone: normNullable(r.phone),
        website: normNullable(r.website),
        lab_type: normNullable(r.lab_type), // TEXT now
        notes: normRequired(r.notes),       // NOT NULL
        territory_id,
        owner_user_id,
        assignment_status,
        assigned_at: owner_user_id ? new Date().toISOString() : null,
        assigned_by_user_id: owner_user_id ? user.id : null,
      });
    }

    // Each CSV row becomes a SITE row
    siteDrafts.push({
      row: rowNum,
      key: import_key,
      site: {
        site_name: null,
        clia_name: normNullable(r.clia_name),
        clia_number: normNullable(r.clia_number),
        address1,
        city,
        state,
        phone: normNullable(r.phone),
        website: normNullable(r.website),
        notes: normNullable(r.notes),
      },
    });
  });

  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const accountsToUpsert = Array.from(accountByKey.values());

  // Upsert accounts by import_key
  const up = await supabase
    .from("accounts")
    .upsert(accountsToUpsert, { onConflict: "import_key" })
    .select("id,import_key,assignment_status,owner_user_id");

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

  const idByKey = new Map<string, string>();
  for (const a of up.data ?? []) idByKey.set(String(a.import_key), String(a.id));

  // Build site inserts with account_id
  const sitesToInsert: any[] = [];
  for (const d of siteDrafts) {
    const account_id = idByKey.get(d.key);
    if (!account_id) {
      return NextResponse.json({ error: `Missing account id for import_key (row ${d.row})` }, { status: 400 });
    }
    sitesToInsert.push({ account_id, ...d.site });
  }

  const insSites = await supabase.from("account_sites").insert(sitesToInsert).select("id,account_id,clia_number");

  if (insSites.error) return NextResponse.json({ error: insSites.error.message }, { status: 400 });

  return NextResponse.json({
    accounts_upserted: up.data?.length ?? 0,
    sites_inserted: insSites.data?.length ?? 0,
    sample_account: up.data?.slice(0, 3) ?? [],
    sample_site: insSites.data?.slice(0, 3) ?? [],
    mode: "accounts_plus_sites",
    isAdmin,
  });
}
