import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Always allow auth pages (invite/reset/callback flows)
  if (pathname.startsWith("/auth")) return NextResponse.next();

  // ✅ Allow login page
  if (pathname === "/app/login") return NextResponse.next();

  // ✅ Only protect your app area
  if (!pathname.startsWith("/app")) return NextResponse.next();

  // If you already enforce auth somewhere else, this alone fixes the redirect problem.
  // (You can add real auth checks here later if you want.)
  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
