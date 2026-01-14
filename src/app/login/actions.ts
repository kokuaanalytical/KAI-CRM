"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Only allow internal paths for `next` (prevents open-redirect bugs)
function safeNext(raw: string | null | undefined) {
  if (!raw) return "/accounts";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/accounts";
  if (raw.startsWith("/auth") || raw.startsWith("/login")) return "/accounts";
  return raw;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/accounts"));

  if (!email || !password) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        "Missing email or password"
      )}`
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  redirect(next);
}
