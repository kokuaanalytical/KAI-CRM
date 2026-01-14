"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { computePriorityScore, type AccountSignals } from "@/lib/priority/nextAction";

type Row = {
  id: string;
  name: string;
  stage: string | null;
  owner_user_id: string | null;
  last_activity_at: string | null;
  city: string | null;
  state: string | null;
};

export default function MyDayClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    setBusy(true);
    setErr(null);

    const res = await supabase
      .from("accounts_active")
      .select("id,name,stage,owner_user_id,last_activity_at,city,state")
      .limit(500);

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      toast({ title: "Failed to load My Day", description: res.error.message });
      setRows([]);
      return;
    }

    setRows((res.data ?? []) as any[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scored = rows
    .map((r) => {
      const s: AccountSignals = {
        id: r.id,
        name: r.name,
        stage: r.stage,
        owner_user_id: r.owner_user_id,
        last_activity_at: r.last_activity_at,
      };
      return { ...r, score: computePriorityScore(s) };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 30);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-muted-foreground">My Day</div>
          <div className="text-xs text-muted-foreground">
            Prioritized accounts (rules-based). Open an account to see Next Best Action + Draft Email.
          </div>
        </div>

        <Button className="rounded-2xl" variant="secondary" onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        {busy ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : err ? (
          <div className="text-sm text-red-400">Error: {err}</div>
        ) : scored.length === 0 ? (
          <div className="text-sm text-muted-foreground">No accounts returned.</div>
        ) : (
          <div className="space-y-2">
            {scored.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border p-3 bg-background/40">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold truncate">{a.name}</div>
                  <div className="ml-auto text-xs text-muted-foreground">Score: {a.score}/100</div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {(a.city ?? "—")}, {(a.state ?? "—")} • Stage: {a.stage ?? "—"} • Last:{" "}
                  {a.last_activity_at ? new Date(a.last_activity_at).toLocaleDateString() : "—"}
                </div>

                <div className="mt-2">
                  <Link
                    className="underline underline-offset-4 text-sm"
                    href={`/accounts?selected=${encodeURIComponent(a.id)}`}
                  >
                    Open account →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
