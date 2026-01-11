"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/crm";

export function AccountCard({
  account,
  selected,
  onSelect,
}: {
  account: Account;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      role="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border-border bg-card/40 p-4 transition hover:bg-card/60",
        selected && "ring-1 ring-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{account.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {account.city}, {account.state} • CLIA {account.clia_number}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-xl">
            {account.stage}
          </Badge>
          <Badge className="rounded-xl">AI</Badge>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        {account.phone} • {account.website}
      </div>
    </Card>
  );
}
