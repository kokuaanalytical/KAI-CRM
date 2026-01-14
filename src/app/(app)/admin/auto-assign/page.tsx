export const dynamic = "force-dynamic";

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, RefreshCcw } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA",
  "MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

type Role = "admin" | "rep" | null;

type AssignmentRow = {
  state_code: string;
  owner_user_id: string;
};

type Rep = {
  id: string;
  email: string;
};

export default function AdminAutoAssignPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [role, setRole] = useState<Role>(null);
  const [busy, setBusy] = useState(false);

  const [reps, setReps] = useState<Rep[]>([]);
  const [rules, setRules] = useState<Array<{ state_code: string; owner_user_id: string; owner_email: string }>>([]);

  const [stateCode, setStateCode] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");

  async function loadRole() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return setRole(null);

    const r = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    setRole((r.data?.role as Role) ?? "rep");
  }

  async function loadReps() {
    // Try profiles first (your admin/reassign page used "profiles")
    const r1 = await supabase.from("profiles").select("id,email").order("email");
    if (!r1.error) {
      setReps((r1.data ?? []) as any[]);
      return;
    }

    // Fallback to user_profiles (your AccountDetail uses "user_profiles")
    const r2 = await supabase.from("user_profiles").select("id:user_id,email").order("email");
    if (!r2.error) {
      setReps((r2.data ?? []) as any[]);
      return;
    }

    toast({ title: "Failed to load reps", description: r1.error?.message ?? r2.error?.message ?? "Unknown" });
  }

  async function loadRules() {
    const rs = await supabase.from("state_assignments").select("state_code,owner_user_id").order("state_code");
    if (rs.error) {
      toast({ title: "Failed to load rules", description: rs.error.message });
      setRules([]);
      return;
    }

    const repsById = new Map(reps.map((r) => [r.id, r.email]));
    const mapped = (rs.data ?? []).map((row: AssignmentRow) => ({
      state_code: row.state_code,
      owner_user_id: row.owner_user_id,
      owner_email: repsById.get(row.owner_user_id) ?? row.owner_user_id,
    }));

    setRules(mapped);
  }

  async function loadAll() {
    setBusy(true);
    await loadRole();
    await loadReps();
    setBusy(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // once reps load, we can compute owner emails for rules
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps.length]);

  async function upsertRule() {
    if (!stateCode || !ownerId) return;

    if (role !== "admin") {
      toast({ title: "Admins only", description: "You can view rules but only admins can edit." });
      return;
    }

    setBusy(true);
    const res = await supabase
      .from("state_assignments")
      .upsert({ state_code: stateCode, owner_user_id: ownerId }, { onConflict: "state_code" });

    setBusy(false);

    if (res.error) {
      toast({ title: "Save failed", description: res.error.message });
      return;
    }

    toast({ title: "Rule saved", description: `${stateCode} → ${reps.find(r => r.id === ownerId)?.email ?? ownerId}` });
    setStateCode("");
    setOwnerId("");
    await loadRules();
  }

  async function deleteRule(code: string) {
    if (role !== "admin") {
      toast({ title: "Admins only", description: "You can view rules but only admins can edit." });
      return;
    }

    setBusy(true);
    const res = await supabase.from("state_assignments").delete().eq("state_code", code);
    setBusy(false);

    if (res.error) {
      toast({ title: "Delete failed", description: res.error.message });
      return;
    }

    toast({ title: "Rule deleted", description: code });
    await loadRules();
  }

  async function runAutoAssignNow() {
    if (role !== "admin") {
      toast({ title: "Admins only", description: "Only admins can run auto-assign now." });
      return;
    }

    setBusy(true);
    const res = await supabase.rpc("auto_assign_accounts_by_state");
    setBusy(false);

    if (res.error) {
      toast({ title: "Auto-assign failed", description: res.error.message });
      return;
    }

    toast({ title: "Auto-assign complete" });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Admin · Auto-assign rules</div>
          <div className="text-xs text-muted-foreground">
            State → Owner mapping used to auto-assign unowned accounts.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/flags">
            <Button variant="secondary" className="rounded-2xl">View flags</Button>
          </Link>
          <Button className="rounded-2xl" onClick={runAutoAssignNow} disabled={busy || role !== "admin"}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Run now
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Add / update rule</div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Select value={stateCode} onValueChange={setStateCode}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              {reps.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button className="rounded-2xl" onClick={upsertRule} disabled={busy || role !== "admin" || !stateCode || !ownerId}>
            Save rule
          </Button>
        </div>

        {role !== "admin" && (
          <div className="text-xs text-muted-foreground">
            You can view rules, but only admins can edit them.
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Current rules</div>

        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.state_code}>
                  <TableCell className="font-medium">{r.state_code}</TableCell>
                  <TableCell className="text-muted-foreground">{r.owner_email}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      className="rounded-2xl"
                      onClick={() => deleteRule(r.state_code)}
                      disabled={busy || role !== "admin"}
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground p-6 text-center">
                    No rules yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
