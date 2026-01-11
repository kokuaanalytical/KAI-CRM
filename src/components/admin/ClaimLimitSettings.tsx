"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClaimLimitSettings() {
  const [limit, setLimit] = useState<number>(25);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    const res = await supabase
      .from("claim_settings")
      .select("daily_claim_limit")
      .eq("id", 1)
      .maybeSingle();

    if (res.error) return setMsg(res.error.message);
    if (res.data?.daily_claim_limit != null) {
      setLimit(Number(res.data.daily_claim_limit));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);

    const res = await supabase
      .from("claim_settings")
      .update({ daily_claim_limit: limit })
      .eq("id", 1);

    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    setMsg("Saved.");
  }

  return (
    <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
      <div className="text-sm font-semibold">Claim Limits</div>
      <div className="text-xs text-muted-foreground">
        Database‑enforced daily claim limit per rep.
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="w-32"
        />
        <Button className="rounded-2xl" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="secondary"
          className="rounded-2xl"
          onClick={load}
          disabled={busy}
        >
          Refresh
        </Button>
      </div>

      {msg && <div className="text-sm text-muted-foreground">{msg}</div>}
    </Card>
  );
}
