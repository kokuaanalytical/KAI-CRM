import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decryptJson } from "@/lib/tokenCrypto";

type Body = {
  account_id: string;
  to: string;
  subject: string;
  body_text: string;     // plain text from editor
  body_html?: string;    // optional html (if template provides it)
  include_signature?: boolean;
};

function base64url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nl2brHtml(s: string) {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const payload = (await req.json()) as Body;

  const conn = await supabase
    .from("gmail_connections")
    .select("email,token_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (conn.error || !conn.data) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  const tokens = decryptJson<any>(conn.data.token_encrypted);

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
  oauth2.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  // Build HTML body
  let html = (payload.body_html && payload.body_html.trim())
    ? payload.body_html
    : nl2brHtml(payload.body_text || "");

  // Append Gmail signature (HTML) if requested
  if (payload.include_signature !== false) {
    try {
      const sigRes = await gmail.users.settings.sendAs.get({
        userId: "me",
        sendAsEmail: conn.data.email,
      });

      const sigHtml = (sigRes.data.signature ?? "").trim();
      if (sigHtml) {
        html = `${html}<br/><br/>${sigHtml}`;
      }
    } catch (e: any) {
  console.error("Signature fetch failed:", e?.message ?? e);
}

  }

  // RFC 2822 HTML email
  const rfc2822 =
    `From: ${conn.data.email}\r\n` +
    `To: ${payload.to}\r\n` +
    `Subject: ${payload.subject}\r\n` +
    `Content-Type: text/html; charset="UTF-8"\r\n` +
    `MIME-Version: 1.0\r\n\r\n` +
    `${html}`;

  const sendRes = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: base64url(rfc2822) },
  });

  // Log to activities
  await supabase.from("activities").insert({
    account_id: payload.account_id,
    type: "email",
    subject: payload.subject,
    notes: payload.body_text, // keep plain text in CRM log
    due_at: null,
    completed_at: new Date().toISOString(),
    owner_user_id: user.id,
  });

  return NextResponse.json({
    ok: true,
    gmail_message_id: sendRes.data.id ?? null,
  });
}
