import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function auditAi({
  route,
  model,
  accountId,
  prompt,
  output,
}: {
  route: string;
  model?: string | null;
  accountId?: string | null;
  prompt?: any;
  output?: string | null;
}) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    await supabase.from("ai_audit_logs").insert({
      user_id: userId,
      account_id: accountId ?? null,
      route,
      model: model ?? null,
      prompt: prompt ?? null,
      output: output ?? null,
    });
  } catch {
    // never break the request because logging failed
  }
}
