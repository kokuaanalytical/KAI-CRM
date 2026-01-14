"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaskAiGenerator } from "@/components/ai/TaskAiGenerator";
import { useToast } from "@/components/ui/use-toast";

type Task = {
  id: string;
  subject: string;
  notes: string | null;
  due_at: string | null;
  account: { name: string }[]; // array
};

export default function TasksClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);

  async function load() {
    const { data, error } = await supabase
      .from("activities")
      .select("id,subject,notes,due_at, account:accounts(name)")
      .eq("type", "task")
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .limit(500);

    if (error) {
      toast({ title: "Failed to load tasks", description: error.message });
      setTasks([]);
      return;
    }

    setTasks((data ?? []) as Task[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function complete(id: string) {
    const res = await supabase
      .from("activities")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id);

    if (res.error) {
      toast({ title: "Failed to complete task", description: res.error.message });
      return;
    }

    load();
  }

  return (
    <div className="h-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Tasks</div>
        <TaskAiGenerator onCreated={load} />
      </div>

      <div className="space-y-3">
        {tasks.map((t) => {
          const acct = t.account?.[0];
          return (
            <Card key={t.id} className="rounded-2xl border-border bg-card/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t.subject}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {acct?.name ?? "—"} • Due: {t.due_at ?? "—"}
                  </div>

                  {t.notes ? (
                    <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                      {t.notes}
                    </div>
                  ) : null}
                </div>

                <Button variant="secondary" className="rounded-2xl" onClick={() => complete(t.id)}>
                  Complete
                </Button>
              </div>
            </Card>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-sm text-muted-foreground">No open tasks.</div>
        )}
      </div>
    </div>
  );
}
