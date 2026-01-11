"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, PhoneCall, CheckSquare, Plus } from "lucide-react";

type AccountMini = {
  id: string;
  name: string;
};

const oppStages = ["prospect", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const pricingTiers = ["tier_1", "tier_2", "tier_3", "custom"] as const;

export function AccountQuickActions({ account }: { account: AccountMini }) {
  const [open, setOpen] = useState<null | "email" | "call" | "task" | "opp">(null);

  return (
    <>
      <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen("email")}>
        <Mail className="mr-2 h-4 w-4" /> Log Email
      </Button>

      <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen("call")}>
        <PhoneCall className="mr-2 h-4 w-4" /> Log Call
      </Button>

      <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen("task")}>
        <CheckSquare className="mr-2 h-4 w-4" /> Create Task
      </Button>

      <Button className="rounded-2xl" onClick={() => setOpen("opp")}>
        <Plus className="mr-2 h-4 w-4" /> Opportunity
      </Button>

      <LogActivityDialog
        open={open === "email"}
        onOpenChange={(v) => setOpen(v ? "email" : null)}
        accountId={account.id}
        title="Log Email"
        type="email"
        defaultSubject={`Email to ${account.name}`}
      />

      <LogActivityDialog
        open={open === "call"}
        onOpenChange={(v) => setOpen(v ? "call" : null)}
        accountId={account.id}
        title="Log Call"
        type="call"
        defaultSubject={`Call with ${account.name}`}
      />

      <CreateTaskDialog
        open={open === "task"}
        onOpenChange={(v) => setOpen(v ? "task" : null)}
        accountId={account.id}
        accountName={account.name}
      />

      <CreateOpportunityDialog
        open={open === "opp"}
        onOpenChange={(v) => setOpen(v ? "opp" : null)}
        accountId={account.id}
        accountName={account.name}
      />
    </>
  );
}

function LogActivityDialog({
  open,
  onOpenChange,
  accountId,
  title,
  type,
  defaultSubject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  title: string;
  type: "email" | "call";
  defaultSubject: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState(defaultSubject);
  const [notes, setNotes] = useState("");

  async function submit() {
    setErr(null);
    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setBusy(false);
      return setErr("Not logged in.");
    }

    const { error } = await supabase.from("activities").insert({
      account_id: accountId,
      type,
      subject: subject || defaultSubject,
      notes,
      due_at: null,
      completed_at: new Date().toISOString(),
      owner_user_id: userId,
    });

    setBusy(false);
    if (error) return setErr(error.message);

    onOpenChange(false);
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          {err && <div className="text-sm text-red-400">{err}</div>}
          <Button className="rounded-2xl" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  accountName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState(`Follow up with ${accountName}`);
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState<string>("");

  async function submit() {
    setErr(null);
    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setBusy(false);
      return setErr("Not logged in.");
    }

    const { error } = await supabase.from("activities").insert({
      account_id: accountId,
      type: "task",
      subject: subject || `Follow up with ${accountName}`,
      notes,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      completed_at: null,
      owner_user_id: userId,
    });

    setBusy(false);
    if (error) return setErr(error.message);

    onOpenChange(false);
    setNotes("");
    setDueAt("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Task subject" />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          {err && <div className="text-sm text-red-400">{err}</div>}
          <Button className="rounded-2xl" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateOpportunityDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  accountName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState(`Opportunity — ${accountName}`);
  const [stage, setStage] = useState<(typeof oppStages)[number]>("prospect");
  const [tier, setTier] = useState<(typeof pricingTiers)[number]>("tier_1");
  const [volume, setVolume] = useState<number>(100);
  const [closeDate, setCloseDate] = useState<string>("");

  async function submit() {
    setErr(null);
    if (!closeDate) return setErr("Expected close date is required.");
    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setBusy(false);
      return setErr("Not logged in.");
    }

    const { error } = await supabase.from("opportunities").insert({
      account_id: accountId,
      name: name || `Opportunity — ${accountName}`,
      stage,
      est_monthly_volume: volume,
      pricing_tier: tier,
      expected_close_date: closeDate,
      owner_user_id: userId,
    });

    setBusy(false);
    if (error) return setErr(error.message);

    onOpenChange(false);
    setCloseDate("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create Opportunity</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Opportunity name" />

          <div className="grid grid-cols-2 gap-3">
            <Select value={stage} onValueChange={(v) => setStage(v as any)}>
              <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                {oppStages.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tier} onValueChange={(v) => setTier(v as any)}>
              <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Pricing tier" /></SelectTrigger>
              <SelectContent>
                {pricingTiers.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input type="number" value={volume} onChange={(e) => setVolume(Number(e.target.value))} placeholder="Est monthly volume" />
            <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </div>

          {err && <div className="text-sm text-red-400">{err}</div>}
          <Button className="rounded-2xl" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
