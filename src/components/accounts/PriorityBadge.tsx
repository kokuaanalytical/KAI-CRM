"use client";

import { cn } from "@/lib/utils";

function bucket(score: number) {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function PriorityBadge({
  score,
  tooltip,
  compact,
}: {
  score: number;
  tooltip?: string;
  compact?: boolean;
}) {
  const b = bucket(score);

  const styles =
    b === "hot"
      ? "bg-red-500/15 text-red-300 ring-red-500/25"
      : b === "warm"
      ? "bg-amber-500/15 text-amber-300 ring-amber-500/25"
      : "bg-slate-500/15 text-slate-300 ring-slate-500/25";

  const label = b === "hot" ? "🔥 Hot" : b === "warm" ? "🟡 Warm" : "⚪ Cold";

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center rounded-xl px-2 py-1 text-xs ring-1",
        styles,
        compact && "px-2 py-0.5 text-[11px]"
      )}
    >
      {label} <span className="ml-2 opacity-80">{score}</span>
    </span>
  );
}
