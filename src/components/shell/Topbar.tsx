"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Search, Menu } from "lucide-react";
import { CreateMenu } from "@/components/create/CreateMenu";
import { GlobalAiPanel } from "@/components/ai/GlobalAiPanel";
import { cn } from "@/lib/utils";
import { sidebarNav } from "@/components/shell/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Topbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card/30 px-4">
      {/* Mobile hamburger */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="secondary"
              className="rounded-2xl px-3"
              type="button"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="w-[300px] p-4">
            <SheetHeader className="pb-3">
              <SheetTitle className="text-left">
                <div className="text-lg font-semibold tracking-tight">Kai</div>
                <div className="text-xs text-muted-foreground">
                  Kokua Sales CRM
                </div>
              </SheetTitle>
            </SheetHeader>

            <Separator className="my-3" />

            <nav className="space-y-1">
              {sidebarNav.nav.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)} // ✅ close drawer on tap
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-secondary text-foreground ring-1 ring-primary/30"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <Separator className="my-4" />

            <div className="text-xs font-medium text-muted-foreground">Admin</div>
            <nav className="mt-2 space-y-1">
              {sidebarNav.admin.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)} // ✅ close drawer on tap
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-secondary text-foreground ring-1 ring-primary/30"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search accounts or contacts…" />
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <GlobalAiPanel />
        <CreateMenu />
      </div>
    </header>
  );
}
