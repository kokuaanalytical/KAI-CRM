"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Role = "admin" | "rep";
type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  role: Role;
  territories: string[];
  invited_at: string | null;
  last_sign_in_at: string | null;
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA",
  "MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // invite form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("rep");

  // territory add form
  const [territoryUserId, setTerritoryUserId] = useState("");
  const [territoryCode, setTerritoryCode] = useState("CA");

  async function load() {
    setMsg(null);
    setBusy(true);
    const res = await fetch("/api/admin/users");
    setBusy(false);
    if (!res.ok) return setMsg(await res.text());
    const j = await res.json();
    setUsers((j.users ?? []) as UserRow[]);
  }

  useEffect(() => { load(); }, []);

  async function invite() {
    setMsg(null);
    const e = email.trim().toLowerCase();
    if (!e) return setMsg("Email required.");
    setBusy(true);

    const res = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, role }),
    });

    setBusy(false);
    if (!res.ok) return setMsg(await res.text());

    setEmail("");
    setRole("rep");
    setMsg("✅ Invite sent.");
    load();
  }

  async function addTerritory() {
    setMsg(null);
    if (!territoryUserId.trim()) return setMsg("Pick a user id.");
    setBusy(true);

    // Uses your existing table; admin RLS already allows writes
    const { supabase } = await import("@/lib/supabase/client");
    const up = await supabase.from("rep_territories").upsert({
      user_id: territoryUserId.trim(),
      territory_code: territoryCode.trim().toUpperCase(),
    });

    setBusy(false);
    if (up.error) return setMsg(up.error.message);

    setMsg("✅ Territory added.");
    load();
  }

  const userOptions = useMemo(() => users.map((u) => ({ id: u.id, label: `${u.email} (${u.role})` })), [users]);

  return (
    <div className="h-full space-y-4">
      <div className="text-sm text-muted-foreground">Admin • Users</div>

      <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
        <div className="text-sm font-semibold">Invite user</div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Input placeholder="rep@kokuaanalytical.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rep">rep</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
          <Button className="rounded-2xl" onClick={invite} disabled={busy}>
            {busy ? "Sending…" : "Send invite"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Invite sends an email from Supabase. The user sets a password and can log in.
        </div>
      </Card>

      <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
        <div className="text-sm font-semibold">Assign territory</div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Select value={territoryUserId} onValueChange={setTerritoryUserId}>
            <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Pick user…" /></SelectTrigger>
            <SelectContent>
              {userOptions.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={territoryCode} onValueChange={setTerritoryCode}>
            <SelectTrigger className="rounded-2xl"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button className="rounded-2xl" onClick={addTerritory} disabled={busy}>
            {busy ? "Saving…" : "Add territory"}
          </Button>
        </div>
      </Card>

      {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

      <Card className="rounded-2xl border-border bg-card/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Users</div>
          <Button variant="secondary" className="rounded-2xl" onClick={load} disabled={busy}>
            {busy ? "Loading…" : "Refresh"}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Territories</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead>Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.email}
                  <div className="text-xs text-muted-foreground">{u.display_name ?? ""}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.role}</TableCell>
                <TableCell className="text-muted-foreground">{u.territories.join(", ") || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.invited_at ? new Date(u.invited_at).toLocaleString() : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}</TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  No users found (or you’re not admin).
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
