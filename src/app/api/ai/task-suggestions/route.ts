import { NextResponse } from "next/server";
import { openai, OPENAI_MODEL } from "@/lib/ai/openai";

type Payload = {
  account: {
    id: string;
    name: string;
    city?: string;
    state?: string;
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
    id: string;
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
You are Kai AI generating follow-up TASKS for a sales rep.
No PHI. Be specific and actionable.
Align with discipline: intro email -> follow-up call -> next scheduled touch.
Return STRICT JSON only. Do not exceed 8 tasks.
Each task needs: subject, notes, due_in_days (0-14).
`;

  const input = [
    {
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: `Context JSON:\n${JSON.stringify(body, null, 2)}\n\nGenerate up to 8 tasks.`,
        },
      ],
    },
  ];

  const resp = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions,
    input,
    text: {
      format: {
        type: "json_schema",
        name: "kai_task_suggestions",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            tasks: {
              type: "array",
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  subject: { type: "string" },
                  notes: { type: "string" },
                  due_in_days: { type: "number" }
                },
                required: ["subject", "notes", "due_in_days"]
              }
            }
          },
          required: ["tasks"]
        }
      }
    }
  });

  const text = resp.output_text ?? "{}";
  return NextResponse.json(JSON.parse(text));
}
