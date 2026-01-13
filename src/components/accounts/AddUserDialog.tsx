"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function inviteUser() {
    if (!email) return alert("Enter an email");

    setBusy(true);
    const res = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      alert(data.error ?? "Failed to invite user");
      return;
    }

    alert(`Invite sent to ${email}`);
    setEmail("");
    setOpen(false);
  }

  async function sendPasswordReset() {
    if (!email) return alert("Enter an email");

    setBusy(true);
    const res = await fetch("/api/admin/send-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      alert(data.error ?? "Failed to send password reset");
      return;
    }

    alert(`Password reset email sent to ${email}`);
    setEmail("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add user</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add / Manage User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="email"
            placeholder="user@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="flex flex-col gap-2">
            <Button onClick={inviteUser} disabled={busy}>
              {busy ? "Sending…" : "Invite user (new user)"}
            </Button>

            <Button
              variant="secondary"
              onClick={sendPasswordReset}
              disabled={busy}
            >
              {busy ? "Sending…" : "Send password reset"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            • <strong>Invite user</strong> → for brand‑new users (no password yet)<br />
            • <strong>Password reset</strong> → for existing users who forgot password
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
