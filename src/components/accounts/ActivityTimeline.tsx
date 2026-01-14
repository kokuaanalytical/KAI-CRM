"use client";

import { useEffect, useMemo, useState } from "react";
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

export function ActivityTimeline({
  accountId,
  onActivityCreated,
}: {
  accountId: string;
  onActivityCreated?: () => void | Promise<void>;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [kind, setKind] = useState<Kind>("note");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const res = await supabase
      .from("account_activities")
      .select("id,kind,title,body,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(200);

    setBusy(false);

    if (res.error) {
      toast({ title: "Failed to load timeline", description: res.error.message });
      return;
    }

    setItems(res.data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function add() {
    const text = body.trim();
    if (!text) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const res = await supabase.from("account_activities").insert({
      account_id: accountId,
      user_id: auth.user.id,
      kind,
      body: text,
    });

    if (res.error) {
      toast({ title: "Failed to add activity", description: res.error.message });
      return;
    }

    setBody("");
    toast({ title: "Activity added" });
    await load();
    if (onActivityCreated) await onActivityCreated();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger className="w-[160px] rounded-2xl">
              <SelectValue />
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

          <Button className="ml-auto rounded-2xl" onClick={add} disabled={!body.trim()}>
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

      <div className="rounded-2xl border border-border bg-card/20 p-3">
        <div className="flex items-center justify-between text-sm font-semibold">
          Timeline
          <span className="text-xs text-muted-foreground">
            {busy ? "Loading…" : `${items.length} items`}
          </span>
        </div>

        <div className="mt-3 space-y-3">
          {items.map((it) => {
            const Icon = kindIcon[it.kind as Kind] ?? StickyNote;
            return (
              <div key={it.id} className="rounded-2xl border border-border bg-background/40 p-3">
                <div className="flex gap-2">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">
                      {String(it.kind).toUpperCase()} • {new Date(it.created_at).toLocaleString()}
                    </div>
                    <div className="text-sm whitespace-pre-wrap mt-1">{it.body}</div>
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
