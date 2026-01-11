import "@/app/globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-dvw overflow-hidden bg-background">
      <div className="flex h-full">
        <Sidebar />
        <div className="flex h-full flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-hidden p-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
