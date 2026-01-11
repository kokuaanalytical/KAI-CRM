"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClaimLimitSettings } from "@/components/admin/ClaimLimitSettings";
import Link from "next/link";

type Territory = { id: string; code: string; name: string };
type UserRole = { user_id: string; role: "admin" | "rep" };

type AccountRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  assignment_status: string;
  owner_user_id: string | null;
};

const US_STATES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

export default function AdminPage() {
  const [me, setMe] = useState<string | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Role editor
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"admin" | "rep">("rep");

  // Rep territory editor
  const [rtUserId, setRtUserId] = useState("");
  const [rtState, setRtState] = useState("");
  const [rtRows, setRtRows] = useState<Array<{ user_id: string; territory_code: string }>>([]);

  // Bulk reassign
  const [filterState, setFilterState] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "unassigned" | "assigned">("unassigned");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [assignToUserId, setAssignToUserId] = useState("");

  const stateCoverage = useMemo(() => {
    const existing = new Set(territories.map((t) => t.code));
    const missing = US_STATES.filter((s) => !existing.has(s.code));
    return { existing: existing.size, total: US_STATES.length, missing };
  }, [territories]);

  async function refresh() {
    const auth = await supabase.auth.getUser();
    setMe(auth.data.user?.id ?? null);

    const t = await supabase.from("territories").select("id,code,name").order("code");
    setTerritories((t.data ?? []) as Territory[]);

    const r = await supabase.from("user_roles").select("user_id,role").order("created_at", { ascending: false });
    setRoles((r.data ?? []) as UserRole[]);

    const rt = await supabase
      .from("rep_territories")
      .select("user_id,territory_code")
      .order("created_at", { ascending: false })
      .limit(5000);
    setRtRows((rt.data ?? []) as any[]);
  }

  useEffect(() => { refresh(); }, []);

  async function seedTerritories() {
    setBusy(true); setMsg(null);
    const payload = US_STATES.map((s) => ({ code: s.code, name: s.name }));
    const { error } = await supabase.from("territories").upsert(payload, { onConflict: "code" });
    setBusy(false);
    if (error) return setMsg(`Seed failed: ${error.message}`);
    setMsg("Territories seeded/updated.");
    refresh();
  }

  async function setUserRole() {
    setBusy(true); setMsg(null);
    const uid = userId.trim();
    if (!uid) { setBusy(false); return setMsg("Enter a user UUID."); }

    const { error } = await supabase.from("user_roles").upsert({ user_id: uid, role }, { onConflict: "user_id" });
    setBusy(false);
    if (error) return setMsg(`Role update failed: ${error.message}`);
    setMsg(`Role set: ${uid} → ${role}`);
    setUserId("");
    refresh();
  }

  async function addRepTerritory() {
    setBusy(true); setMsg(null);
    const uid = rtUserId.trim();
    const code = rtState.trim().toUpperCase();
    if (!uid || !code) { setBusy(false); return setMsg("Enter user UUID and territory code."); }

    const { error } = await supabase.from("rep_territories").upsert({ user_id: uid, territory_code: code });
    setBusy(false);
    if (error) return setMsg(`Rep territory add failed: ${error.message}`);
    setMsg(`Added territory ${code} to ${uid}`);
    setRtState("");
    refresh();
  }

  async function removeRepTerritory(user_id: string, territory_code: string) {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("rep_territories").delete().eq("user_id", user_id).eq("territory_code", territory_code);
    setBusy(false);
    if (error) return setMsg(error.message);
    refresh();
  }

  async function loadAccounts() {
    setBusy(true); setMsg(null);

    let q = supabase
      .from("accounts")
      .select("id,name,city,state,assignment_status,owner_user_id")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (filterStatus !== "ALL") q = q.eq("assignment_status", filterStatus);
    if (filterState !== "ALL") q = q.eq("state", filterState);
    if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);

    const res = await q;
    setBusy(false);
    if (res.error) return setMsg(res.error.message);

    const data = (res.data ?? []) as AccountRow[];
    setAccounts(data);
    setSelectedIds({});
  }

  async function bulkAssign() {
    setMsg(null);
    const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
    if (ids.length === 0) return setMsg("Select at least one account.");
    if (!assignToUserId.trim()) return setMsg("Enter a user UUID to assign to.");

    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    const actor = auth.user?.id ?? null;

    const { error } = await supabase
      .from("accounts")
      .update({
        owner_user_id: assignToUserId.trim(),
        assignment_status: "assigned",
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: actor,
      })
      .in("id", ids);

    setBusy(false);
    if (error) return setMsg(error.message);

    setMsg(`Assigned ${ids.length} accounts → ${assignToUserId.trim()}`);
    await loadAccounts();
  }

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Admin</div>

        <div className="flex items-center gap-2">
          <Link href="/admin/users">
            <Button variant="secondary" className="rounded-2xl">
              Manage Users
            </Button>
          </Link>

          <Link href="/admin/templates">
            <Button variant="secondary" className="rounded-2xl">
              Manage Email Templates
            </Button>
          </Link>
        </div>
      </div>

      <ClaimLimitSettings />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
          <div className="text-sm font-semibold">Territories</div>
          <div className="text-xs text-muted-foreground">
            Coverage: {stateCoverage.existing}/{stateCoverage.total}
            {stateCoverage.missing.length > 0 ? ` • Missing: ${stateCoverage.missing.map(m => m.code).join(", ")}` : ""}
          </div>
          <Button className="rounded-2xl" onClick={seedTerritories} disabled={busy}>
            {busy ? "Working…" : "Seed all US states"}
          </Button>
        </Card>

        <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
          <div className="text-sm font-semibold">User Roles</div>
          <div className="text-xs text-muted-foreground">
            Your user id: <span className="font-mono">{me ?? "—"}</span>
          </div>

          <div className="grid gap-3">
            <Input
              placeholder="User UUID (Supabase Auth → Users)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rep">rep</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
            <Button className="rounded-2xl" onClick={setUserRole} disabled={busy}>
              {busy ? "Working…" : "Set role"}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
        <div className="text-sm font-semibold">Rep Territories</div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Input
            placeholder="Rep user UUID"
            value={rtUserId}
            onChange={(e) => setRtUserId(e.target.value)}
          />
          <Input
            placeholder="State code (e.g. CA)"
            value={rtState}
            onChange={(e) => setRtState(e.target.value)}
          />
          <Button className="rounded-2xl" onClick={addRepTerritory} disabled={busy}>
            {busy ? "Working…" : "Add territory"}
          </Button>
        </div>

        <div className="space-y-2">
          {rtRows.slice(0, 50).map((r, idx) => (
            <div key={`${r.user_id}-${r.territory_code}-${idx}`} className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                <span className="font-mono">{r.user_id}</span> — {r.territory_code}
              </div>
              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={() => removeRepTerritory(r.user_id, r.territory_code)}
                disabled={busy}
              >
                Remove
              </Button>
            </div>
          ))}
          {rtRows.length === 0 && <div className="text-xs text-muted-foreground">No rep territories yet.</div>}
        </div>
      </Card>

      <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
        <div className="text-sm font-semibold">Bulk Reassign Accounts</div>

        <div className="grid gap-3 lg:grid-cols-4">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">unassigned</SelectItem>
              <SelectItem value="assigned">assigned</SelectItem>
              <SelectItem value="ALL">ALL</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger className="rounded-2xl"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {US_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input placeholder="Search name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button className="rounded-2xl" onClick={loadAccounts} disabled={busy}>
            {busy ? "Loading…" : "Load"}
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Input
            placeholder="Assign selected to user UUID"
            value={assignToUserId}
            onChange={(e) => setAssignToUserId(e.target.value)}
          />
          <Button className="rounded-2xl" onClick={bulkAssign} disabled={busy}>
            {busy ? "Assigning…" : "Assign selected"}
          </Button>
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => setSelectedIds(Object.fromEntries(accounts.map((a) => [a.id, true])))}
            disabled={busy}
          >
            Select all loaded
          </Button>
        </div>

        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl border border-border bg-card/40 p-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!selectedIds[a.id]}
                  onChange={(e) => setSelectedIds((s) => ({ ...s, [a.id]: e.target.checked }))}
                />
                <div>
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(a.city ?? "—")}, {(a.state ?? "—")} • {a.assignment_status} • owner: {a.owner_user_id ?? "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {accounts.length === 0 && (
            <div className="text-sm text-muted-foreground">Load accounts to reassign.</div>
          )}
        </div>
      </Card>

      {msg && <div className="text-sm text-muted-foreground">{msg}</div>}
    </div>
  );
}
