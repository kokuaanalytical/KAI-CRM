"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2, LayoutGrid, CheckSquare, Activity, Sparkles,
  Settings, Upload, MapPinned, Flame, BarChart3, SlidersHorizontal, Shield
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const nav = [
  { href: "/my-day", label: "My Day", icon: Sparkles, color: "bg-violet-500/15 text-violet-300" },
  { href: "/accounts", label: "Accounts", icon: Building2, color: "bg-sky-500/15 text-sky-300" },
  { href: "/pipeline", label: "Pipeline", icon: LayoutGrid, color: "bg-emerald-500/15 text-emerald-300" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, color: "bg-amber-500/15 text-amber-300" },
  { href: "/activities", label: "Activities", icon: Activity, color: "bg-cyan-500/15 text-cyan-300" },
];

const admin = [
  { href: "/import", label: "Import / Export", icon: Upload, color: "bg-indigo-500/15 text-indigo-300" },
  { href: "/admin/reassign", label: "Bulk Reassign", icon: Settings, color: "bg-slate-500/15 text-slate-300" },
  { href: "/admin/auto-assign", label: "Auto‑assign Rules", icon: MapPinned, color: "bg-teal-500/15 text-teal-300" },
  { href: "/admin/flags", label: "Flags", icon: Flame, color: "bg-red-500/15 text-red-300" },
  { href: "/admin/insights", label: "Insights", icon: BarChart3, color: "bg-fuchsia-500/15 text-fuchsia-300" },
  { href: "/admin/tuning", label: "Tuning", icon: SlidersHorizontal, color: "bg-lime-500/15 text-lime-300" },
  { href: "/admin/audit", label: "AI Audit", icon: Shield, color: "bg-orange-500/15 text-orange-300" },
  { href: "/admin", label: "Admin Home", icon: Settings, color: "bg-neutral-500/15 text-neutral-300" },
];

function NavLink({ href, label, Icon, active, color }: any) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
        active ? "bg-secondary text-foreground ring-1 ring-primary/30" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-2xl", color, active && "ring-1 ring-white/10")}>
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
          <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      <Separator className="my-4" />

      <div className="text-xs font-medium text-muted-foreground">Admin</div>
      <nav className="mt-2 space-y-1">
        {admin.map((item) => (
          <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>
    </aside>
  );
}

export const sidebarNav = { nav, admin };
