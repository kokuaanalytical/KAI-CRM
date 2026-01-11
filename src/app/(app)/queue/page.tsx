"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AccountRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  clia_number: string | null;
  assignment_status: string;
  owner_user_id: string | null;
  created_at: string;
};

type RepTerritory = { territory_code: string };

export default function ClaimQueuePage() {
  const [allowed, setAllowed] = useState<string[]>([]);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [stateFilter, setStateFilter] = useState<string>("ALL");

  const [dailyLimit, setDailyLimit] = useState<number>(25);
  const [claimedToday, setClaimedToday] = useState<number>(0);

  const canClaim = claimedToday < dailyLimit;

  async function loadLimits() {
    const limitRes = await supabase.from("claim_settings").select("daily_claim_limit").eq("id", 1).maybeSingle();
    // If rep can’t read settings (admin-only), just keep default 25 for UI
    if (!limitRes.error && limitRes.data?.daily_claim_limit != null) {
      setDailyLimit(Number(limitRes.data.daily_claim_limit));
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const ct = await supabase.rpc("claims_today", { uid: auth.user.id });
    if (!ct.error) setClaimedToday(Number(ct.data ?? 0));
  }

  async function loadQueue(codes: string[], filter: string) {
    setBusy(true);
    setMsg(null);

    let q = supabase
      .from("accounts")
      .select("id,name,city,state,clia_number,assignment_status,owner_user_id,created_at")
      .eq("assignment_status", "unassigned")
      .is("owner_user_id", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (codes.length) q = q.in("state", codes);
    if (filter !== "ALL") q = q.eq("state", filter);

    const res = await q;

    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    setRows((res.data ?? []) as AccountRow[]);
  }

  useEffect(() => {
    (async () => {
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return setMsg("Not logged in.");

      const terr = await supabase
        .from("rep_territories")
        .select("territory_code")
        .eq("user_id", uid);

      const codes = ((terr.data ?? []) as RepTerritory[]).map((t) => String(t.territory_code).toUpperCase());
      setAllowed(codes);

      await loadLimits();
      await loadQueue(codes, "ALL");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    await loadLimits();
    await loadQueue(allowed, stateFilter);
  }

  async function claim(accountId: string) {
    setBusy(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setBusy(false);
      return setMsg("Not logged in.");
    }

    const upd = await supabase
      .from("accounts")
      .update({
        owner_user_id: uid,
        assignment_status: "assigned",
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: uid,
      })
      .eq("id", accountId)
      .eq("assignment_status", "unassigned");

    setBusy(false);

    // If limit hit, Postgres will block and you’ll see the RLS error here
    if (upd.error) return setMsg(upd.error.message);

    await refresh();
  }

  const stateOptions = useMemo(() => ["ALL", ...allowed], [allowed]);

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Claim Queue</div>
        <Badge variant="secondary" className="rounded-xl">
          Claims today: {claimedToday}/{dailyLimit}
        </Badge>
      </div>

      <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">Unassigned accounts in your territories</div>

          <div className="flex items-center gap-2">
            <Select
              value={stateFilter}
              onValueChange={(v) => {
                setStateFilter(v);
                loadQueue(allowed, v);
              }}
            >
              <SelectTrigger className="w-56 rounded-2xl">
                <SelectValue placeholder="Filter state" />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL" ? "All my states" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="secondary" className="rounded-2xl" onClick={refresh} disabled={busy}>
              {busy ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </div>

        {!canClaim && (
          <div className="text-sm text-red-400">
            Daily claim limit reached. Try again tomorrow (or ask an admin to raise the limit).
          </div>
        )}

        {msg && <div className="text-sm text-red-400">{msg}</div>}

        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id} className="rounded-2xl border-border bg-card/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{a.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {(a.city ?? "—")}, {(a.state ?? "—")} • CLIA {a.clia_number ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-xl">
                    unassigned
                  </Badge>
                  <Button className="rounded-2xl" onClick={() => claim(a.id)} disabled={busy || !canClaim}>
                    Claim
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {rows.length === 0 && (
            <div className="text-sm text-muted-foreground">No unassigned accounts available in your territories.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
