"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function AdminTemplatesClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { toast } = useToast();

  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  async function load() {
    setBusy(true);

    // TODO: replace "templates" + columns with your real table when ready
    const res = await supabase.from("templates").select("*").order("created_at", { ascending: false });

    setBusy(false);

    if (res.error) {
      toast({ title: "Failed to load templates", description: res.error.message });
      setTemplates([]);
      return;
    }

    setTemplates(res.data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="text-sm text-muted-foreground">Admin · Templates</div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Templates</div>
          <Button className="rounded-2xl" variant="secondary" onClick={load} disabled={busy}>
            {busy ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No templates found (or table doesn’t exist yet).
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id ?? JSON.stringify(t)} className="rounded-2xl border border-border p-3">
                <div className="text-sm font-medium">{t.name ?? "Untitled"}</div>
                <div className="text-xs text-muted-foreground">
                  {t.updated_at ?? t.created_at ?? ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
