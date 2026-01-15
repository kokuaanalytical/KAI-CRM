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
  reason: string;
  metadata?: Record<string, any>;
};

export type AccountSignals = {
  id: string;
  name: string;
  stage?: string | null;
  owner_user_id?: string | null;
  last_activity_at?: string | null;

  stale_30?: boolean;
  unassigned_7?: boolean;

  open_tasks_due_soon?: number;
  open_tasks_total?: number;

  recent_activity_count?: number;

  est_monthly_volume?: number | null;
};

export type PriorityWeights = {
  w_stale: number;
  w_stage: number;
  w_unassigned: number;
  w_tasks_due: number;
  w_tasks_total: number;
  w_recent_activity: number; // typically negative
  w_volume: number;
};

const DEFAULT_W: PriorityWeights = {
  w_stale: 35,
  w_stage: 20,
  w_unassigned: 20,
  w_tasks_due: 16,
  w_tasks_total: 8,
  w_recent_activity: -10,
  w_volume: 10,
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

export function computePriorityScore(s: AccountSignals, weights?: Partial<PriorityWeights>) {
  const w: PriorityWeights = { ...DEFAULT_W, ...(weights ?? {}) };

  let score = 0;

  const d = daysSince(s.last_activity_at);

  // stale contribution (0..w_stale)
  if (d == null) score += Math.round(w.w_stale * 0.4); // never contacted
  else if (d >= 30) score += w.w_stale;
  else if (d >= 14) score += Math.round(w.w_stale * 0.65);
  else if (d >= 7) score += Math.round(w.w_stale * 0.35);

  // stage contribution (0..w_stage, won/lost negative)
  const stage = (s.stage ?? "").toLowerCase();
  if (["proposal", "negotiation"].includes(stage)) score += w.w_stage;
  else if (["qualified", "contacted"].includes(stage)) score += Math.round(w.w_stage * 0.6);
  else if (["won", "lost"].includes(stage)) score -= Math.round(w.w_stage * 2);

  // unassigned + flags
  if (!s.owner_user_id) score += w.w_unassigned;
  if (s.unassigned_7) score += Math.round(w.w_unassigned * 0.5);
  if (s.stale_30) score += Math.round(w.w_stale * 0.4);

  // tasks
  score += clamp((s.open_tasks_due_soon ?? 0) * Math.max(1, Math.round(w.w_tasks_due / 2)), 0, w.w_tasks_due);
  score += clamp((s.open_tasks_total ?? 0) * Math.max(1, Math.round(w.w_tasks_total / 4)), 0, w.w_tasks_total);

  // recent activity reduces urgency
  score += clamp((s.recent_activity_count ?? 0) * Math.round(w.w_recent_activity / 5), w.w_recent_activity, 0);

  // volume
  if (typeof s.est_monthly_volume === "number") {
    if (s.est_monthly_volume >= 1000) score += w.w_volume;
    else if (s.est_monthly_volume >= 300) score += Math.round(w.w_volume * 0.5);
  }

  return clamp(score);
}

export function pickNextActions(s: AccountSignals, weights?: Partial<PriorityWeights>): NextAction[] {
  const score = computePriorityScore(s, weights);
  const stage = (s.stage ?? "").toLowerCase();
  const d = daysSince(s.last_activity_at);

  const actions: NextAction[] = [];

  if (!s.owner_user_id) {
    actions.push({
      action: "assign_owner",
      title: "Assign an owner",
      score: clamp(score + 10),
      reason: s.unassigned_7 ? "Unassigned for 7+ days" : "Unassigned account",
    });
  }

  if (d == null || d >= 14) {
    actions.push({
      action: "schedule_followup",
      title: d == null ? "Schedule first follow-up" : "Schedule follow-up",
      score: clamp(score + 8),
      reason: d == null ? "No recorded activity yet" : `No activity in ${d} days`,
      metadata: { suggested_days: d == null ? 2 : 3 },
    });
  }

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

  if (["proposal", "negotiation", "qualified", "contacted"].includes(stage) && d != null && d >= 30) {
    actions.push({
      action: "move_stage",
      title: "Review stage (may need update)",
      score: clamp(score + 5),
      reason: `Stage is ${stage} but no activity in ${d} days`,
      metadata: { current_stage: stage },
    });
  }

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

  actions.push({
    action: "draft_email",
    title: "Draft follow-up email",
    score: clamp(score),
    reason: "Generate a follow-up message (no sending)",
  });

  const seen = new Set<string>();
  return actions
    .sort((a, b) => b.score - a.score)
    .filter((a) => (seen.has(a.action) ? false : (seen.add(a.action), true)))
    .slice(0, 5);
}
