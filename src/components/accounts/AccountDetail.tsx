"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Account } from "@/types/crm";
import { AccountAiPanel } from "@/components/ai/AccountAiPanel";
import { AccountQuickActions } from "@/components/accounts/AccountQuickActions";
import { AccountContacts } from "@/components/accounts/AccountContacts";
import { AccountOpportunities } from "@/components/accounts/AccountOpportunities";
import { AccountTimeline } from "@/components/accounts/AccountTimeline";
import { EmailComposer } from "@/components/email/EmailComposer";
import { AccountQuotes } from "@/components/accounts/AccountQuotes";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AccountDetail({ account }: { account: Account | null }) {
  if (!account) {
    return (
      <Card className="h-full rounded-2xl border-border bg-card/30">
        <CardContent className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Select an account to view details
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full rounded-2xl border-border bg-card/30">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{account.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {account.city}, {account.state} • {account.phone} • {account.website}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              CLIA: {account.clia_name} ({account.clia_number})
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <AccountAiPanel account={account as any} />
            <EmailComposer account={account as any} />
            <AccountQuickActions account={{ id: account.id, name: account.name }} />
          </div>
        </div>

        <Tabs defaultValue="timeline" className="flex-1">
          <TabsList className="rounded-2xl">
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="opps">Opportunities</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-4">
            <AccountContacts accountId={account.id} />
          </TabsContent>

          <TabsContent value="opps" className="mt-4">
            <AccountOpportunities accountId={account.id} />
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            <AccountQuotes accountId={account.id} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <AccountTimeline accountId={account.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
