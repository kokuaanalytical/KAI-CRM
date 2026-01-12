import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return NextResponse.json({ user: null }, { status: 200 });

  const accounts = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    user_id: auth.user.id,
    accounts_visible_count: accounts.count ?? null,
    accounts_error: accounts.error?.message ?? null,
  });
}
