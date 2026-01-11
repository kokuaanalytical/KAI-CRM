"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Territory = { id: string; code: string; name: string };
type AccountLite = { id: string; name: string; state: string; city: string };

const stages = ["prospect", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const pricingTiers = ["tier_1", "tier_2", "tier_3", "custom"] as const;
const activityTypes = ["email", "call", "meeting", "task", "other"] as const;

export function CreateMenu() {
  const [open, setOpen] = useState<null | "account" | "opportunity" | "activity">(null);

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  async function refreshLookups() {
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id ?? null);

    const t = await supabase.from("territories").select("id,code,name").order("code");
    if (!t.error) setTerritories((t.data ?? []) as Territory[]);

    const a = await supabase
      .from("accounts")
      .select("id,name,state,city")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (!a.error) setAccounts((a.data ?? []) as AccountLite[]);
  }

  useEffect(() => {
    refreshLookups();
  }, []);

  useEffect(() => {
    if (open) refreshLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="rounded-2xl">
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl">
          <DropdownMenuItem onClick={() => setOpen("account")}>Account</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("opportunity")}>Opportunity</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("activity")}>Activity</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateAccountDialog
        open={open === "account"}
        onOpenChange={(v) => setOpen(v ? "account" : null)}
        territories={territories}
        userId={userId}
      />

      <CreateOpportunityDialog
        open={open === "opportunity"}
        onOpenChange={(v) => setOpen(v ? "opportunity" : null)}
        accounts={accounts}
        userId={userId}
      />

      <CreateActivityDialog
        open={open === "activity"}
        onOpenChange={(v) => setOpen(v ? "activity" : null)}
        accounts={accounts}
        userId={userId}
      />
    </>
  );
}

function CreateAccountDialog({
  open,
  onOpenChange,
  territories,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  territories: Territory[];
  userId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cliaName, setCliaName] = useState("");
  const [cliaNumber, setCliaNumber] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [labType, setLabType] = useState<
    "reference_lab" | "hospital_lab" | "physician_office_lab" | "clinic" | "other"
  >("reference_lab");
  const [notes, setNotes] = useState("");

  const territoryId = useMemo(() => {
    const t = territories.find((x) => x.code === stateCode);
    return t?.id ?? null;
  }, [territories, stateCode]);

  async function create() {
    setErr(null);
    if (!userId) return setErr("Not logged in.");
    if (territories.length === 0) return setErr("No territories found. Go to Admin and seed states first.");
    if (!territoryId) return setErr("Pick a State (territory) first.");
    setBusy(true);

    const { error } = await supabase.from("accounts").insert({
      name,
      clia_name: cliaName,
      clia_number: cliaNumber,
      address1,
      city,
      state: stateCode,
      phone,
      website,
      lab_type: labType,
      notes,
      territory_id: territoryId,
      owner_user_id: userId,
    });

    setBusy(false);
    if (error) return setErr(error.message);
    onOpenChange(false);
    window.location.href = "/accounts";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Input placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="CLIA name" value={cliaName} onChange={(e) => setCliaName(e.target.value)} />
            <Input placeholder="CLIA number" value={cliaNumber} onChange={(e) => setCliaNumber(e.target.value)} />
          </div>

          <Input placeholder="Address" value={address1} onChange={(e) => setAddress1(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />

            {territories.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card/30 p-3">
                <div className="text-sm font-semibold">No states loaded</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Go to Admin and click “Seed all US states”, then reopen Create.
                </div>
                <div className="mt-2">
                  <Link href="/admin">
                    <Button variant="secondary" className="rounded-2xl">
                      Open Admin
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Select value={stateCode} onValueChange={setStateCode}>
                <SelectTrigger>
                  <SelectValue placeholder="State (territory)" />
                </SelectTrigger>
                <SelectContent>
                  {territories.map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      {t.code} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          <Select value={labType} onValueChange={(v) => setLabType(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Lab type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reference_lab">Reference lab</SelectItem>
              <SelectItem value="hospital_lab">Hospital lab</SelectItem>
              <SelectItem value="physician_office_lab">Physician office lab</SelectItem>
              <SelectItem value="clinic">Clinic</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {err && <div className="text-sm text-red-400">{err}</div>}

          <Button className="rounded-2xl" onClick={create} disabled={busy || territories.length === 0}>
            {busy ? "Creating…" : "Create Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateOpportunityDialog({
  open,
  onOpenChange,
  accounts,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: AccountLite[];
  userId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [stage, setStage] = useState<(typeof stages)[number]>("prospect");
  const [volume, setVolume] = useState<number>(100);
  const [tier, setTier] = useState<(typeof pricingTiers)[number]>("tier_1");
  const [closeDate, setCloseDate] = useState<string>("");

  async function create() {
    setErr(null);
    if (!userId) return setErr("Not logged in.");
    if (!accountId) return setErr("Pick an account first.");
    if (!closeDate) return setErr("Expected close date is required.");
    setBusy(true);

    const { error } = await supabase.from("opportunities").insert({
      account_id: accountId,
      name: name || "Opportunity",
      stage,
      est_monthly_volume: volume,
      pricing_tier: tier,
      expected_close_date: closeDate,
      owner_user_id: userId,
    });

    setBusy(false);
    if (error) return setErr(error.message);
    onOpenChange(false);
    window.location.href = "/pipeline";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create Opportunity</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} — {a.city}, {a.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input placeholder="Opportunity name" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Select value={stage} onValueChange={(v) => setStage(v as any)}>
              <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={tier} onValueChange={(v) => setTier(v as any)}>
              <SelectTrigger><SelectValue placeholder="Pricing tier" /></SelectTrigger>
              <SelectContent>
                {pricingTiers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Est monthly volume" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </div>

          {err && <div className="text-sm text-red-400">{err}</div>}

          <Button className="rounded-2xl" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Create Opportunity"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateActivityDialog({
  open,
  onOpenChange,
  accounts,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: AccountLite[];
  userId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<(typeof activityTypes)[number]>("email");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState<string>("");

  async function create() {
    setErr(null);
    if (!userId) return setErr("Not logged in.");
    if (!accountId) return setErr("Pick an account first.");
    if (!subject) return setErr("Subject is required.");
    setBusy(true);

    const { error } = await supabase.from("activities").insert({
      account_id: accountId,
      type,
      subject,
      notes,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      completed_at: type === "task" ? null : new Date().toISOString(),
      owner_user_id: userId,
    });

    setBusy(false);
    if (error) return setErr(error.message);
    onOpenChange(false);
    window.location.href = type === "task" ? "/tasks" : "/activities";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create Activity</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} — {a.city}, {a.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {activityTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {type === "task" && (
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          )}

          {err && <div className="text-sm text-red-400">{err}</div>}

          <Button className="rounded-2xl" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Create Activity"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
