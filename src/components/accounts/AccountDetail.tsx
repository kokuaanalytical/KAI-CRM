"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InlineEditable } from "@/components/inline/InlineEditable";
import { ActivityTimeline } from "@/components/accounts/ActivityTimeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MapPin, IdCard, Sparkles, Users } from "lucide-react";
import { AccountFlagsBar } from "@/components/accounts/AccountFlagsBar";
import { NextBestActionPanel } from "@/components/ai/NextBestActionPanel";

const UNASSIGNED_VALUE = "__unassigned__";

type ContactRow = {
  id: string;
  account_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  created_at?: string | null;
};

type OwnerRow = { user_id: string; email: string | null };

type Props = {
  account: any | null;
  onAccountUpdated?: (next: any) => void;
};

export function AccountDetail({ account, onAccountUpdated }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  // Local account state so UI doesn’t “revert” when parent list is stale
  const [acct, setAcct] = useState<any | null>(account);

  const [site, setSite] = useState<any | null>(null);
  const [owners, setOwners] = useState<OwnerRow[]>([]);

  // flags + ai summary
  const [flags, setFlags] = useState<{ stale_30?: boolean; unassigned_7?: boolean } | null>(null);
  const [flagsBusy, setFlagsBusy] = useState(false);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiUpdatedAt, setAiUpdatedAt] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  // contacts
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsBusy, setContactsBusy] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");

  // Reset local acct when selection changes
  useEffect(() => {
    setAcct(account);
  }, [account?.id]);

  useEffect(() => {
    if (!account?.id) return;

    (async () => {
      const s = await supabase
        .from("account_sites")
        .select("id,address1,city,state,clia_name,clia_number,created_at")
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!s.error) setSite(s.data ?? null);

      const u = await supabase.from("user_profiles").select("user_id,email").order("email", { ascending: true });
      if (!u.error) setOwners((u.data ?? []) as any[]);

      await loadFlags(account.id);

      const a = await supabase
        .from("accounts")
        .select("ai_summary,ai_summary_updated_at")
        .eq("id", account.id)
        .maybeSingle();
      if (!a.error) {
        setAiSummary(a.data?.ai_summary ?? null);
        setAiUpdatedAt(a.data?.ai_summary_updated_at ?? null);
      }

      await loadContacts(account.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  if (!acct) {
    return <div className="text-sm text-muted-foreground">Select an account.</div>;
  }

  // IMPORTANT: do NOT use .single() here. If RLS blocks update, returned rows = 0, and .single() throws.
  async function updateAccount(patch: Record<string, any>) {
    const res = await supabase.from("accounts").update(patch).eq("id", acct.id).select("*");

    if (res.error) throw res.error;

    const updated = res.data?.[0] ?? null;
    if (!updated) {
      throw new Error("No rows updated (permission/RLS blocked or wrong account id).");
    }

    setAcct(updated);
    onAccountUpdated?.(updated);
    return updated;
  }

  async function updateSite(patch: Record<string, any>) {
    if (!site?.id) {
      toast({
        title: "No site found",
        description: "This account has no site record to edit yet.",
      });
      return null;
    }

    const res = await supabase
      .from("account_sites")
      .update(patch)
      .eq("id", site.id)
      .select("id,address1,city,state,clia_name,clia_number,created_at");

    if (res.error) throw res.error;

    const updated = res.data?.[0] ?? null;
    if (!updated) {
      throw new Error("No site rows updated (permission/RLS blocked).");
    }

    setSite(updated);
    return updated;
  }

  async function loadFlags(accountId: string) {
    const f = await supabase
      .from("account_flags")
      .select("stale_30,unassigned_7")
      .eq("account_id", accountId)
      .maybeSingle();
    if (!f.error) setFlags(f.data ?? { stale_30: false, unassigned_7: false });
  }

  async function refreshFlagsNow() {
    try {
      setFlagsBusy(true);
      const r = await supabase.rpc("refresh_account_flags");
      if (r.error) throw r.error;
      await loadFlags(acct.id);
      toast({ title: "Flags refreshed" });
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e?.message ?? String(e) });
    } finally {
      setFlagsBusy(false);
    }
  }

  async function runAiSummary() {
    try {
      setAiBusy(true);
      const res = await fetch("/api/ai/account-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: acct.id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "AI summary failed");

      setAiSummary(json.summary ?? null);
      setAiUpdatedAt(new Date().toISOString());
      toast({ title: "AI summary updated" });
    } catch (e: any) {
      toast({ title: "AI summary failed", description: e?.message ?? String(e) });
    } finally {
      setAiBusy(false);
    }
  }

  async function loadContacts(accountId: string) {
    setContactsBusy(true);
    try {
      const r = await supabase
        .from("contacts")
        .select("id,account_id,name,email,phone,title,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (r.error) throw r.error;
      setContacts((r.data ?? []) as ContactRow[]);
    } catch (e: any) {
      console.error("loadContacts failed:", e);
      setContacts([]);
    } finally {
      setContactsBusy(false);
    }
  }

  async function createContact() {
    if (!acct?.id) return;

    const name = cName.trim();
    if (!name) {
      toast({ title: "Name required", description: "Enter a contact name." });
      return;
    }

    try {
      setContactsBusy(true);

      const ins = await supabase.from("contacts").insert({
        account_id: acct.id,
        name,
        title: cTitle.trim() || null,
        email: cEmail.trim() || null,
        phone: cPhone.trim() || null,
      });

      if (ins.error) throw ins.error;

      toast({ title: "Contact added" });

      setContactOpen(false);
      setCName("");
      setCTitle("");
      setCEmail("");
      setCPhone("");

      await loadContacts(acct.id);
    } catch (e: any) {
      toast({ title: "Add contact failed", description: e?.message ?? String(e) });
    } finally {
      setContactsBusy(false);
    }
  }

  const ownerSelectValue = acct.owner_user_id ?? UNASSIGNED_VALUE;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">{acct.name}</div>
          <div className="text-xs text-muted-foreground">
            {acct.city ?? "—"}, {acct.state ?? "—"} • CLIA: {acct.clia_number ?? "—"}
          </div>
        </div>

        <Badge variant="secondary" className="rounded-xl">
          {acct.stage ?? "—"}
        </Badge>
      </div>

      <AccountFlagsBar flags={flags} onRefresh={refreshFlagsNow} busy={flagsBusy} />

      <div className="rounded-2xl border border-border bg-card/20 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" /> AI Summary
          </div>
          <Button className="rounded-2xl" onClick={runAiSummary} disabled={aiBusy}>
            {aiBusy ? "Summarizing…" : "Summarize"}
          </Button>
        </div>

        {aiUpdatedAt ? (
          <div className="text-xs text-muted-foreground">Updated: {new Date(aiUpdatedAt).toLocaleString()}</div>
        ) : (
          <div className="text-xs text-muted-foreground">No summary yet.</div>
        )}

        {aiSummary ? <div className="text-sm whitespace-pre-wrap">{aiSummary}</div> : null}
      </div>

      <NextBestActionPanel account={acct} flags={flags} />

      {/* Contacts */}
      <div className="rounded-2xl border border-border bg-card/20 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Contacts
          </div>
          <Button className="rounded-2xl" variant="secondary" onClick={() => setContactOpen(true)}>
            Add contact
          </Button>
        </div>

        {contactsBusy ? (
          <div className="text-sm text-muted-foreground">Loading contacts…</div>
        ) : contacts.length === 0 ? (
          <div className="text-sm text-muted-foreground">No contacts yet.</div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{c.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.title ?? "—"}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-1">
                    {c.email ? (
                      <div>
                        <a className="hover:underline" href={`mailto:${c.email}`}>
                          {c.email}
                        </a>
                      </div>
                    ) : null}
                    {c.phone ? (
                      <div>
                        <a className="hover:underline" href={`tel:${c.phone}`}>
                          {c.phone}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Name (required)" className="rounded-2xl" />
            <Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Title (optional)" className="rounded-2xl" />
            <Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="Email (optional)" className="rounded-2xl" />
            <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="Phone (optional)" className="rounded-2xl" />

            <div className="flex items-center justify-end gap-2">
              <Button className="rounded-2xl" variant="secondary" onClick={() => setContactOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-2xl" onClick={createContact} disabled={contactsBusy}>
                {contactsBusy ? "Saving…" : "Save contact"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Stage */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Stage</div>
          <Select
            value={acct.stage ?? "new"}
            onValueChange={async (v) => {
              try {
                await updateAccount({ stage: v });

                const { data: auth } = await supabase.auth.getUser();
                const uid = auth.user?.id;
                if (uid) {
                  await supabase.from("action_events").insert({
                    user_id: uid,
                    account_id: acct.id,
                    event_type: "stage_changed",
                    meta: { stage: v },
                  });
                }

                toast({ title: "Saved" });
              } catch (e: any) {
                toast({ title: "Save failed", description: e?.message ?? String(e) });
              }
            }}
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Owner */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Owner</div>
          <Select
            value={ownerSelectValue}
            onValueChange={async (v) => {
              try {
                const nextOwner = v === UNASSIGNED_VALUE ? null : v;

                await updateAccount({ owner_user_id: nextOwner });

                const { data: auth } = await supabase.auth.getUser();
                const uid = auth.user?.id;
                if (uid) {
                  await supabase.from("action_events").insert({
                    user_id: uid,
                    account_id: acct.id,
                    event_type: "owner_changed",
                    meta: { owner_user_id: nextOwner },
                  });
                }

                toast({ title: "Saved" });
                await loadFlags(acct.id);
              } catch (e: any) {
                toast({ title: "Save failed", description: e?.message ?? String(e) });
              }
            }}
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.user_id} value={o.user_id}>
                  {o.email ?? o.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <InlineEditable
          label="Phone"
          value={acct.phone ?? ""}
          placeholder="(808) 555-1234"
          onSave={async (next) => {
            await updateAccount({ phone: next?.trim() ? next.trim() : null });
            toast({ title: "Saved" });
          }}
        />

        <InlineEditable
          label="Website"
          value={acct.website ?? ""}
          placeholder="https://example.com"
          onSave={async (next) => {
            await updateAccount({ website: next?.trim() ? next.trim() : null });
            toast({ title: "Saved" });
          }}
        />

        <InlineEditable
          label="Notes"
          value={acct.notes ?? ""}
          placeholder="Internal notes…"
          multiline
          onSave={async (next) => {
            await updateAccount({ notes: next ?? "" });
            toast({ title: "Saved" });
          }}
        />
      </div>

      {/* Site */}
      <div className="rounded-2xl border border-border bg-card/20 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-muted-foreground" /> Site (address)
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InlineEditable
            label="Address1"
            value={site?.address1 ?? ""}
            placeholder="123 Main St"
            onSave={async (next) => {
              await updateSite({ address1: next?.trim() ? next.trim() : null });
              toast({ title: "Saved" });
            }}
          />
          <InlineEditable
            label="City"
            value={site?.city ?? ""}
            placeholder="Honolulu"
            onSave={async (next) => {
              await updateSite({ city: next?.trim() ? next.trim() : null });
              toast({ title: "Saved" });
            }}
          />
          <InlineEditable
            label="State"
            value={site?.state ?? ""}
            placeholder="HI"
            onSave={async (next) => {
              await updateSite({ state: next?.trim() ? next.trim() : null });
              toast({ title: "Saved" });
            }}
          />
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold pt-2">
          <IdCard className="h-4 w-4 text-muted-foreground" /> Site (CLIA)
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InlineEditable
            label="CLIA Name"
            value={site?.clia_name ?? ""}
            placeholder="CLIA Name"
            onSave={async (next) => {
              await updateSite({ clia_name: next?.trim() ? next.trim() : null });
              toast({ title: "Saved" });
            }}
          />
          <InlineEditable
            label="CLIA Number"
            value={site?.clia_number ?? ""}
            placeholder="CLIA #"
            onSave={async (next) => {
              await updateSite({ clia_number: next?.trim() ? next.trim() : null });
              toast({ title: "Saved" });
            }}
          />
        </div>
      </div>

      <ActivityTimeline
        accountId={acct.id}
        onActivityCreated={async () => {
          await loadFlags(acct.id);
          await runAiSummary();
        }}
      />
    </div>
  );
}