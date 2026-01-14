import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(raw: string | null) {
  if (!raw) return "/accounts";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/accounts";
  if (raw.startsWith("/auth") || raw.startsWith("/login")) return "/accounts";
  return raw;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL(`/login?next=${encodeURIComponent(next)}`, url.origin)
  );
}
