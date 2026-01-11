"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Activity = {
  id: string;
  type: string;
  subject: string;
  notes: string | null;
  created_at: string;
  due_at: string | null;
  completed_at: string | null;
};

export function AccountTimeline({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<Activity[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("activities")
      .select("id,type,subject,notes,created_at,due_at,completed_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return setErr(error.message);
    setItems((data ?? []) as Activity[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  return (
    <div className="space-y-3">
      {err && <div className="text-sm text-red-400">{err}</div>}

      {items.map((a) => (
        <Card key={a.id} className="rounded-2xl border-border bg-card/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{a.subject}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
                {a.due_at ? ` • Due: ${new Date(a.due_at).toLocaleString()}` : ""}
                {a.completed_at ? ` • Completed: ${new Date(a.completed_at).toLocaleString()}` : ""}
              </div>
              {a.notes && (
                <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                  {a.notes}
                </div>
              )}
            </div>
            <Badge variant="secondary" className="rounded-xl">
              {a.type}
            </Badge>
          </div>
        </Card>
      ))}

      {items.length === 0 && (
        <div className="text-sm text-muted-foreground">No activity yet.</div>
      )}
    </div>
  );
}
