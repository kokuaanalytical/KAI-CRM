"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { StickyNote, Phone, Mail, CheckSquare, ArrowRightLeft, Tag } from "lucide-react";

type Kind = "note" | "call" | "email" | "task" | "status" | "assignment";

const kindIcon: Record<Kind, any> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  task: CheckSquare,
  status: Tag,
  assignment: ArrowRightLeft,
};

export function ActivityComposer({ accountId, onCreated }: { accountId: string; onCreated: () => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [kind, setKind] = useState<Kind>("note");
  const [body, setBody] = useState("");

  async function submit() {
    const text = body.trim();
    if (!text) return;

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast({ title: "Not signed in" });
      return;
    }

    const res = await supabase.from("account_activities").insert({
      account_id: accountId,
      user_id: uid,
      kind,
      body: text,
    });

    if (res.error) {
      toast({ title: "Failed to log activity", description: res.error.message });
      return;
    }

    setBody("");
    toast({ title: "Activity added" });
    onCreated();
  }

  return (
    <div className="rounded-2xl border border-border bg-card/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger className="w-[160px] rounded-2xl">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="assignment">Assignment</SelectItem>
          </SelectContent>
        </Select>

        <Button className="rounded-2xl ml-auto" onClick={submit}>
          Add
        </Button>
      </div>

      <Textarea
        className="rounded-2xl"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a note, call outcome, email summary…"
      />
    </div>
  );
}

export function ActivityTimeline({
  accountId,
}: {
  accountId: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const res = await supabase
      .from("account_activities")
      .select("id,kind,title,body,meta,created_at,user_id")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(100);

    setBusy(false);

    if (res.error) {
      toast({ title: "Failed to load timeline", description: res.error.message });
      return;
    }

    setItems(res.data ?? []);
  }

  // initial load
  useState(() => {
    load();
    return null as any;
  });

  return (
    <div className="space-y-3">
      <ActivityComposer accountId={accountId} onCreated={load} />

      <div className="rounded-2xl border border-border bg-card/20 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Timeline</div>
          <div className="text-xs text-muted-foreground">{busy ? "Loading…" : `${items.length} items`}</div>
        </div>

        <div className="mt-3 space-y-3">
          {items.map((it) => {
            const Icon = kindIcon[it.kind as Kind] ?? StickyNote;
            return (
              <div key={it.id} className="rounded-2xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">
                      {String(it.kind).toUpperCase()} • {new Date(it.created_at).toLocaleString()}
                    </div>
                    {it.title && <div className="text-sm font-semibold">{it.title}</div>}
                    {it.body && <div className="text-sm mt-1 whitespace-pre-wrap">{it.body}</div>}
                  </div>
                </div>
              </div>
            );
          })}

          {items.length === 0 && !busy && (
            <div className="text-sm text-muted-foreground">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
