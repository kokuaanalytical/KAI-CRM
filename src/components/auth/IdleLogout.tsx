"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const IDLE_MS = 30 * 60 * 1000;

export function IdleLogout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't run on public/auth pages
    if (
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/accept-invite")
    ) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const kick = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // ✅ server-side signout so proxy cookies are cleared
        router.replace(`/auth/signout?next=${encodeURIComponent(pathname)}`);
      }, IDLE_MS);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, kick, { passive: true }));
    kick();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, kick as any));
    };
  }, [pathname, router]);

  return <>{children}</>;
}
