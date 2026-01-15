import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Action =
  | { type: "create_task"; subject?: string; due_days?: number }
  | { type: "log_note"; body: string }
  | { type: "log_call"; body: string }
  | { type: "move_stage"; stage: string }
  | { type: "assign_owner"; owner_user_id: string | null };

async function getRole(supabase: any, uid: string) {
  const r = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
  return (r.data?.role as string | null) ?? "rep";
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const role = await getRole(supabase, uid);

  const body = await req.json();
  const accountId = String(body.accountId || "");
  const actions = (body.actions ?? []) as Action[];

  if (!accountId || actions.length === 0) {
    return NextResponse.json({ error: "Missing accountId/actions" }, { status: 400 });
  }

  // Tier 6A choice: Admin + reps, but reps cannot move stage
  const filtered: Action[] = actions.filter((a) => {
    if (a.type === "move_stage" && role !== "admin") return false;
    if (a.type === "assign_owner" && role !== "admin") return false; // safest default
    return true;
  });

  // Always require confirmation handled client-side; server just executes.

  // Execute
  for (const a of filtered) {
    if (a.type === "create_task") {
      const dueDays = a.due_days ?? 3;
      const res = await supabase.from("activities").insert({
        type: "task",
        account_id: accountId,
        subject: a.subject ?? "Follow up",
        notes: "",
        due_at: new Date(Date.now() + dueDays * 864e5).toISOString(),
        owner_user_id: uid,
      });
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    if (a.type === "log_note") {
      const res = await supabase.from("account_activities").insert({
        account_id: accountId,
        user_id: uid,
        kind: "note",
        body: a.body,
      });
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    if (a.type === "log_call") {
      const res = await supabase.from("account_activities").insert({
        account_id: accountId,
        user_id: uid,
        kind: "call",
        body: a.body,
      });
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    if (a.type === "move_stage") {
      const res = await supabase.from("accounts").update({ stage: a.stage }).eq("id", accountId);
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    if (a.type === "assign_owner") {
      const res = await supabase.from("accounts").update({ owner_user_id: a.owner_user_id }).eq("id", accountId);
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
    }
  }

  // log outcome event
  await supabase.from("action_events").insert({
    user_id: uid,
    account_id: accountId,
    event_type: "execute_plan",
    meta: { actions: filtered.map((x) => x.type) },
  });

  return NextResponse.json({ ok: true, executed: filtered.map((x) => x.type) });
}

