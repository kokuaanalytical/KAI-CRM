import { NextResponse } from "next/server";
import { openai, OPENAI_MODEL } from "@/lib/ai/openai";

export async function POST(req: Request) {
  const { account, contact, intent } = await req.json();

  const resp = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions: "Write a short, professional sales email. No PHI. Output JSON only.",
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: `Account: ${JSON.stringify(account)}\nContact: ${JSON.stringify(contact)}\nIntent: ${intent}\nReturn JSON { "subject": "...", "body": "..." }`,
      }],
    }],
    text: {
      format: {
        type: "json_schema",
        name: "kai_email_draft",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            subject: { type: "string" },
            body: { type: "string" }
          },
          required: ["subject", "body"]
        }
      }
    }
  });

  const text = resp.output_text ?? "{}";
  return NextResponse.json(JSON.parse(text));
}
