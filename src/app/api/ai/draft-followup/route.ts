import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { accountId } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();

  const acc = await supabase
    .from("accounts")
    .select("id,name,city,state,stage,notes,last_activity_at")
    .eq("id", accountId)
    .single();
  if (acc.error) return NextResponse.json({ error: acc.error.message }, { status: 400 });

  const acts = await supabase
    .from("account_activities")
    .select("kind,body,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(10);

  const payload = {
    account: acc.data,
    recent_activity: acts.data ?? [],
    rules: [
      "Client names OK.",
      "No PHI.",
      "Do not mention internal systems.",
      "Return: subject line + email body.",
      "No sending. Draft only.",
    ],
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "You write concise, professional sales follow-ups. Follow rules. No PHI." },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });

  const json = await r.json();
  const draft = json?.choices?.[0]?.message?.content ?? "No draft returned.";

  return NextResponse.json({ draft });
}
