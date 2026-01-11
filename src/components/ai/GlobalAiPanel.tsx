"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AccountLite = {
  id: string;
  name: string;
  city: string;
  state: string;
  clia_name: string;
  clia_number: string;
  phone: string;
  website: string;
  stage: string;
  notes: string;
};

type AiResult = {
  summary_bullets: string[];
  next_steps: string[];
  risk_flags: string[];
  health: { score: number; reason: string };
  email_draft: string;
};

export function GlobalAiPanel() {
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AiResult | null>(null);

  useEffect(() => {
    (async () => {
      const a = await supabase
        .from("accounts")
        .select("id,name,city,state,clia_name,clia_number,phone,website,stage,notes")
        .order("updated_at", { ascending: false })
        .limit(300);

      if (!a.error) setAccounts((a.data ?? []) as AccountLite[]);
    })();
  }, []);

  async function runAI() {
    setErr(null);
    setData(null);

    const account = accounts.find((a) => a.id === accountId);
    if (!account) return setErr("Pick an account first.");

    setBusy(true);

    const acts = await supabase
      .from("activities")
      .select("type,subject,notes,created_at")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const opps = await supabase
      .from("opportunities")
      .select("name,stage,est_monthly_volume,expected_close_date,pricing_tier")
      .eq("account_id", account.id)
      .order("expected_close_date", { ascending: true })
      .limit(25);

    if (acts.error) {
      setBusy(false);
      return setErr(acts.error.message);
    }
    if (opps.error) {
      setBusy(false);
      return setErr(opps.error.message);
    }

    const res = await fetch("/api/ai/account-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account,
        activities: acts.data ?? [],
        opportunities: opps.data ?? [],
      }),
    });

    setBusy(false);

    if (!res.ok) return setErr((await res.text()) || "AI request failed.");
    setData((await res.json()) as AiResult);
  }

  const score = data?.health?.score ?? null;
  const label = score === null ? null : score >= 80 ? "Healthy" : score >= 55 ? "Stalled" : "At risk";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" className="rounded-2xl">
          AI
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Kai AI
            {label && score !== null && (
              <Badge variant="secondary" className="rounded-xl">
                {label} • {Math.round(score)}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Choose an account…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} — {a.city}, {a.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button className="rounded-2xl" onClick={runAI} disabled={busy}>
              {busy ? "Thinking…" : "Generate insights"}
            </Button>
            {err && <div className="text-sm text-red-400">{err}</div>}
          </div>

          {data && (
            <Tabs defaultValue="summary">
              <TabsList className="rounded-2xl">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="next">Next steps</TabsTrigger>
                <TabsTrigger value="risks">Risks</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4 space-y-2">
                <div className="text-xs text-muted-foreground">Account summary</div>
                <Separator />
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {data.summary_bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="next" className="mt-4 space-y-2">
                <div className="text-xs text-muted-foreground">Suggested next actions</div>
                <Separator />
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {data.next_steps.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="risks" className="mt-4 space-y-2">
                <div className="text-xs text-muted-foreground">Risk flags</div>
                <Separator />
                {data.risk_flags.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No major risks detected.</div>
                ) : (
                  <ul className="list-disc space-y-2 pl-5 text-sm">
                    {data.risk_flags.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 text-xs text-muted-foreground">
                  Health: {Math.round(data.health.score)} — {data.health.reason}
                </div>
              </TabsContent>

              <TabsContent value="email" className="mt-4 space-y-2">
                <div className="text-xs text-muted-foreground">Draft follow-up email</div>
                <Separator />
                <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-card/40 p-3 text-sm">
                  {data.email_draft}
                </pre>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
