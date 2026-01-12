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

type Insight = {
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  action?: {
    label: string;
    type: string;
    payload?: Record<string, any>;
  };
};

export function AccountOpportunities({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<Opp[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [insightsByOpp, setInsightsByOpp] = useState<Record<string, Insight[]>>({});
  const [insightsLoading, setInsightsLoading] = useState<Record<string, boolean>>({});

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

  async function loadInsights(opportunity_id: string) {
    try {
      setInsightsLoading((prev) => ({ ...prev, [opportunity_id]: true }));

      const res = await fetch("/api/ai/opportunity-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id }),
      });

      if (!res.ok) {
        setInsightsLoading((prev) => ({ ...prev, [opportunity_id]: false }));
        return;
      }

      const json = await res.json();

      setInsightsByOpp((prev) => ({
        ...prev,
        [opportunity_id]: (json.insights ?? []) as Insight[],
      }));
      setInsightsLoading((prev) => ({ ...prev, [opportunity_id]: false }));
    } catch {
      setInsightsLoading((prev) => ({ ...prev, [opportunity_id]: false }));
      // Insights should never break the opportunities screen
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // After opportunities load, fetch insights per opportunity (once)
  useEffect(() => {
    for (const o of items) {
      if (!insightsByOpp[o.id] && !insightsLoading[o.id]) {
        loadInsights(o.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div className="space-y-3">
      {err && <div className="text-sm text-red-400">{err}</div>}

      {items.map((o) => {
        const insights = insightsByOpp[o.id] ?? [];
        const loading = !!insightsLoading[o.id];

        return (
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

            {/* Insights */}
            <div className="mt-3">
              {loading && insights.length === 0 && (
                <div className="text-xs text-muted-foreground">Loading insights…</div>
              )}

              {insights.length > 0 && (
                <div className="space-y-2">
                  {insights.map((i, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 text-xs ${
                        i.severity === "critical"
                          ? "border-red-500/40 bg-red-500/10"
                          : i.severity === "warn"
                          ? "border-yellow-500/40 bg-yellow-500/10"
                          : "border-border bg-card/30"
                      }`}
                    >
                      <div className="font-semibold">{i.title}</div>
                      <div className="text-muted-foreground">{i.detail}</div>

                      {i.action?.label && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="rounded-xl">
                            {i.action.label}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {items.length === 0 && (
        <div className="text-sm text-muted-foreground">No opportunities yet.</div>
      )}
    </div>
  );
}
