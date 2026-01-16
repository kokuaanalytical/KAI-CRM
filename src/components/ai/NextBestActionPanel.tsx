"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { pickNextActions, computePriorityScore, type AccountSignals } from "@/lib/priority/nextAction";

type PlanAction =
  | { type: "create_task"; subject?: string; due_days?: number }
  | { type: "log_note"; body: string }
  | { type: "log_call"; body: string }
  | { type: "move_stage"; stage: string }
  | { type: "assign_owner"; owner_user_id: string | null };

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

type ShownRec = {
  account_id: string;
  rec_type: string;
  rec_score: number | null;
  rec_reason: string | null;
  rec_payload: any;
};

export function NextBestActionPanel({
  account,
  flags,
}: {
  account: any;
  flags?: { stale_30?: boolean; unassigned_7?: boolean } | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [aiBusy, setAiBusy] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState("");

  const [planOpen, setPlanOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);

  const [doTask, setDoTask] = useState(true);
  const [doNote, setDoNote] = useState(true);
  const [doCall, setDoCall] = useState(false);
  const [doStage, setDoStage] = useState(false);
  const [doOwner, setDoOwner] = useState(false);

  const [noteText, setNoteText] = useState("Follow up with client.");
  const [callText, setCallText] = useState("Left voicemail / discussed next steps.");
  const [taskSubject, setTaskSubject] = useState("Follow up");
  const [taskDueDays, setTaskDueDays] = useState(3);
  const [stageValue, setStageValue] = useState("contacted");

  const signals: AccountSignals = {
    id: account.id,
    name: account.name,
    stage: account.stage,
    owner_user_id: account.owner_user_id,
    last_activity_at: account.last_activity_at,
    stale_30: !!flags?.stale_30,
    unassigned_7: !!flags?.unassigned_7,
    open_tasks_due_soon: 0,
    open_tasks_total: 0,
    recent_activity_count: 0,
    est_monthly_volume: null,
  };

  const score = computePriorityScore(signals);
  const actions = pickNextActions(signals);
  const top = actions.slice(0, 4);

  // ---- Tier 7A tracking (shown/executed) ----
  const lastShownKeyRef = useRef<string>("");
  const [shownIdsByType, setShownIdsByType] = useState<Record<string, string>>({});

  function buildShownRecs(): ShownRec[] {
    return top.map((a) => ({
      account_id: account.id,
      rec_type: a.action,
      rec_score: typeof a.score === "number" ? a.score : null,
      rec_reason: a.reason ?? null,
      rec_payload: a.metadata ?? {},
    }));
  }

  async function trackShownIfNeeded() {
    if (!account?.id) return;
    const recs = buildShownRecs();
    if (recs.length === 0) return;

    const key = `${account.id}::${recs.map((r) => r.rec_type).join("|")}`;
    if (lastShownKeyRef.current === key) return;
    lastShownKeyRef.current = key;

    try {
      const r = await fetch("/api/recommendations/shown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: "next_best_action", recs }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "track shown failed");

      // API returns ids in inserted order; map back to rec_type
      const ids: string[] = Array.isArray(j?.ids) ? j.ids : [];
      const map: Record<string, string> = {};
      recs.forEach((rec, idx) => {
        if (ids[idx]) map[rec.rec_type] = ids[idx];
      });
      setShownIdsByType(map);
    } catch (e) {
      // swallow; we don't want UI to fail because analytics failed
      console.warn("trackShownIfNeeded failed:", e);
    }
  }

  async function markExecuted(recTypes: string[], executed_via: "execute_plan" | "manual") {
    const ids = recTypes.map((t) => shownIdsByType[t]).filter(Boolean);
    if (ids.length === 0) return;

    try {
      await fetch("/api/recommendations/executed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, executed_via }),
      });
    } catch (e) {
      console.warn("markExecuted failed:", e);
    }
  }

  useEffect(() => {
    trackShownIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, top.map((x) => x.action).join("|")]);

  async function logEvent(event_type: string, meta: Record<string, any> = {}) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("action_events").insert({
      user_id: auth.user.id,
      account_id: account.id,
      event_type,
      meta,
    });
  }

  async function draftEmail() {
    setAiBusy(true);
    try {
      await logEvent("draft_email_generated");

      const r = await fetch("/api/ai/draft-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Draft failed");

      setDraftText(j.draft ?? "");
      setDraftOpen(true);

      // Tier 7A: mark draft_email executed if it was recommended/shown
      await markExecuted(["draft_email"], "manual");
    } catch (e: any) {
      toast({ title: "Draft failed", description: e?.message ?? String(e) });
    } finally {
      setAiBusy(false);
    }
  }

  async function executePlan() {
    setPlanBusy(true);
    try {
      const plan: PlanAction[] = [];
      if (doTask) plan.push({ type: "create_task", subject: taskSubject, due_days: taskDueDays });
      if (doNote) plan.push({ type: "log_note", body: noteText });
      if (doCall) plan.push({ type: "log_call", body: callText });
      if (doStage) plan.push({ type: "move_stage", stage: stageValue });
      if (doOwner) plan.push({ type: "assign_owner", owner_user_id: account.owner_user_id ?? null });

      const r = await fetch("/api/autonomy/execute-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, actions: plan }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Execute failed");

      toast({ title: "Plan executed", description: `Executed: ${(j.executed ?? []).join(", ")}` });
      setPlanOpen(false);

      // Tier 7A: mark matching rec_types executed (C: "everything we can detect")
      const executedTypes: string[] = [];
      if (doTask) executedTypes.push("create_task");
      if (doNote) executedTypes.push("add_note"); // matches NextBestAction rec_type
      if (doCall) executedTypes.push("log_call");
      if (doStage) executedTypes.push("move_stage");
      if (doOwner) executedTypes.push("assign_owner");
      // follow-up scheduling isn't part of execute plan right now, so we don't mark it

      await markExecuted(executedTypes, "execute_plan");
    } catch (e: any) {
      toast({ title: "Execute failed", description: e?.message ?? String(e) });
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <>
      <Card className="rounded-2xl border-border bg-card/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Next Best Action</div>
            <div className="text-xs text-muted-foreground">Priority score: {score}/100</div>
          </div>

          <div className="flex items-center gap-2">
            <Button className="rounded-2xl" variant="secondary" onClick={draftEmail} disabled={aiBusy}>
              {aiBusy ? "Drafting…" : "Draft email"}
            </Button>
            <Button className="rounded-2xl" onClick={() => setPlanOpen(true)}>
              Execute plan
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {top.map((a) => (
            <div key={a.action} className="rounded-2xl border border-border bg-background/40 p-3">
              <div className="text-sm font-semibold">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.reason}</div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">Human-approved only • No PHI • No automatic sending</div>
      </Card>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft follow-up email</DialogTitle>
          </DialogHeader>
          <Textarea className="rounded-2xl min-h-56" value={draftText} onChange={(e) => setDraftText(e.target.value)} />
        </DialogContent>
      </Dialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Execute plan (confirm)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <CheckRow checked={doTask} onChange={setDoTask} label="Create task" />
              <CheckRow checked={doNote} onChange={setDoNote} label="Log note" />
              <CheckRow checked={doCall} onChange={setDoCall} label="Log call" />
              <CheckRow checked={doStage} onChange={setDoStage} label="Move stage (admins only)" />
              <CheckRow checked={doOwner} onChange={setDoOwner} label="Assign owner (admins only)" />
            </div>

            {doTask ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Task</div>
                <input
                  className="w-full rounded-2xl border border-border bg-background/40 px-3 py-2 text-sm"
                  value={taskSubject}
                  onChange={(e) => setTaskSubject(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <input
                    className="w-28 rounded-2xl border border-border bg-background/40 px-3 py-2 text-sm"
                    type="number"
                    value={taskDueDays}
                    onChange={(e) => setTaskDueDays(Number(e.target.value))}
                    min={0}
                  />
                  <div className="text-xs text-muted-foreground">Due in days</div>
                </div>
              </div>
            ) : null}

            {doNote ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Note</div>
                <Textarea className="rounded-2xl min-h-24" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              </div>
            ) : null}

            {doCall ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Call log</div>
                <Textarea className="rounded-2xl min-h-24" value={callText} onChange={(e) => setCallText(e.target.value)} />
              </div>
            ) : null}

            {doStage ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Stage value</div>
                <input
                  className="w-full rounded-2xl border border-border bg-background/40 px-3 py-2 text-sm"
                  value={stageValue}
                  onChange={(e) => setStageValue(e.target.value)}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" className="rounded-2xl" onClick={() => setPlanOpen(false)} disabled={planBusy}>
                Cancel
              </Button>
              <Button className="rounded-2xl" onClick={executePlan} disabled={planBusy}>
                {planBusy ? "Executing…" : "Confirm & Execute"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
