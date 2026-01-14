"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InlineEditable } from "@/components/inline/InlineEditable";
import { ActivityTimeline } from "@/components/accounts/ActivityTimeline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { MapPin, IdCard } from "lucide-react";

const UNASSIGNED_VALUE = "__unassigned__";

export function AccountDetail({ account }: { account: any | null }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [site, setSite] = useState<any | null>(null);
  const [owners, setOwners] = useState<
    Array<{ user_id: string; email: string | null }>
  >([]);

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

      const u = await supabase
        .from("user_profiles")
        .select("user_id,email")
        .order("email", { ascending: true });

      if (!u.error) setOwners((u.data ?? []) as any[]);
    })();
  }, [account?.id, supabase]);

  if (!account) {
    return (
      <div className="text-sm text-muted-foreground">Select an account.</div>
    );
  }

  async function updateAccount(patch: Record<string, any>) {
    const res = await supabase.from("accounts").update(patch).eq("id", account.id);
    if (res.error) throw res.error;
  }

  async function updateSite(patch: Record<string, any>) {
    if (!site?.id) {
      toast({
        title: "No site found",
        description: "This account has no site record to edit yet.",
      });
      return;
    }
    const res = await supabase
      .from("account_sites")
      .update(patch)
      .eq("id", site.id);
    if (res.error) throw res.error;

    const s = await supabase
      .from("account_sites")
      .select("id,address1,city,state,clia_name,clia_number,created_at")
      .eq("id", site.id)
      .maybeSingle();
    if (!s.error) setSite(s.data ?? null);
  }

  const ownerSelectValue = account.owner_user_id ?? UNASSIGNED_VALUE;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">{account.name}</div>
          <div className="text-xs text-muted-foreground">
            {account.city ?? "—"}, {account.state ?? "—"} • CLIA:{" "}
            {account.clia_number ?? "—"}
          </div>
        </div>

        <Badge variant="secondary" className="rounded-xl">
          {account.stage ?? "—"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Stage */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Stage</div>
          <Select
            value={account.stage ?? "new"}
            onValueChange={async (v) => {
              try {
                await updateAccount({ stage: v });
                toast({ title: "Saved" });
              } catch (e: any) {
                toast({
                  title: "Save failed",
                  description: e?.message ?? String(e),
                });
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
                await updateAccount({
                  owner_user_id: v === UNASSIGNED_VALUE ? null : v,
                });
                toast({ title: "Saved" });
              } catch (e: any) {
                toast({
                  title: "Save failed",
                  description: e?.message ?? String(e),
                });
              }
            }}
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {/* ✅ IMPORTANT: NOT empty string */}
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
          value={account.phone ?? ""}
          placeholder="(808) 555-1234"
          onSave={(next) => updateAccount({ phone: next || null })}
        />

        <InlineEditable
          label="Website"
          value={account.website ?? ""}
          placeholder="https://example.com"
          onSave={(next) => updateAccount({ website: next || null })}
        />

        <InlineEditable
          label="Notes"
          value={account.notes ?? ""}
          placeholder="Internal notes…"
          multiline
          onSave={(next) => updateAccount({ notes: next })}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card/20 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-muted-foreground" /> Site (address)
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InlineEditable
            label="Address1"
            value={site?.address1 ?? ""}
            placeholder="123 Main St"
            onSave={(next) => updateSite({ address1: next || null })}
          />
          <InlineEditable
            label="City"
            value={site?.city ?? ""}
            placeholder="Honolulu"
            onSave={(next) => updateSite({ city: next || null })}
          />
          <InlineEditable
            label="State"
            value={site?.state ?? ""}
            placeholder="HI"
            onSave={(next) => updateSite({ state: next || null })}
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
            onSave={(next) => updateSite({ clia_name: next || null })}
          />
          <InlineEditable
            label="CLIA Number"
            value={site?.clia_number ?? ""}
            placeholder="CLIA #"
            onSave={(next) => updateSite({ clia_number: next || null })}
          />
        </div>
      </div>

      <ActivityTimeline accountId={account.id} />
    </div>
  );
}
