"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

export function DeleteAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const ok = confirm("Soft delete this account? (You can restore later in DB)");
    if (!ok) return;

    setBusy(true);
    const { error } = await supabase.rpc("soft_delete_account", { p_account_id: accountId });
    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <Button variant="destructive" className="rounded-2xl" onClick={onDelete} disabled={busy}>
      {busy ? "Deleting…" : "Delete"}
    </Button>
  );
}
