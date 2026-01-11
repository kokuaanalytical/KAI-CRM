"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null; // enum contact_role
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

const ROLE_OPTIONS = [
  { value: "decision_maker", label: "Decision maker" },
  { value: "billing", label: "Billing" },
  { value: "lab_manager", label: "Lab manager" },
  { value: "medical_director", label: "Medical director" },
  { value: "operations", label: "Operations" },
  { value: "other", label: "Other" },
] as const;

function splitName(full: string): { first: string; last: string } {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function AccountContacts({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<Contact[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]["value"]>("decision_maker");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("contacts")
      .select("id,first_name,last_name,role,email,phone,notes,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return setErr(error.message);
    setItems((data ?? []) as Contact[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function createContact() {
    setErr(null);
    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setBusy(false);
      return setErr("Not logged in.");
    }

    const nameTrim = fullName.trim();
    if (!nameTrim) {
      setBusy(false);
      return setErr("Contact name is required.");
    }

    const { first, last } = splitName(nameTrim);

    const { error } = await supabase.from("contacts").insert({
      account_id: accountId,
      first_name: first || null,
      last_name: last || null,
      role, // enum-safe (dropdown)
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      owner_user_id: userId,
      name: nameTrim, // you added this column; keep it populated for convenience/search
    });

    setBusy(false);
    if (error) return setErr(error.message);

    setOpen(false);
    setFullName("");
    setRole("decision_maker");
    setEmail("");
    setPhone("");
    setNotes("");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Contacts</div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl" variant="secondary">
              <Plus className="mr-2 h-4 w-4" /> Add Contact
            </Button>
          </DialogTrigger>

          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              <Input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  placeholder="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <Textarea
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              {err && <div className="text-sm text-red-400">{err}</div>}

              <Button className="rounded-2xl" onClick={createContact} disabled={busy}>
                {busy ? "Saving…" : "Save Contact"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {err && <div className="text-sm text-red-400">{err}</div>}

      {items.map((c) => {
        const displayName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
        const roleLabel = ROLE_OPTIONS.find((r) => r.value === c.role)?.label ?? (c.role ?? "—");
        return (
          <Card key={c.id} className="rounded-2xl border-border bg-card/40 p-4">
            <div className="text-sm font-semibold">{displayName}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {roleLabel} • {c.email ?? "—"} • {c.phone ?? "—"}
            </div>
            {c.notes && (
              <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                {c.notes}
              </div>
            )}
          </Card>
        );
      })}

      {items.length === 0 && <div className="text-sm text-muted-foreground">No contacts yet.</div>}
    </div>
  );
}
