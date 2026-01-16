"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminLearningClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const r = await supabase
      .from("recommendation_events")
      .select("id,shown_at,executed_at,executed_via,surface,rec_type,rec_score,user_id,account_id,ignored_at_24h,ignored_at_7d")
      .order("shown_at", { ascending: false })
      .limit(500);
    setRows(r.data ?? []);
    setBusy(false);
  }

  useEffect(() => { load(); }, []);

  const shown = rows.length;
  const executed = rows.filter((r) => r.executed_at).length;
  const ignored24 = rows.filter((r) => r.ignored_at_24h).length;
  const ignored7 = rows.filter((r) => r.ignored_at_7d).length;

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Admin · Learning</div>
          <div className="text-xs text-muted-foreground">Recommendation follow-rate (Tier 7A)</div>
        </div>
        <Button className="rounded-2xl" variant="secondary" onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Shown</div>
          <div className="text-2xl font-semibold">{shown}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Executed</div>
          <div className="text-2xl font-semibold">{executed}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Ignored (24h)</div>
          <div className="text-2xl font-semibold">{ignored24}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Ignored (7d)</div>
          <div className="text-2xl font-semibold">{ignored7}</div>
        </Card>
      </div>

      <Card className="rounded-2xl p-4 space-y-2">
        <div className="text-sm font-semibold">Latest 500 events</div>
        <div className="space-y-2">
          {rows.slice(0, 50).map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-background/40 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{r.surface} · {r.rec_type}</div>
                <div className="text-muted-foreground">
                  score {r.rec_score ?? "—"} • {new Date(r.shown_at).toLocaleString()}
                </div>
              </div>
              <div className="text-muted-foreground">
                executed: {r.executed_at ? `${r.executed_via ?? "—"} @ ${new Date(r.executed_at).toLocaleString()}` : "no"} •
                ignored24: {r.ignored_at_24h ? "yes" : "no"} • ignored7: {r.ignored_at_7d ? "yes" : "no"}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
