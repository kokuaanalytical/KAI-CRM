"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Act = {
  id: string;
  type: string;
  subject: string;
  notes: string;
  created_at: string;
  account: { name: string }[]; // <-- array
};

export default function ActivitiesPage() {
  const [acts, setActs] = useState<Act[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id,type,subject,notes,created_at, account:accounts(name)")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) console.error(error);
      setActs((data ?? []) as Act[]);
    })();
  }, []);

  return (
    <div className="h-full space-y-3">
      <div className="text-sm text-muted-foreground">Activities</div>

      <div className="space-y-3">
        {acts.map((a) => {
          const acct = a.account?.[0];
          return (
            <Card key={a.id} className="rounded-2xl border-border bg-card/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{a.subject}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {acct?.name ?? "—"} • {new Date(a.created_at).toLocaleString()}
                  </div>
                  {a.notes && <div className="mt-2 text-xs text-muted-foreground">{a.notes}</div>}
                </div>
                <Badge variant="secondary" className="rounded-xl">{a.type}</Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
