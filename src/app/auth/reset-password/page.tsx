"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // When user clicks recovery link, Supabase sets a session in the browser.
    // If they land here without a session, they won't be able to update password.
    supabase.auth.getSession().then(({ data }) => {
      setReady(true);
      if (!data.session) {
        setErr("Recovery session not found. Please use the password recovery link again.");
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!pw1 || pw1.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw1 !== pw2) return setErr("Passwords do not match.");

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSaving(false);

    if (error) return setErr(error.message);

    setOk("Password updated. You can log in now.");
    setTimeout(() => router.push("/login"), 800);
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Set a new password</h1>

      {ready && err && (
        <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {err}
        </div>
      )}

      {ok && (
        <div className="mt-3 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm">
          {ok}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="space-y-1">
          <label className="text-sm">New password</label>
          <input
            className="w-full rounded-md border bg-transparent p-2"
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Confirm password</label>
          <input
            className="w-full rounded-md border bg-transparent p-2"
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <button
          disabled={saving}
          className="w-full rounded-md border px-3 py-2 text-sm"
          type="submit"
        >
          {saving ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
