import "@/app/globals.css";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { IdleLogout } from "@/components/auth/IdleLogout";
import { Toaster } from "@/components/ui/toaster";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <IdleLogout>
      <div className="h-dvh w-dvw bg-background">
        <div className="flex h-full min-h-0">
          <Sidebar />
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <Topbar />
            <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
          </div>
        </div>

        <Toaster />
      </div>
    </IdleLogout>
  );
}
