"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OpportunityAiPanel } from "@/components/ai/OpportunityAiPanel";

type Opp = {
  id: string;
  account_id: string;
  name: string;
  stage: string;
  est_monthly_volume: number;
  expected_close_date: string;
  pricing_tier: string;
  account: { id: string; name: string; city: string; state: string; stage: string; notes: string }[];
};

const STAGES = ["prospect","contacted","qualified","proposal","negotiation","won","lost"] as const;

export default function PipelinePage() {
  const [opps, setOpps] = useState<Opp[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id,account_id,name,stage,est_monthly_volume,expected_close_date,pricing_tier, account:accounts(id,name,city,state,stage,notes)"
        )
        .order("expected_close_date", { ascending: true })
        .limit(500);

      if (error) console.error(error);
      setOpps((data ?? []) as Opp[]);
    })();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Opp[]> = {};
    STAGES.forEach((s) => (map[s] = []));
    for (const o of opps) (map[o.stage] ?? (map[o.stage] = [])).push(o);
    return map;
  }, [opps]);

  return (
    <div className="h-full">
      <div className="mb-3 text-sm text-muted-foreground">Pipeline</div>

      <ScrollArea className="h-[calc(100%-24px)] rounded-2xl border border-border bg-card/20 p-3">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((s) => (
            <div key={s} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{s}</div>
                <Badge variant="secondary" className="rounded-xl">{grouped[s].length}</Badge>
              </div>

              {grouped[s].map((o) => {
                const acct = o.account?.[0];
                return (
                  <Card key={o.id} className="rounded-2xl border-border bg-card/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{o.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {acct?.name ?? "—"} • {acct?.city ?? "—"}, {acct?.state ?? "—"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className="rounded-xl">AI</Badge>
                        {acct && (
                          <OpportunityAiPanel
                            opp={{
                              id: o.id,
                              account_id: o.account_id,
                              name: o.name,
                              stage: o.stage,
                              est_monthly_volume: o.est_monthly_volume,
                              expected_close_date: o.expected_close_date,
                              pricing_tier: o.pricing_tier,
                            }}
                            account={{
                              id: acct.id,
                              name: acct.name,
                              city: acct.city,
                              state: acct.state,
                              stage: acct.stage,
                              notes: acct.notes,
                            }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      Vol: {o.est_monthly_volume} • Tier: {o.pricing_tier} • Close: {o.expected_close_date}
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
