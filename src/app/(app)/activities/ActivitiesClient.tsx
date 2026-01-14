"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type Kind = "all" | "note" | "call" | "email" | "task" | "status" | "assignment";

type Row = {
  id: string;
  account_id: string;
  kind: string;
  body: string | null;
  created_at: string;
};

export default function ActivitiesClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  // account lookup for display + link
  const [accountsById, setAccountsById] = useState<Record<string, { name?: string; city?: string; state?: string }>>({});

  async function load() {
    setBusy(true);

    let query = supabase
      .from("account_activities")
      .select("id,account_id,kind,body,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (kind !== "all") query = query.eq("kind", kind);

    // NOTE: basic text filtering client-side to keep it simple + reliable
    const res = await query;

    setBusy(false);

    if (res.error) {
      toast({ title: "Failed to load activities", description: res.error.message });
      setRows([]);
      return;
    }

    let data = (res.data ?? []) as Row[];

    const needle = q.trim().toLowerCase();
    if (needle) {
      data = data.filter((r) => {
        const s = `${r.kind ?? ""} ${r.body ?? ""}`.toLowerCase();
        return s.includes(needle);
      });
    }

    setRows(data);

    // fetch account names for these rows
    const ids = Array.from(new Set(data.map((r) => r.account_id))).filter(Boolean);
    if (ids.length === 0) {
      setAccountsById({});
      return;
    }

    const a = await supabase
      .from("accounts_active")
      .select("id,name,city,state")
      .in("id", ids);

    if (!a.error) {
      const map: Record<string, any> = {};
      (a.data ?? []).forEach((x: any) => {
        map[x.id] = { name: x.name, city: x.city, state: x.state };
      });
      setAccountsById(map);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm text-muted-foreground">Activities</div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            className="w-[260px] rounded-2xl"
            placeholder="Search activity text…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger className="w-[170px] rounded-2xl">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="assignment">Assignment</SelectItem>
            </SelectContent>
          </Select>

          <Button className="rounded-2xl" variant="secondary" onClick={load} disabled={busy}>
            {busy ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            Recent activity
          </div>
          <div className="text-xs text-muted-foreground">
            {busy ? "Loading…" : `${rows.length} shown`}
          </div>
        </div>

        {rows.length === 0 && !busy ? (
          <div className="text-sm text-muted-foreground">
            No activity found.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const acct = accountsById[r.account_id];
              const title = acct?.name ?? r.account_id;

              return (
                <div key={r.id} className="rounded-2xl border border-border p-3 bg-background/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-xl bg-secondary px-2 py-1 text-xs">
                      {String(r.kind).toUpperCase()}
                    </span>

                    <Link
                      className="text-sm font-semibold underline underline-offset-4"
                      href={`/accounts?selected=${encodeURIComponent(r.account_id)}`}
                    >
                      {title}
                    </Link>

                    <span className="text-xs text-muted-foreground">
                      {(acct?.city ?? "—")}, {(acct?.state ?? "—")}
                    </span>

                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>

                  {r.body ? (
                    <div className="mt-2 text-sm whitespace-pre-wrap">{r.body}</div>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">—</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
