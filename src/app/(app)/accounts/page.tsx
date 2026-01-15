export const dynamic = "force-dynamic";

import dynamicImport from "next/dynamic";

const AccountsClient = dynamicImport(() => import("./AccountsClient"), {
  ssr: false,
  loading: () => (
    <div className="p-6 text-sm text-muted-foreground">
      Loading Accounts…
    </div>
  ),
});

export default function Page() {
  return <AccountsClient />;
}
