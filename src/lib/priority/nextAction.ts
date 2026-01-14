export type NextActionType =
  | "add_note"
  | "log_call"
  | "create_task"
  | "assign_owner"
  | "move_stage"
  | "schedule_followup"
  | "draft_email";

export type NextAction = {
  action: NextActionType;
  title: string;
  score: number; // 0-100
  reason: string; // deterministic reason
  metadata?: Record<string, any>;
};

export type AccountSignals = {
  id: string;
  name: string;
  stage?: string | null;
  owner_user_id?: string | null;
  last_activity_at?: string | null;

  // flags
  stale_30?: boolean;
  unassigned_7?: boolean;

  // tasks
  open_tasks_due_soon?: number; // due within 7d
  open_tasks_total?: number;

  // activity volume (last 14d)
  recent_activity_count?: number;

  // business value
  est_monthly_volume?: number | null; // optional
};

function daysSince(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

export function computePriorityScore(s: AccountSignals) {
  let score = 0;

  const d = daysSince(s.last_activity_at);
  if (d != null) {
    // stale weighting
    if (d >= 30) score += 35;
    else if (d >= 14) score += 20;
    else if (d >= 7) score += 10;
  } else {
    // never contacted
    score += 15;
  }

  // stage weighting (tune later)
  const stage = (s.stage ?? "").toLowerCase();
  if (["proposal", "negotiation"].includes(stage)) score += 20;
  if (["qualified", "contacted"].includes(stage)) score += 10;
  if (["won", "lost"].includes(stage)) score -= 40;

  if (s.unassigned_7) score += 20;
  if (s.stale_30) score += 15;

  // tasks
  score += clamp((s.open_tasks_due_soon ?? 0) * 8, 0, 24);
  score += clamp((s.open_tasks_total ?? 0) * 2, 0, 12);

  // recent activity volume can reduce urgency slightly (already being worked)
  score -= clamp((s.recent_activity_count ?? 0) * 2, 0, 12);

  // business value
  if (typeof s.est_monthly_volume === "number") {
    if (s.est_monthly_volume >= 1000) score += 12;
    else if (s.est_monthly_volume >= 300) score += 6;
  }

  return clamp(score);
}

export function pickNextActions(s: AccountSignals): NextAction[] {
  const score = computePriorityScore(s);

  const stage = (s.stage ?? "").toLowerCase();
  const d = daysSince(s.last_activity_at);
  const actions: NextAction[] = [];

  // Owner assignment
  if (!s.owner_user_id) {
    actions.push({
      action: "assign_owner",
      title: "Assign an owner",
      score: clamp(score + 10),
      reason: s.unassigned_7 ? "Unassigned for 7+ days" : "Unassigned account",
    });
  }

  // Stale follow-up
  if (d == null || d >= 14) {
    actions.push({
      action: "schedule_followup",
      title: d == null ? "Schedule first follow-up" : "Schedule follow-up",
      score: clamp(score + 8),
      reason: d == null ? "No recorded activity yet" : `No activity in ${d} days`,
      metadata: { suggested_days: d == null ? 2 : 3 },
    });
  }

  // Task creation if tasks due or none
  if ((s.open_tasks_total ?? 0) === 0) {
    actions.push({
      action: "create_task",
      title: "Create a task",
      score: clamp(score + 6),
      reason: "No open tasks exist for this account",
      metadata: { suggested_subject: "Follow up" },
    });
  } else if ((s.open_tasks_due_soon ?? 0) > 0) {
    actions.push({
      action: "create_task",
      title: "Create a task for upcoming due items",
      score: clamp(score + 6),
      reason: `${s.open_tasks_due_soon} tasks due soon`,
    });
  }

  // Stage move suggestion (only if mid stages and very stale)
  if (["proposal", "negotiation", "qualified", "contacted"].includes(stage) && d != null && d >= 30) {
    actions.push({
      action: "move_stage",
      title: "Review stage (may need update)",
      score: clamp(score + 5),
      reason: `Stage is ${stage} but no activity in ${d} days`,
      metadata: { current_stage: stage },
    });
  }

  // Log note/call suggestion
  actions.push({
    action: "log_call",
    title: "Log a call outcome",
    score: clamp(score),
    reason: "Keep activity trail up to date",
  });

  actions.push({
    action: "add_note",
    title: "Add a note",
    score: clamp(score - 2),
    reason: "Capture context for next touchpoint",
  });

  // Draft email always available (text only)
  actions.push({
    action: "draft_email",
    title: "Draft follow-up email",
    score: clamp(score),
    reason: "Generate a follow-up message (no sending)",
  });

  // sort best first, de-dupe by action
  const seen = new Set<string>();
  return actions
    .sort((a, b) => b.score - a.score)
    .filter((a) => (seen.has(a.action) ? false : (seen.add(a.action), true)))
    .slice(0, 5);
}
