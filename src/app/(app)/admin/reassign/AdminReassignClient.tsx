"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type Account = {
  id: string;
  name: string;
  state: string | null;
};

type Rep = {
  id: string;
  email: string;
};

export default function AdminReassignClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [repId, setRepId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, r] = await Promise.all([
      supabase
        .from("accounts")
        .select("id,name,state")
        .eq("assignment_status", "unassigned")
        .limit(500),

      supabase
        .from("profiles")
        .select("id,email")
        .order("email"),
    ]);

    if (a.error) toast({ title: "Failed to load accounts", description: a.error.message });
    else setAccounts(a.data ?? []);

    if (r.error) toast({ title: "Failed to load reps", description: r.error.message });
    else setReps(r.data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function assignAll() {
    if (!repId) return;

    try {
      setBusy(true);

      const res = await supabase
        .from("accounts")
        .update({
          owner_user_id: repId,
          assignment_status: "assigned",
          assigned_at: new Date().toISOString(),
        })
        .eq("assignment_status", "unassigned");

      if (res.error) throw res.error;

      toast({
        title: "Accounts reassigned",
        description: `Assigned ${accounts.length} accounts`,
      });

      setRepId("");
      await load();
    } catch (e: any) {
      toast({ title: "Reassignment failed", description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="text-sm text-muted-foreground">Admin · Bulk Reassign</div>

      <Card className="p-4 space-y-4">
        <div className="text-sm font-semibold">Unassigned accounts: {accounts.length}</div>

        <Select value={repId} onValueChange={setRepId}>
          <SelectTrigger className="rounded-2xl">
            <SelectValue placeholder="Assign to rep…" />
          </SelectTrigger>
          <SelectContent>
            {reps.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button className="rounded-2xl" onClick={assignAll} disabled={busy || !repId || accounts.length === 0}>
          {busy ? "Assigning…" : "Assign all unassigned"}
        </Button>
      </Card>
    </div>
  );
}
