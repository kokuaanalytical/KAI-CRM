"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { pickNextActions, computePriorityScore, type AccountSignals } from "@/lib/priority/nextAction";

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

  const signals: AccountSignals = {
    id: account.id,
    name: account.name,
    stage: account.stage,
    owner_user_id: account.owner_user_id,
    last_activity_at: account.last_activity_at,
    stale_30: !!flags?.stale_30,
    unassigned_7: !!flags?.unassigned_7,
    // list-level extras not required here; we keep it simple/safe
    open_tasks_due_soon: 0,
    open_tasks_total: 0,
    recent_activity_count: 0,
    est_monthly_volume: null,
  };

  const score = computePriorityScore(signals);
  const actions = pickNextActions(signals);

  async function logActivity(kind: string, body: string) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");

    const res = await supabase.from("account_activities").insert({
      account_id: account.id,
      user_id: auth.user.id,
      kind,
      body,
    });

    if (res.error) throw res.error;
  }

  async function createTask(subject: string) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");

    // your app stores tasks in "activities"
    const res = await supabase.from("activities").insert({
      type: "task",
      account_id: account.id,
      subject,
      notes: "",
      due_at: new Date(Date.now() + 3 * 864e5).toISOString(),
      owner_user_id: auth.user.id,
    });

    if (res.error) throw res.error;
  }

  async function draftEmail() {
    setAiBusy(true);
    try {
      const r = await fetch("/api/ai/draft-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Draft failed");

      setDraftText(j.draft ?? "");
      setDraftOpen(true);
    } catch (e: any) {
      toast({ title: "Draft failed", description: e?.message ?? String(e) });
    } finally {
      setAiBusy(false);
    }
  }

  // optional: pre-open nothing; just sits there until you click Draft
  useEffect(() => {}, [account?.id]);

  return (
    <>
      <Card className="rounded-2xl border-border bg-card/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Next Best Action</div>
            <div className="text-xs text-muted-foreground">Priority score: {score}/100</div>
          </div>

          <Button className="rounded-2xl" variant="secondary" onClick={draftEmail} disabled={aiBusy}>
            {aiBusy ? "Drafting…" : "Draft email"}
          </Button>
        </div>

        <div className="space-y-2">
          {actions.slice(0, 4).map((a) => (
            <div key={a.action} className="rounded-2xl border border-border bg-background/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.reason}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {a.action === "create_task" && (
                    <Button
                      className="rounded-2xl"
                      onClick={async () => {
                        try {
                          await createTask(a.metadata?.suggested_subject ?? "Follow up");
                          toast({ title: "Task created" });
                        } catch (e: any) {
                          toast({ title: "Failed", description: e?.message ?? String(e) });
                        }
                      }}
                    >
                      Create task
                    </Button>
                  )}

                  {(a.action === "add_note" || a.action === "log_call") && (
                    <Button
                      className="rounded-2xl"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await logActivity(a.action === "log_call" ? "call" : "note", a.title);
                          toast({ title: "Logged" });
                        } catch (e: any) {
                          toast({ title: "Failed", description: e?.message ?? String(e) });
                        }
                      }}
                    >
                      Quick log
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          Draft is text-only (copy/paste). No PHI. No automatic sending.
        </div>
      </Card>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft follow-up email</DialogTitle>
          </DialogHeader>

          <Textarea
            className="rounded-2xl min-h-56"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
          />

          <div className="text-xs text-muted-foreground">
            Copy/paste into your email client (this CRM does not send automatically).
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
