"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";

type AccountMini = { id: string; name: string; city?: string; state?: string; stage?: string; notes?: string };

type Opp = {
  id: string;
  name: string;
  stage: string;
  est_monthly_volume: number;
  expected_close_date: string;
  pricing_tier: string;
  account_id: string;
};

type AiResp = {
  health: { score: number; reason: string };
  next_steps: string[];
  risk_flags: string[];
};

export function OpportunityAiPanel({ opp, account }: { opp: Opp; account: AccountMini }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AiResp | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);

    const acts = await supabase
      .from("activities")
      .select("type,subject,notes,created_at")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (acts.error) {
      setBusy(false);
      return setErr(acts.error.message);
    }

    const res = await fetch("/api/ai/opportunity-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opportunity: opp,
        account,
        activities: acts.data ?? [],
      }),
    });

    setBusy(false);

    if (!res.ok) return setErr(await res.text());
    setData((await res.json()) as AiResp);
  }

  const score = data?.health?.score ?? null;
  const label = score === null ? null : score >= 80 ? "Healthy" : score >= 55 ? "Stalled" : "At risk";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" className="rounded-2xl">AI</Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Opportunity AI
            {label && <Badge variant="secondary" className="rounded-xl">{label} • {Math.round(score!)}</Badge>}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <div className="text-sm font-semibold">{opp.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {account.name} • {account.city ?? "—"}, {account.state ?? "—"} • Stage: {opp.stage}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button className="rounded-2xl" onClick={run} disabled={busy}>
            {busy ? "Thinking…" : "Generate insights"}
          </Button>
          {err && <div className="text-sm text-red-400">{err}</div>}
        </div>

        {data && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs text-muted-foreground">Health</div>
              <Separator className="my-2" />
              <div className="text-sm">
                <span className="font-semibold">{Math.round(data.health.score)}</span>{" "}
                <span className="text-muted-foreground">— {data.health.reason}</span>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Next steps</div>
              <Separator className="my-2" />
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {data.next_steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Risks</div>
              <Separator className="my-2" />
              {data.risk_flags.length === 0 ? (
                <div className="text-sm text-muted-foreground">No major risks detected.</div>
              ) : (
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {data.risk_flags.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
