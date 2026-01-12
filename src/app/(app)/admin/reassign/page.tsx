

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Account = {
  id: string;
  name: string;
  state: string;
};

export default function AdminReassignPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [repId, setRepId] = useState("");
  const [reps, setReps] = useState<{ id: string; email: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const a = await supabase
      .from("accounts")
      .select("id,name,state")
      .eq("assignment_status", "unassigned")
      .limit(500);

    const r = await supabase
      .from("profiles")
      .select("id,email")
      .order("email");

    setAccounts(a.data ?? []);
    setReps(r.data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function assignAll() {
    if (!repId) return;
    setBusy(true);

    await supabase
      .from("accounts")
      .update({
        owner_user_id: repId,
        assignment_status: "assigned",
        assigned_at: new Date().toISOString(),
      })
      .eq("assignment_status", "unassigned");

    setBusy(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">Bulk Reassign</div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">
          Unassigned accounts: {accounts.length}
        </div>

        <Select value={repId} onValueChange={setRepId}>
          <SelectTrigger>
            <SelectValue placeholder="Assign to rep…" />
          </SelectTrigger>
          <SelectContent>
            {reps.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={assignAll} disabled={busy || !repId}>
          {busy ? "Assigning…" : "Assign all unassigned"}
        </Button>
      </Card>
    </div>
  );
}
