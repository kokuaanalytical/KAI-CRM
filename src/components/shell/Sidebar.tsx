"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  LayoutGrid,
  CheckSquare,
  Activity,
  Settings,
  Upload,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const nav = [
  { href: "/accounts", label: "Accounts", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: LayoutGrid },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/activities", label: "Activities", icon: Activity },
];

const admin = [
  { href: "/import", label: "Import/Export", icon: Upload },
  { href: "/admin", label: "Admin", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-[280px] shrink-0 border-r border-border bg-card/40 p-4 md:block">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight">Kai</div>
          <div className="text-xs text-muted-foreground">Kokua Sales CRM</div>
        </div>
        <div className="h-2 w-2 rounded-full bg-primary" title="Online" />
      </div>

      <Separator className="my-4" />

      <nav className="space-y-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
        {admin.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
    </aside>
  );
}

export const sidebarNav = { nav, admin };
