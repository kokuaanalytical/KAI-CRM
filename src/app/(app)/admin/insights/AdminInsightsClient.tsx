"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Flame,
  CheckSquare,
  Timer,
  Users,
  RefreshCcw,
} from "lucide-react";

type Role = "admin" | "rep" | null;

function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 864e5).toISOString();
}

function shortId(id: string) {
  if (!id) return "";
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export default function AdminInsightsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [role, setRole] = useState<Role>(null);
  const [busy, setBusy] = useState(false);

  // display maps
  const [repLabelById, setRepLabelById] = useState<Record<string, string>>({});

  // outputs
  const [staleByRep, setStaleByRep] = useState<Array<{ repId: string; repLabel: string; stale14: number; stale30: number }>>([]);
  const [sla, setSla] = useState<{ d7: number; d14: number; d30: number }>({ d7: 0, d14: 0, d30: 0 });
  const [tasksDueByRep, setTasksDueByRep] = useState<Array<{ repId: string; repLabel: string; dueSoon: number }>>([]);
  const [claimsByDay, setClaimsByDay] = useState<Array<{ day: string; claims: number }>>([]);
  const [pipelineByStage, setPipelineByStage] = useState<Array<{ stage: string; count: number; vol: number }>>([]);

  async function loadRole() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return setRole(null);

    const r = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    setRole((r.data?.role as Role) ?? "rep");
  }

  async function loadRepDirectory() {
    // Try user_profiles first
    const u1 = await supabase.from("user_profiles").select("user_id,email").order("email", { ascending: true });

    const map: Record<string, string> = {};

    if (!u1.error) {
      (u1.data ?? []).forEach((x: any) => {
        if (!x?.user_id) return;
        if (x.email) map[x.user_id] = x.email;
      });
    }

    // Optional fallback: some projects use "profiles" with id/email
    if (Object.keys(map).length === 0) {
      const u2 = await supabase.from("profiles").select("id,email").order("email", { ascending: true });
      if (!u2.error) {
        (u2.data ?? []).forEach((x: any) => {
          if (!x?.id) return;
          if (x.email) map[x.id] = x.email;
        });
      }
    }

    setRepLabelById(map);
    return map;
  }

  function labelForRep(repId: string | null | undefined, directory: Record<string, string>) {
    if (!repId) return "Unassigned";
    const email = directory[repId];
    if (email) return email;
    return `Rep (${shortId(repId)})`;
  }

  async function loadAll() {
    setBusy(true);

    await loadRole();
    const directory = await loadRepDirectory();

    // B1: stale accounts by rep (14/30)
    const a = await supabase
      .from("accounts")
      .select("owner_user_id,last_activity_at")
      .not("owner_user_id", "is", null);

    const staleMap: Record<string, { stale14: number; stale30: number }> = {};
    (a.data ?? []).forEach((x: any) => {
      const repId = x.owner_user_id as string | null;
      if (!repId) return;

      staleMap[repId] ??= { stale14: 0, stale30: 0 };
      const last = x.last_activity_at ? new Date(x.last_activity_at).getTime() : null;
      const d = last ? Math.floor((Date.now() - last) / 864e5) : 9999;

      if (d >= 14) staleMap[repId].stale14 += 1;
      if (d >= 30) staleMap[repId].stale30 += 1;
    });

    setStaleByRep(
      Object.entries(staleMap)
        .map(([repId, v]) => ({ repId, repLabel: labelForRep(repId, directory), ...v }))
        .sort((x, y) => y.stale14 - x.stale14)
        .slice(0, 20)
    );

    // B2: Follow-up SLA overall (touched in last 7/14/30)
    const all = await supabase.from("accounts").select("id,last_activity_at");
    const total = (all.data ?? []).length || 1;
    const c7 = (all.data ?? []).filter((x: any) => x.last_activity_at && x.last_activity_at >= daysAgoIso(7)).length;
    const c14 = (all.data ?? []).filter((x: any) => x.last_activity_at && x.last_activity_at >= daysAgoIso(14)).length;
    const c30 = (all.data ?? []).filter((x: any) => x.last_activity_at && x.last_activity_at >= daysAgoIso(30)).length;
    setSla({
      d7: Math.round((c7 / total) * 100),
      d14: Math.round((c14 / total) * 100),
      d30: Math.round((c30 / total) * 100),
    });

    // B3: Tasks due soon by rep (next 7d, open only)
    const dueSoonIso = new Date(Date.now() + 7 * 864e5).toISOString();
    const t = await supabase
      .from("activities")
      .select("owner_user_id,due_at")
      .eq("type", "task")
      .is("completed_at", null)
      .lte("due_at", dueSoonIso);

    const tmap: Record<string, number> = {};
    (t.data ?? []).forEach((x: any) => {
      const repId = (x.owner_user_id as string | null) ?? "__unassigned__";
      tmap[repId] = (tmap[repId] ?? 0) + 1;
    });

    setTasksDueByRep(
      Object.entries(tmap)
        .map(([repId, n]) => ({
          repId,
          repLabel: repId === "__unassigned__" ? "Unassigned" : labelForRep(repId, directory),
          dueSoon: n,
        }))
        .sort((x, y) => y.dueSoon - x.dueSoon)
        .slice(0, 20)
    );

    // B4: Queue claims per day (from action_events)
    const e = await supabase
      .from("action_events")
      .select("created_at")
      .eq("event_type", "claim_account")
      .gte("created_at", daysAgoIso(14));

    const byDay: Record<string, number> = {};
    (e.data ?? []).forEach((x: any) => {
      const day = String(x.created_at).slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    });

    setClaimsByDay(
      Object.entries(byDay)
        .map(([day, claims]) => ({ day, claims }))
        .sort((a, b) => a.day.localeCompare(b.day))
    );

    // B5: Pipeline by stage + volume
    const p = await supabase.from("opportunities").select("stage,est_monthly_volume");
    const pmap: Record<string, { count: number; vol: number }> = {};
    (p.data ?? []).forEach((x: any) => {
      const stage = x.stage ?? "—";
      pmap[stage] ??= { count: 0, vol: 0 };
      pmap[stage].count += 1;
      pmap[stage].vol += Number(x.est_monthly_volume ?? 0);
    });

    setPipelineByStage(
      Object.entries(pmap)
        .map(([stage, v]) => ({ stage, ...v }))
        .sort((a, b) => b.vol - a.vol)
    );

    setBusy(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (role !== "admin") {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="text-sm text-muted-foreground">Admin · Insights</div>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Admins only.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Admin · Insights</div>
          <div className="text-xs text-muted-foreground">Tier 5: team ops + analytics</div>
        </div>
        <Button className="rounded-2xl" variant="secondary" onClick={loadAll} disabled={busy}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          {busy ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Timer className="h-4 w-4 text-muted-foreground" /> Follow‑up SLA
          </div>
          <div className="text-xs text-muted-foreground">Touched in last…</div>
          <div className="mt-2 space-y-1 text-sm">
            <div>7d: <b>{sla.d7}%</b></div>
            <div>14d: <b>{sla.d14}%</b></div>
            <div>30d: <b>{sla.d30}%</b></div>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" /> Queue claims
          </div>
          <div className="text-xs text-muted-foreground">Last 14 days</div>
          <div className="mt-2 space-y-1 text-sm">
            {claimsByDay.length === 0 ? (
              <div className="text-sm text-muted-foreground">No claim events yet.</div>
            ) : (
              claimsByDay.slice(-7).map((x) => (
                <div key={x.day} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{x.day}</span>
                  <b>{x.claims}</b>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> Pipeline
          </div>
          <div className="text-xs text-muted-foreground">Top stages by volume</div>
          <div className="mt-2 space-y-1 text-sm">
            {pipelineByStage.slice(0, 5).map((x) => (
              <div key={x.stage} className="flex items-center justify-between">
                <span className="truncate">{x.stage}</span>
                <span className="text-muted-foreground">
                  <b>{x.vol}</b> <span className="opacity-70">({x.count})</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-muted-foreground" /> Stale accounts by rep
          </div>
          <div className="text-xs text-muted-foreground">14d+ / 30d+</div>

          <div className="mt-2 space-y-2 text-sm">
            {staleByRep.length === 0 ? (
              <div className="text-sm text-muted-foreground">No assigned accounts found.</div>
            ) : (
              staleByRep.map((x) => (
                <div key={x.repId} className="flex items-center justify-between gap-3">
                  <div className="truncate">{x.repLabel}</div>
                  <div className="text-muted-foreground">
                    <b>{x.stale14}</b> / {x.stale30}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckSquare className="h-4 w-4 text-muted-foreground" /> Tasks due soon by rep
          </div>
          <div className="text-xs text-muted-foreground">Next 7 days (open)</div>

          <div className="mt-2 space-y-2 text-sm">
            {tasksDueByRep.length === 0 ? (
              <div className="text-sm text-muted-foreground">No open tasks due soon.</div>
            ) : (
              tasksDueByRep.map((x) => (
                <div key={x.repId} className="flex items-center justify-between gap-3">
                  <div className="truncate">{x.repLabel}</div>
                  <div className="text-muted-foreground">
                    <b>{x.dueSoon}</b>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
