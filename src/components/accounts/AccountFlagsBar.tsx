"use client";

import { Flame, Hourglass, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountFlagsBar({
  flags,
  onRefresh,
  busy,
}: {
  flags: { stale_30?: boolean; unassigned_7?: boolean } | null;
  onRefresh?: () => void;
  busy?: boolean;
}) {
  if (!flags) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/20 p-3">
      <div className="text-xs font-medium text-muted-foreground mr-2">
        Automations
      </div>

      {flags.stale_30 ? (
        <span className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-2 py-1 text-xs text-red-300 ring-1 ring-red-500/25">
          <Flame className="h-3.5 w-3.5" /> Stale 30d+
        </span>
      ) : (
        <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
          Not stale 30d
        </span>
      )}

      {flags.unassigned_7 ? (
        <span className="inline-flex items-center gap-1 rounded-xl bg-sky-500/15 px-2 py-1 text-xs text-sky-300 ring-1 ring-sky-500/25">
          <Hourglass className="h-3.5 w-3.5" /> Unassigned 7d+
        </span>
      ) : (
        <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
          Assigned / New
        </span>
      )}

      {onRefresh ? (
        <Button
          variant="secondary"
          className="rounded-2xl ml-auto"
          onClick={onRefresh}
          disabled={!!busy}
          title="Refresh flags now"
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          {busy ? "Refreshing…" : "Refresh flags"}
        </Button>
      ) : null}
    </div>
  );
}
