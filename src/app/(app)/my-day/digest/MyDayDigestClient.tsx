"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MyDayDigestClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    await fetch("/api/nudges/generate", { method: "POST" }); // best-effort
    const r = await supabase
      .from("nudges")
      .select("id,created_at,kind,severity,title,body,account_id,due_at,dismissed_at")
      .is("dismissed_at", null)
      .order("due_at", { ascending: false })
      .limit(100);
    setRows(r.data ?? []);
    setBusy(false);
  }

  async function dismiss(id: string) {
    await fetch("/api/nudges/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRows((prev) => prev.filter((x) => x.id !== id));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">My Day · Digest</div>
          <div className="text-xs text-muted-foreground">Weekdays-only nudges · all triggers enabled</div>
        </div>
        <Button className="rounded-2xl" variant="secondary" onClick={load} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <Card className="rounded-2xl p-4 space-y-2">
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No nudges right now.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((n) => (
              <div key={n.id} className="rounded-2xl border border-border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.body}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {n.kind} • {n.severity}
                    </div>
                  </div>
                  <Button className="rounded-2xl" variant="secondary" onClick={() => dismiss(n.id)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
