"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA",
  "MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

export function CreateAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (accountId: string) => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const n = name.trim();
    if (!n) return;

    setBusy(true);
    const res = await supabase
      .from("accounts")
      .insert({
        name: n,
        state: state || null,
        city: city || null,
        assignment_status: "unassigned",
        stage: "new",
      })
      .select("id")
      .single();
    setBusy(false);

    if (res.error) {
      toast({ title: "Create failed", description: res.error.message });
      return;
    }

    toast({ title: "Account created" });
    setName("");
    setState("");
    setCity("");
    onOpenChange(false);
    onCreated(res.data.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create account</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input className="rounded-2xl" value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input className="rounded-2xl" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button className="rounded-2xl" onClick={create} disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
