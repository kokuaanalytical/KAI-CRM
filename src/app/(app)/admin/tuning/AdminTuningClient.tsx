"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computePriorityScore, type PriorityWeights, type AccountSignals } from "@/lib/priority/nextAction";

type Role = "admin" | "ops" | "rep" | null;

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground">{value}</div>
      </div>
      <input
        type="range"
        min={-40}
        max={60}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function AdminTuningClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [role, setRole] = useState<Role>(null);
  const [busy, setBusy] = useState(false);

  const [w, setW] = useState<PriorityWeights>({
    w_stale: 35,
    w_stage: 20,
    w_unassigned: 20,
    w_tasks_due: 16,
    w_tasks_total: 8,
    w_recent_activity: -10,
    w_volume: 10,
  });

  const [rows, setRows] = useState<any[]>([]);

  async function loadRole() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return setRole(null);
    const r = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    setRole((r.data?.role as Role) ?? "rep");
  }

  async function load() {
    setBusy(true);
    await loadRole();

    const pw = await supabase.from("priority_weights").select("*").eq("id", 1).maybeSingle();
    if (!pw.error && pw.data) {
      setW({
        w_stale: pw.data.w_stale,
        w_stage: pw.data.w_stage,
        w_unassigned: pw.data.w_unassigned,
        w_tasks_due: pw.data.w_tasks_due,
        w_tasks_total: pw.data.w_tasks_total,
        w_recent_activity: pw.data.w_recent_activity,
        w_volume: pw.data.w_volume,
      });
    }

    const a = await supabase
      .from("accounts_active")
      .select("id,name,stage,owner_user_id,last_activity_at,city,state")
      .limit(250);

    setRows(a.data ?? []);
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;

    const res = await supabase.from("priority_weights").update({
      ...w,
      updated_at: new Date().toISOString(),
      updated_by: uid,
    }).eq("id", 1);

    setBusy(false);
    if (res.error) alert(res.error.message);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (role !== "admin" && role !== "ops") {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="text-sm text-muted-foreground">Admin · Tuning</div>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Admins + ops only.</div>
        </Card>
      </div>
    );
  }

  const preview = (rows ?? [])
    .map((r) => {
      const s: AccountSignals = {
        id: r.id,
        name: r.name,
        stage: r.stage,
        owner_user_id: r.owner_user_id,
        last_activity_at: r.last_activity_at,
      };
      return { ...r, score: computePriorityScore(s, w) };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 25);

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Admin · Tuning</div>
          <div className="text-xs text-muted-foreground">Adjust scoring weights (live preview)</div>
        </div>
        <div className="flex gap-2">
          <Button className="rounded-2xl" variant="secondary" onClick={load} disabled={busy}>Refresh</Button>
          <Button className="rounded-2xl" onClick={save} disabled={busy}>Save weights</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4 space-y-3">
          <SliderRow label="Stale weight" value={w.w_stale} onChange={(n) => setW({ ...w, w_stale: n })} />
          <SliderRow label="Stage weight" value={w.w_stage} onChange={(n) => setW({ ...w, w_stage: n })} />
          <SliderRow label="Unassigned weight" value={w.w_unassigned} onChange={(n) => setW({ ...w, w_unassigned: n })} />
          <SliderRow label="Tasks due weight" value={w.w_tasks_due} onChange={(n) => setW({ ...w, w_tasks_due: n })} />
          <SliderRow label="Tasks total weight" value={w.w_tasks_total} onChange={(n) => setW({ ...w, w_tasks_total: n })} />
          <SliderRow label="Recent activity weight" value={w.w_recent_activity} onChange={(n) => setW({ ...w, w_recent_activity: n })} />
          <SliderRow label="Volume weight" value={w.w_volume} onChange={(n) => setW({ ...w, w_volume: n })} />
        </Card>

        <Card className="p-4 space-y-2">
          <div className="text-sm font-semibold">Preview: top 25 accounts</div>
          <div className="text-xs text-muted-foreground">What My Day would look like with current weights</div>
          <div className="mt-2 space-y-2">
            {preview.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border p-3 bg-background/40">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground">Score {a.score}/100</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {(a.city ?? "—")}, {(a.state ?? "—")} • Stage: {a.stage ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
