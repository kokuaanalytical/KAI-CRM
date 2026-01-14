"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Flame, Hourglass, RefreshCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Role = "admin" | "rep" | null;

type FlagRow = {
  account_id: string;
  stale_30: boolean;
  unassigned_7: boolean;
  updated_at: string;
};

export default function AdminFlagsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [role, setRole] = useState<Role>(null);
  const [busy, setBusy] = useState(false);

  const [staleCount, setStaleCount] = useState<number>(0);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);

  const [rows, setRows] = useState<Array<FlagRow & { name?: string; city?: string; state?: string }>>([]);

  async function loadRole() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return setRole(null);

    const r = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    setRole((r.data?.role as Role) ?? "rep");
  }

  async function loadCounts() {
    const c1 = await supabase
      .from("account_flags")
      .select("account_id", { head: true, count: "exact" })
      .eq("stale_30", true);

    const c2 = await supabase
      .from("account_flags")
      .select("account_id", { head: true, count: "exact" })
      .eq("unassigned_7", true);

    setStaleCount(c1.count ?? 0);
    setUnassignedCount(c2.count ?? 0);
  }

  async function loadList() {
    const f = await supabase
      .from("account_flags")
      .select("account_id,stale_30,unassigned_7,updated_at")
      .or("stale_30.eq.true,unassigned_7.eq.true")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (f.error) {
      toast({ title: "Failed to load flags", description: f.error.message });
      setRows([]);
      return;
    }

    const flags = (f.data ?? []) as FlagRow[];
    const ids = flags.map((x) => x.account_id);

    if (ids.length === 0) {
      setRows([]);
      return;
    }

    const a = await supabase
      .from("accounts_active")
      .select("id,name,city,state")
      .in("id", ids);

    const byId = new Map((a.data ?? []).map((x: any) => [x.id, x]));

    setRows(
      flags.map((r) => ({
        ...r,
        name: byId.get(r.account_id)?.name,
        city: byId.get(r.account_id)?.city,
        state: byId.get(r.account_id)?.state,
      }))
    );
  }

  async function loadAll() {
    setBusy(true);
    await loadRole();
    await loadCounts();
    await loadList();
    setBusy(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recomputeNow() {
    if (role !== "admin") {
      toast({ title: "Admins only", description: "Only admins can recompute flags." });
      return;
    }

    setBusy(true);
    const r = await supabase.rpc("refresh_account_flags");
    setBusy(false);

    if (r.error) {
      toast({ title: "Recompute failed", description: r.error.message });
      return;
    }

    toast({ title: "Flags recomputed" });
    await loadCounts();
    await loadList();
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Admin · Flags</div>
          <div className="text-xs text-muted-foreground">Shows accounts flagged by automations.</div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/auto-assign">
            <Button variant="secondary" className="rounded-2xl">Auto-assign rules</Button>
          </Link>
          <Button className="rounded-2xl" onClick={recomputeNow} disabled={busy || role !== "admin"}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Recompute now
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-muted-foreground" /> Stale 30d+
          </div>
          <div className="text-3xl font-semibold">{staleCount}</div>
          <div className="text-xs text-muted-foreground">Accounts with no activity in 30+ days.</div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Hourglass className="h-4 w-4 text-muted-foreground" /> Unassigned 7d+
          </div>
          <div className="text-3xl font-semibold">{unassignedCount}</div>
          <div className="text-xs text-muted-foreground">Unassigned accounts older than 7 days.</div>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Flagged accounts (latest 50)</div>

        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="w-[160px]">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.account_id}>
                  <TableCell className="font-medium">
                    <Link className="underline underline-offset-4" href={`/accounts?selected=${encodeURIComponent(r.account_id)}`}>
                      {r.name ?? r.account_id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(r.city ?? "—")}, {(r.state ?? "—")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {r.stale_30 && (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-2 py-1 text-xs text-red-300 ring-1 ring-red-500/25">
                          <Flame className="h-3.5 w-3.5" /> Stale 30d+
                        </span>
                      )}
                      {r.unassigned_7 && (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-sky-500/15 px-2 py-1 text-xs text-sky-300 ring-1 ring-sky-500/25">
                          <Hourglass className="h-3.5 w-3.5" /> Unassigned 7d+
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.updated_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}

              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground p-6 text-center">
                    No flagged accounts right now.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {role !== "admin" && (
          <div className="text-xs text-muted-foreground">
            You can view flags, but only admins can recompute them.
          </div>
        )}
      </Card>
    </div>
  );
}
