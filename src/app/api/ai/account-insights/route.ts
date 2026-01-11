import { NextResponse } from "next/server";
import { openai, OPENAI_MODEL } from "@/lib/ai/openai";

type Payload = {
  account: {
    id: string;
    name: string;
    clia_name?: string;
    clia_number?: string;
    city?: string;
    state?: string;
    website?: string;
    phone?: string;
    stage?: string;
    notes?: string;
  };
  activities: Array<{
    type: string;
    subject: string;
    notes?: string;
    created_at: string;
  }>;
  opportunities: Array<{
    name: string;
    stage: string;
    est_monthly_volume: number;
    expected_close_date: string;
    pricing_tier: string;
  }>;
};

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const body = (await req.json()) as Payload;

  const instructions = `
You are Kai AI, assisting internal Kokua sales reps.
Return concise, practical output for a CRM.
No PHI. No guesses about facts not present.
`;

  const input = [
    {
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: `Account context JSON:\n${JSON.stringify(body, null, 2)}\n\nTask:
1) Provide a short account summary (2-4 bullets)
2) Provide next steps (3-6 bullets) aligned with "email -> call" discipline
3) Provide risk flags (0-5 bullets)
4) Provide a health score 0-100 (higher is better) and a one-line reason
5) Draft a follow-up email (professional, short, references prior context if present)
Return STRICT JSON matching the schema.`,
        },
      ],
    },
  ];

  // Responses API is the recommended API for new projects. :contentReference[oaicite:3]{index=3}
  const resp = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions,
    input,
    // Structured Outputs concept: enforce JSON shape. :contentReference[oaicite:4]{index=4}
    text: {
      format: {
        type: "json_schema",
        name: "kai_account_insights",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary_bullets: { type: "array", items: { type: "string" } },
            next_steps: { type: "array", items: { type: "string" } },
            risk_flags: { type: "array", items: { type: "string" } },
            health: {
              type: "object",
              additionalProperties: false,
              properties: {
                score: { type: "number" },
                reason: { type: "string" },
              },
              required: ["score", "reason"],
            },
            email_draft: { type: "string" },
          },
          required: ["summary_bullets", "next_steps", "risk_flags", "health", "email_draft"],
        },
      },
    },
  });

  const text = resp.output_text ?? "{}";

  return NextResponse.json(JSON.parse(text));
}
