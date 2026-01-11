"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { CreateMenu } from "@/components/create/CreateMenu";
import { GlobalAiPanel } from "@/components/ai/GlobalAiPanel";

export function Topbar() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card/30 px-4">
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search accounts or contacts…" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <GlobalAiPanel />
        <CreateMenu />
      </div>
    </header>
  );
}
