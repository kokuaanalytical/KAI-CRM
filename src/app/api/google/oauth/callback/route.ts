import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptJson } from "@/lib/tokenCrypto";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/accounts?gmail=missing_code", req.url));

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token) return NextResponse.redirect(new URL("/accounts?gmail=no_token", req.url));

  // Get the email address via tokeninfo
  const tokenInfo = await oauth2.getTokenInfo(tokens.access_token);
  const email = (tokenInfo.email || "").toLowerCase();
  if (!email) return NextResponse.redirect(new URL("/accounts?gmail=no_email", req.url));

  const encrypted = encryptJson(tokens);

  const up = await supabase.from("gmail_connections").upsert({
    user_id: data.user.id,
    email,
    token_encrypted: encrypted,
  });

  if (up.error) return NextResponse.redirect(new URL(`/accounts?gmail=save_failed`, req.url));

  return NextResponse.redirect(new URL(`/accounts?gmail=connected`, req.url));
}
