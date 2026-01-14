import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { accountId } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const acc = await supabase
    .from("accounts")
    .select("id,name,city,state,stage,owner_user_id,last_activity_at,ai_summary")
    .eq("id", accountId)
    .single();

  if (acc.error) return NextResponse.json({ error: acc.error.message }, { status: 400 });

  const acts = await supabase
    .from("account_activities")
    .select("kind,body,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (acts.error) return NextResponse.json({ error: acts.error.message }, { status: 400 });

  const prompt = {
    account: acc.data,
    activities: acts.data ?? [],
    rules: [
      "OK to include client names.",
      "Do NOT include PHI (no DOBs, MRNs, diagnoses, lab results, patient identifiers).",
      "Summarize sales context only.",
      "Output: 5 bullets + 'Next best action'.",
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
      messages: [
        { role: "system", content: "You are a helpful CRM assistant. Follow the rules strictly." },
        { role: "user", content: JSON.stringify(prompt) },
      ],
      temperature: 0.2,
    }),
  });

  const json = await r.json();
  const text =
    json?.choices?.[0]?.message?.content ??
    "No summary returned.";

  const up = await supabase
    .from("accounts")
    .update({ ai_summary: text, ai_summary_updated_at: new Date().toISOString() })
    .eq("id", accountId);

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

  return NextResponse.json({ summary: text });
}
