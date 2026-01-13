"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Factory (recommended when you want a fresh client per component)
export function createSupabaseBrowserClient() {
  // After the runtime guard above, these are definitely strings.
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}

// Backwards-compatible singleton for existing imports:
//   import { supabase } from "@/lib/supabase/client";
export const supabase = createSupabaseBrowserClient();
