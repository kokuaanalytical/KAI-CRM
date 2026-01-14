"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  LayoutGrid,
  CheckSquare,
  Activity,
  Sparkles,
  Settings,
  Upload,
  MapPinned,
  Flame,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const nav = [
  { href: "/my-day", label: "My Day", icon: Sparkles },
  { href: "/accounts", label: "Accounts", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: LayoutGrid },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/activities", label: "Activities", icon: Activity },
];

const admin = [
  { href: "/import", label: "Import/Export", icon: Upload },
  { href: "/admin/reassign", label: "Bulk Reassign", icon: Settings },
  { href: "/admin/auto-assign", label: "Auto-assign Rules", icon: MapPinned },
  { href: "/admin/flags", label: "Flags", icon: Flame },
  { href: "/admin", label: "Admin Home", icon: Settings },
];

function NavLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: any;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
        active
          ? "bg-secondary text-foreground ring-1 ring-primary/30"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-2xl",
          active ? "bg-background/40" : "bg-background/20"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

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
        {nav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            Icon={item.icon}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      <Separator className="my-4" />

      <div className="text-xs font-medium text-muted-foreground">Admin</div>
      <nav className="mt-2 space-y-1">
        {admin.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            Icon={item.icon}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>
    </aside>
  );
}

export const sidebarNav = { nav, admin };
