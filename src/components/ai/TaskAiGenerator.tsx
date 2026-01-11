"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type AccountLite = { id: string; name: string; city: string; state: string; stage: string; notes: string };
type AiTask = { subject: string; notes: string; due_in_days: number };

export function TaskAiGenerator({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<AiTask[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id,name,city,state,stage,notes")
        .order("updated_at", { ascending: false })
        .limit(300);

      setAccounts((data ?? []) as AccountLite[]);
    })();
  }, []);

  async function generate() {
    setErr(null);
    setPreview(null);
    if (!accountId) return setErr("Pick an account first.");
    setBusy(true);

    const account = accounts.find((a) => a.id === accountId)!;

    const acts = await supabase
      .from("activities")
      .select("type,subject,notes,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(40);

    const opps = await supabase
      .from("opportunities")
      .select("id,name,stage,est_monthly_volume,expected_close_date,pricing_tier")
      .eq("account_id", accountId)
      .order("expected_close_date", { ascending: true })
      .limit(25);

    if (acts.error) { setBusy(false); return setErr(acts.error.message); }
    if (opps.error) { setBusy(false); return setErr(opps.error.message); }

    const res = await fetch("/api/ai/task-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, activities: acts.data ?? [], opportunities: opps.data ?? [] }),
    });

    setBusy(false);
    if (!res.ok) return setErr(await res.text());

    const json = (await res.json()) as { tasks: AiTask[] };
    setPreview(json.tasks ?? []);
  }

  async function createTasks() {
    setErr(null);
    if (!accountId) return setErr("Pick an account first.");
    if (!preview || preview.length === 0) return setErr("Generate tasks first.");
    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) { setBusy(false); return setErr("Not logged in."); }

    const now = new Date();
    const rows = preview.map((t) => {
      const due = new Date(now);
      due.setDate(due.getDate() + Math.max(0, Math.min(14, Math.round(t.due_in_days))));
      return {
        account_id: accountId,
        type: "task",
        subject: t.subject,
        notes: t.notes,
        due_at: due.toISOString(),
        completed_at: null,
        owner_user_id: userId,
      };
    });

    const ins = await supabase.from("activities").insert(rows);
    setBusy(false);
    if (ins.error) return setErr(ins.error.message);

    setOpen(false);
    setPreview(null);
    setAccountId("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-2xl">AI: Generate tasks</Button>
      </DialogTrigger>

      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>AI Task Generator</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} — {a.city}, {a.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="secondary" className="rounded-2xl" onClick={generate} disabled={busy}>
              {busy ? "Thinking…" : "Generate"}
            </Button>
            <Button className="rounded-2xl" onClick={createTasks} disabled={busy || !preview}>
              {busy ? "Working…" : "Create tasks"}
            </Button>
          </div>

          {err && <div className="text-sm text-red-400">{err}</div>}

          {preview && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Preview ({preview.length})</div>
              <div className="space-y-2">
                {preview.map((t, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold">{t.subject}</div>
                      <Badge variant="secondary" className="rounded-xl">
                        due +{Math.round(t.due_in_days)}d
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{t.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
