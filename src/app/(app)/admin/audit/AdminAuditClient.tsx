"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Role = "admin" | "rep" | "ops" | null;

function expiryDate(created_at: string) {
  const t = new Date(created_at).getTime();
  return new Date(t + 90 * 864e5).toLocaleDateString();
}

export default function AdminAuditClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [role, setRole] = useState<Role>(null);
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  async function loadRole() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return setRole(null);

    const r = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    setRole((r.data?.role as Role) ?? "rep");
  }

  async function load() {
    setBusy(true);
    await loadRole();

    const r = await supabase
      .from("ai_audit_logs")
      .select("id,created_at,route,model,user_id,account_id,output,prompt")
      .order("created_at", { ascending: false })
      .limit(200);

    setRows(r.data ?? []);
    setBusy(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (role !== "admin") {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="text-sm text-muted-foreground">Admin · AI Audit</div>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Admins only.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Admin · AI Audit</div>
          <div className="text-xs text-muted-foreground">Retention: expires per record (90d)</div>
        </div>
        <Button className="rounded-2xl" variant="secondary" onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <Card className="p-4 space-y-2">
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No logs yet.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={r.id}
                className="w-full text-left rounded-2xl border border-border bg-background/40 p-3 hover:bg-background/60"
                onClick={() => {
                  setSelected(r);
                  setOpen(true);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold truncate">{r.route}</div>
                  <div className="text-xs text-muted-foreground">Expires: {expiryDate(r.created_at)}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} • {r.model ?? "—"}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[920px]">
          <DialogHeader>
            <DialogTitle>AI Log Detail</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {selected?.route} • {selected?.model ?? "—"} •{" "}
              {selected?.created_at ? new Date(selected.created_at).toLocaleString() : "—"}
            </div>

            <div className="rounded-2xl border border-border p-3 bg-background/40">
              <div className="text-xs text-muted-foreground mb-1">Prompt (JSON)</div>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(selected?.prompt ?? null, null, 2)}</pre>
            </div>

            <div className="rounded-2xl border border-border p-3 bg-background/40">
              <div className="text-xs text-muted-foreground mb-1">Output</div>
              <pre className="text-xs whitespace-pre-wrap">{selected?.output ?? ""}</pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
