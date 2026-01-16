import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isWeekendUTC() {
  const day = new Date().getUTCDay(); // 0 Sun .. 6 Sat
  return day === 0 || day === 6;
}

export async function POST() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // prefs (weekdays-only)
  const prefs = await supabase
    .from("user_nudge_prefs")
    .select("weekdays_only")
    .eq("user_id", uid)
    .maybeSingle();

  const weekdaysOnly = prefs.data?.weekdays_only ?? true;
  if (weekdaysOnly && isWeekendUTC()) return NextResponse.json({ ok: true, generated: 0 });

  // accounts + flags
  const a = await supabase
    .from("accounts_active")
    .select("id,name,owner_user_id,last_activity_at")
    .limit(400);

  if (a.error) return NextResponse.json({ error: a.error.message }, { status: 400 });

  const f = await supabase
    .from("account_flags")
    .select("account_id,stale_30,unassigned_7");

  if (f.error) return NextResponse.json({ error: f.error.message }, { status: 400 });

  const flagById = new Map<string, any>((f.data ?? []).map((x: any) => [x.account_id, x]));
  const nowIso = new Date().toISOString();

  const rows: any[] = [];

  for (const acc of a.data ?? []) {
    const fl = flagById.get(acc.id) ?? {};
    const last = acc.last_activity_at ? new Date(acc.last_activity_at).getTime() : null;
    const days = last ? Math.floor((Date.now() - last) / 864e5) : null;

    // all triggers (per your choice)
    if (days != null && days >= 14) {
      rows.push({
        user_id: uid,
        account_id: acc.id,
        kind: "stale_14",
        severity: days >= 30 ? "critical" : "warn",
        title: `Stale touch: ${acc.name}`,
        body: `No recorded activity in ${days} days.`,
        meta: { days },
        due_at: nowIso,
      });
    }

    if (!acc.owner_user_id && !!fl.unassigned_7) {
      rows.push({
        user_id: uid,
        account_id: acc.id,
        kind: "unassigned_7",
        severity: "warn",
        title: `Unassigned: ${acc.name}`,
        body: `This account has been unassigned for 7+ days.`,
        meta: {},
        due_at: nowIso,
      });
    }

    if (days != null && days >= 7) {
      rows.push({
        user_id: uid,
        account_id: acc.id,
        kind: "no_activity_7",
        severity: "info",
        title: `No activity: ${acc.name}`,
        body: `No activity logged in ${days} days.`,
        meta: { days },
        due_at: nowIso,
      });
    }

    if (!!fl.stale_30) {
      rows.push({
        user_id: uid,
        account_id: acc.id,
        kind: "priority_gt",
        severity: "warn",
        title: `High priority: ${acc.name}`,
        body: `Flagged as stale 30+ (high urgency).`,
        meta: {},
        due_at: nowIso,
      });
    }
  }

  if (rows.length === 0) return NextResponse.json({ ok: true, generated: 0 });

  const ins = await supabase.from("nudges").insert(rows);
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

  return NextResponse.json({ ok: true, generated: rows.length });
}
