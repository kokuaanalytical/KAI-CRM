import { Suspense } from "react";
import AccountsClient from "./AccountsClient";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <AccountsClient />
    </Suspense>
  );
}

