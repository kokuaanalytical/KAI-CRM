import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  // ✅ Always-public routes (must NOT require a session)
 if (
  path.startsWith("/auth") ||
  path.startsWith("/accept-invite") ||
  path.startsWith("/login") ||
  path.startsWith("/app/login") ||
  path.startsWith("/api")
) {
  return res;
}


  // Supabase server client (cookie-based)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in, redirect to login (preserve "next")
  if (!user) {
    const url = req.nextUrl.clone();

    // Prefer /app/login if that route exists, otherwise /login
    url.pathname = "/app/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
