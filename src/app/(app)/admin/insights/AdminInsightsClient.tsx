"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Rep = { user_id: string; email: string | null };
type Role = "admin" | "rep" | null;

function daysAgo(n: number) {
  return new Date(Date.now() - n * 864e5).toISOString();
}

export default function AdminInsightsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [role, setRole] = useState<Role>(null);
  const [busy, setBusy] = useState(false);

  const [reps, setReps] = useState<Rep[]>([]);
  const [staleByRep, setStaleByRep] = useState<Array<{ rep: string; stale14: number; stale30: number }>>([]);
  const [sla, setSla] = useState<{ d7: number; d14: number; d30: number }>({ d7: 0, d14: 0, d30: 0 });
  const [tasksDueByRep, setTasksDueByRep] = useState<Array<{ rep: string; dueSoon: number }>>([]);
  const [claimsByDay, setClaimsByDay] = useState<Array<{ day: string; claims: number }>>([]);
  const [pipelineByStage, setPipelineByStage] = useState<Array<{ stage: string; count: number; vol: number }>>([]);

  async function loadRole() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return setRole(null);

    const r = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    setRole((r.data?.role as Role) ?? "rep");
  }

  async function loadAll() {
    setBusy(true);

    await loadRole();

    // reps directory (for labels)
    const u = await supabase.from("user_profiles").select("user_id,email").order("email", { ascending: true });
    setReps((u.data ?? []) as any[]);
    const repEmail = new Map((u.data ?? []).map((x: any) => [x.user_id, x.email ?? x.user_id]));

    // B1: stale accounts by rep (14/30)
    const a = await supabase
      .from("accounts")
      .select("owner_user_id,last_activity_at")
      .not("owner_user_id", "is", null);

    const map: Record<string, { stale14: number; stale30: number }> = {};
    (a.data ?? []).forEach((x: any) => {
      const rep = x.owner_user_id;
      if (!rep) return;
      map[rep] ??= { stale14: 0, stale30: 0 };
      const last = x.last_activity_at ? new Date(x.last_activity_at).getTime() : null;
      const d = last ? Math.floor((Date.now() - last) / 864e5) : 9999;
      if (d >= 14) map[rep].stale14 += 1;
      if (d >= 30) map[rep].stale30 += 1;
    });

    setStaleByRep(
      Object.entries(map)
        .map(([rep, v]) => ({ rep: repEmail.get(rep) ?? rep, ...v }))
        .sort((x, y) => y.stale14 - x.stale14)
        .slice(0, 20)
    );

    // B2: Follow-up SLA overall (touched in last 7/14/30)
    const all = await supabase.from("accounts").select("id,last_activity_at");
    const total = (all.data ?? []).length || 1;
    const c7 = (all.data ?? []).filter((x: any) => x.last_activity_at && x.last_activity_at >= daysAgo(7)).length;
    const c14 = (all.data ?? []).filter((x: any) => x.last_activity_at && x.last_activity_at >= daysAgo(14)).length;
    const c30 = (all.data ?? []).filter((x: any) => x.last_activity_at && x.last_activity_at >= daysAgo(30)).length;
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
      const rep = x.owner_user_id ?? "unassigned";
      tmap[rep] = (tmap[rep] ?? 0) + 1;
    });

    setTasksDueByRep(
      Object.entries(tmap)
        .map(([rep, n]) => ({ rep: repEmail.get(rep) ?? rep, dueSoon: n }))
        .sort((x, y) => y.dueSoon - x.dueSoon)
        .slice(0, 20)
    );

    // B4: Queue claims per day (from action_events)
    const e = await supabase
      .from("action_events")
      .select("created_at")
      .eq("event_type", "claim_account")
      .gte("created_at", daysAgo(14));

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
          {busy ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm font-semibold">Follow-up SLA</div>
          <div className="text-xs text-muted-foreground mt-1">Touched in last…</div>
          <div className="mt-3 space-y-1 text-sm">
            <div>7d: <b>{sla.d7}%</b></div>
            <div>14d: <b>{sla.d14}%</b></div>
            <div>30d: <b>{sla.d30}%</b></div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Queue claims</div>
          <div className="text-xs text-muted-foreground mt-1">Last 14 days</div>
          <div className="mt-3 space-y-1 text-sm">
            {claimsByDay.slice(-7).map((x) => (
              <div key={x.day}>{x.day}: <b>{x.claims}</b></div>
            ))}
            {claimsByDay.length === 0 && <div className="text-sm text-muted-foreground">No claim events yet.</div>}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Pipeline</div>
          <div className="text-xs text-muted-foreground mt-1">Top stages by volume</div>
          <div className="mt-3 space-y-1 text-sm">
            {pipelineByStage.slice(0, 5).map((x) => (
              <div key={x.stage}>
                {x.stage}: <b>{x.vol}</b> ({x.count})
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-semibold">Stale accounts by rep</div>
          <div className="text-xs text-muted-foreground mt-1">14d+ / 30d+</div>
          <div className="mt-3 space-y-2 text-sm">
            {staleByRep.map((x) => (
              <div key={x.rep} className="flex items-center justify-between">
                <div className="truncate">{x.rep}</div>
                <div className="text-muted-foreground">
                  <b>{x.stale14}</b> / {x.stale30}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Tasks due soon by rep</div>
          <div className="text-xs text-muted-foreground mt-1">Next 7 days (open)</div>
          <div className="mt-3 space-y-2 text-sm">
            {tasksDueByRep.map((x) => (
              <div key={x.rep} className="flex items-center justify-between">
                <div className="truncate">{x.rep}</div>
                <div className="text-muted-foreground">
                  <b>{x.dueSoon}</b>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
