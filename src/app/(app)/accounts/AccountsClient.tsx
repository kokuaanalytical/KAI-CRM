"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountDetail } from "@/components/accounts/AccountDetail";

const PAGE_SIZE = 200;

// Local error boundary so /accounts doesn't white-screen
class RightPaneErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("AccountDetail crashed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-border bg-card/20 p-4 space-y-2">
          <div className="text-sm font-semibold text-red-300">Account detail crashed</div>
          <div className="text-xs text-muted-foreground">
            This is the real runtime error (check console too).
          </div>
          <pre className="text-xs whitespace-pre-wrap text-red-200">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack ?? ""}
          </pre>

          <Button
            className="rounded-2xl"
            variant="secondary"
            onClick={() => this.setState({ error: null })}
          >
            Clear error
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AccountsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("selected");

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  function selectAccount(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("selected", id);
    router.push(`/accounts?${next.toString()}`);
  }

  async function load() {
    setBusy(true);
    setErr(null);

    let qb = supabase
      .from("accounts_active")
      .select("id,name,city,state,clia_number,stage,phone,website,last_activity_at,owner_user_id")
      .order("last_activity_at", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true })
      .limit(PAGE_SIZE);

    const q = query.trim();
    if (q) {
      const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      qb = qb.or(
        `name.ilike.${like},city.ilike.${like},state.ilike.${like},clia_number.ilike.${like}`
      );
    }

    const res = await qb;
    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      setAccounts([]);
      return;
    }

    setAccounts((res.data ?? []) as any[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid h-[calc(100dvh-64px)] min-h-0 grid-cols-1 gap-4 md:grid-cols-[420px_1fr]">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search targets…"
            className="rounded-2xl"
          />
          <Button className="rounded-2xl" variant="secondary" onClick={load} disabled={busy}>
            {busy ? "Loading…" : "Search"}
          </Button>
        </div>

        {err ? <div className="text-sm text-red-400">{err}</div> : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card/20 p-3">
          {accounts.length === 0 && !busy ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No matching accounts.</div>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  selected={a.id === selectedId}
                  onSelect={() => selectAccount(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="h-full min-h-0 overflow-auto rounded-2xl border border-border bg-card/20 p-3">
        <RightPaneErrorBoundary>
          <AccountDetail account={selected} />
        </RightPaneErrorBoundary>
      </div>
    </div>
  );
}
