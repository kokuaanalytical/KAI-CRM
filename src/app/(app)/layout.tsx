import "@/app/globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { IdleLogout } from "@/components/auth/IdleLogout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <IdleLogout>
      <div className="h-dvh w-dvw bg-background">
        <div className="flex h-full min-h-0">
          <Sidebar />
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <Topbar />
            {/* ✅ allow scrolling on mobile */}
            <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
          </div>
        </div>
      </div>
    </IdleLogout>
  );
}
