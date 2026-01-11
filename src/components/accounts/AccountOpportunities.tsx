"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Opp = {
  id: string;
  name: string;
  stage: string;
  est_monthly_volume: number;
  expected_close_date: string;
  pricing_tier: string;
  created_at: string;
};

export function AccountOpportunities({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<Opp[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("opportunities")
      .select("id,name,stage,est_monthly_volume,expected_close_date,pricing_tier,created_at")
      .eq("account_id", accountId)
      .order("expected_close_date", { ascending: true })
      .limit(200);

    if (error) return setErr(error.message);
    setItems((data ?? []) as Opp[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  return (
    <div className="space-y-3">
      {err && <div className="text-sm text-red-400">{err}</div>}

      {items.map((o) => (
        <Card key={o.id} className="rounded-2xl border-border bg-card/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{o.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Close: {o.expected_close_date} • Tier: {o.pricing_tier} • Vol: {o.est_monthly_volume}
              </div>
            </div>
            <Badge variant="secondary" className="rounded-xl">
              {o.stage}
            </Badge>
          </div>
        </Card>
      ))}

      {items.length === 0 && (
        <div className="text-sm text-muted-foreground">No opportunities yet.</div>
      )}
    </div>
  );
}
