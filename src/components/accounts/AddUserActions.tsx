"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddUserActions() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("rep");
  const [busy, setBusy] = useState(false);

  async function inviteUser() {
    const e = email.trim().toLowerCase();
    if (!e) return alert("Enter an email");

    setBusy(true);
    const res = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, role }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) return alert(data.error ?? "Failed to invite user");
    alert(`Invite sent to ${e}`);
    setEmail("");
  }

  async function sendPasswordReset() {
    const e = email.trim().toLowerCase();
    if (!e) return alert("Enter an email");

    setBusy(true);
    const res = await fetch("/api/admin/send-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) return alert(data.error ?? "Failed to send password reset");
    alert(`Password reset email sent to ${e}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="text-sm font-medium">Add / Manage User</div>

      <Input
        placeholder="user@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <select
        className="rounded-md border bg-transparent p-2 text-sm"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="rep">Rep</option>
        <option value="admin">Admin</option>
      </select>

      <div className="flex gap-2">
        <Button disabled={busy} onClick={inviteUser}>
          {busy ? "Sending…" : "Invite user"}
        </Button>

        <Button variant="secondary" disabled={busy} onClick={sendPasswordReset}>
          {busy ? "Sending…" : "Send password reset"}
        </Button>
      </div>
    </div>
  );
}
