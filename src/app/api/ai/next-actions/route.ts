import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickNextActions, type AccountSignals } from "@/lib/priority/nextAction";

export async function POST(req: Request) {
  const { accountId } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();

  // Account core
  const acc = await supabase
    .from("accounts")
    .select("id,name,stage,owner_user_id,last_activity_at")
    .eq("id", accountId)
    .single();
  if (acc.error) return NextResponse.json({ error: acc.error.message }, { status: 400 });

  // Flags (optional)
  const flags = await supabase
    .from("account_flags")
    .select("stale_30,unassigned_7")
    .eq("account_id", accountId)
    .maybeSingle();

  // Tasks: your app uses activities table for tasks
  const dueSoonIso = new Date(Date.now() + 7 * 864e5).toISOString();
  const tasksSoon = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("type", "task")
    .eq("account_id", accountId)
    .is("completed_at", null)
    .lte("due_at", dueSoonIso);

  const tasksAll = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("type", "task")
    .eq("account_id", accountId)
    .is("completed_at", null);

  // Recent activity volume (last 14d) from account_activities
  const sinceIso = new Date(Date.now() - 14 * 864e5).toISOString();
  const recentActs = await supabase
    .from("account_activities")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .gte("created_at", sinceIso);

  const signals: AccountSignals = {
    ...acc.data,
    stale_30: flags.data?.stale_30 ?? false,
    unassigned_7: flags.data?.unassigned_7 ?? false,
    open_tasks_due_soon: tasksSoon.count ?? 0,
    open_tasks_total: tasksAll.count ?? 0,
    recent_activity_count: recentActs.count ?? 0,
  };

  const deterministic = pickNextActions(signals);

  const payload = {
    account: { id: signals.id, name: signals.name, stage: signals.stage, last_activity_at: signals.last_activity_at },
    signals,
    deterministic,
    rules: [
      "Client names OK.",
      "No PHI (no patient info, no diagnoses, no MRNs, no lab results, no DOB).",
      "Do not claim you sent anything.",
      "Output JSON only.",
    ],
    format: {
      actions: "array of {action,title,score,reason_human,why,confidence_0_1}",
      next_best_action: "string",
    },
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a CRM assistant. Follow rules exactly. Return JSON only." },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });

  const json = await r.json();
  const text = json?.choices?.[0]?.message?.content ?? "";

  // best-effort parse
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  return NextResponse.json({
    deterministic,
    ai: parsed ?? { raw: text },
  });
}
