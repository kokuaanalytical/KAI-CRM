import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Insight = {
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  action?: {
    label: string;
    type:
      | "open_account"
      | "open_opportunity"
      | "create_quote"
      | "generate_quote_pdf"
      | "send_quote"
      | "log_call"
      | "log_email"
      | "create_task";
    payload?: Record<string, any>;
  };
};

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const opportunity_id = String(body.opportunity_id ?? "").trim();
  if (!opportunity_id) {
    return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
  }

  // 1) Load opportunity
  const oppRes = await supabase
    .from("opportunities")
    .select("id,account_id,name,stage,amount,created_at,updated_at")
    .eq("id", opportunity_id)
    .maybeSingle();

  if (oppRes.error || !oppRes.data) {
    return NextResponse.json(
      { error: oppRes.error?.message ?? "Opportunity not found" },
      { status: 404 }
    );
  }

  const opp = oppRes.data;

  // 2) Load account
  const accRes = await supabase
    .from("accounts")
    .select("id,name,city,state,last_activity_at,phone,website")
    .eq("id", opp.account_id)
    .maybeSingle();

  if (accRes.error || !accRes.data) {
    return NextResponse.json(
      { error: accRes.error?.message ?? "Account not found" },
      { status: 404 }
    );
  }

  const account = accRes.data;

  // 3) Recent activities
  const actRes = await supabase
    .from("activities")
    .select("id,type,subject,completed_at,created_at")
    .eq("account_id", account.id)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const activities = (actRes.data ?? []) as Array<{
    id: string;
    type: string;
    subject: string | null;
    completed_at: string | null;
    created_at: string;
  }>;

  const lastActivityIso =
    (account as any).last_activity_at ??
    activities.find((a) => a.completed_at)?.completed_at ??
    activities[0]?.created_at ??
    null;

  const lastActivityDays = lastActivityIso
    ? daysBetween(new Date(), new Date(lastActivityIso))
    : null;

  // 4) Quotes for this opportunity (or account if not linked)
  const quotesRes = await supabase
    .from("quotes")
    .select("id,opportunity_id,status,version,pdf_url,pdf_path,sent_at,expires_at,created_at,amount,currency")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const quotes = (quotesRes.data ?? []) as any[];

  const oppQuotes = quotes.filter((q) => q.opportunity_id === opp.id);
  const mostRecentQuote = (oppQuotes[0] ?? null) as any | null;

  // 5) Contacts (to suggest “send quote to” / “email next step”)
  const contactsRes = await supabase
    .from("contacts")
    .select("id,first_name,last_name,email,role,created_at")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const contacts = (contactsRes.data ?? []) as any[];
  const contactWithEmail =
    contacts.find((c) => (c.email ?? "").trim().length > 0) ?? null;

  // Build insights
  const insights: Insight[] = [];

  // A) Stale account / no recent activity
  if (lastActivityDays == null) {
    insights.push({
      severity: "warn",
      title: "No activity logged yet",
      detail:
        "There’s no recorded call/email/task completion for this account. Log first outreach to start tracking time-to-close.",
      action: { label: "Log a call", type: "log_call", payload: { account_id: account.id } },
    });
  } else if (lastActivityDays >= 14) {
    insights.push({
      severity: "critical",
      title: "Opportunity at risk (stale)",
      detail: `No activity in ${lastActivityDays} days. Recommend immediate follow-up to keep momentum.`,
      action: { label: "Create follow-up task", type: "create_task", payload: { account_id: account.id, due_in_days: 1 } },
    });
  } else if (lastActivityDays >= 7) {
    insights.push({
      severity: "warn",
      title: "Follow-up recommended",
      detail: `Last activity was ${lastActivityDays} days ago. Consider a quick check-in email or call.`,
      action: { label: "Log email follow-up", type: "log_email", payload: { account_id: account.id } },
    });
  } else {
    insights.push({
      severity: "info",
      title: "Activity cadence looks good",
      detail: lastActivityDays === 0 ? "Activity logged today." : `Activity within the last ${lastActivityDays} days.`,
    });
  }

  // B) Quote recommendations
  if (!mostRecentQuote) {
    insights.push({
      severity: "warn",
      title: "No quote created for this opportunity",
      detail: "Create a quote with line items so you can generate a branded PDF and send it.",
      action: { label: "Create quote", type: "create_quote", payload: { account_id: account.id, opportunity_id: opp.id } },
    });
  } else {
    if (!mostRecentQuote.pdf_url) {
      insights.push({
        severity: "warn",
        title: `Quote v${mostRecentQuote.version} has no PDF yet`,
        detail: "Generate the branded PDF before sending.",
        action: { label: "Generate PDF", type: "generate_quote_pdf", payload: { quote_id: mostRecentQuote.id } },
      });
    } else if (!mostRecentQuote.sent_at && mostRecentQuote.status !== "sent") {
      if (!contactWithEmail) {
        insights.push({
          severity: "warn",
          title: "Ready to send quote, but no contact email found",
          detail: "Add a contact with an email address so you can send the quote PDF directly.",
          action: { label: "Open account (add contact)", type: "open_account", payload: { account_id: account.id } },
        });
      } else {
        insights.push({
          severity: "info",
          title: "Quote PDF is ready to send",
          detail: `Send Quote v${mostRecentQuote.version} to ${contactWithEmail.email}.`,
          action: {
            label: "Send quote",
            type: "send_quote",
            payload: {
              quote_id: mostRecentQuote.id,
              suggested_to: contactWithEmail.email,
              suggested_subject: `Quote for ${account.name} (v${mostRecentQuote.version})`,
            },
          },
        });
      }
    }

    // Expiration check
    if (mostRecentQuote.expires_at) {
      const expMs = new Date(mostRecentQuote.expires_at).getTime() - Date.now();
      const expInDays = Math.ceil(expMs / (1000 * 60 * 60 * 24));

      if (expInDays <= 0) {
        insights.push({
          severity: "critical",
          title: "Quote is expired",
          detail: "This quote expiration date has passed. Recommend revising and resending.",
          action: { label: "Create revised quote", type: "create_quote", payload: { account_id: account.id, opportunity_id: opp.id } },
        });
      } else if (expInDays <= 7) {
        insights.push({
          severity: "warn",
          title: "Quote expires soon",
          detail: `Quote expires in ${expInDays} day(s). Recommend follow-up before expiration.`,
          action: { label: "Create follow-up task", type: "create_task", payload: { account_id: account.id, due_in_days: 1 } },
        });
      }
    }
  }

  // C) Stage-based nudges
  const stage = String(opp.stage ?? "").toLowerCase();
  if (stage.includes("new") || stage.includes("prospect")) {
    insights.push({
      severity: "info",
      title: "Early-stage suggestion",
      detail: "Confirm decision maker + sample volume estimate. That makes pricing and per-sample fees feel grounded.",
    });
  }
  if (stage.includes("proposal") || stage.includes("quote")) {
    insights.push({
      severity: "info",
      title: "Proposal-stage suggestion",
      detail: "Ask a direct close question: “If pricing looks good, can we start next week?”",
    });
  }

  return NextResponse.json({
    opportunity: {
      id: opp.id,
      name: opp.name,
      stage: opp.stage,
      amount: opp.amount ?? null,
      account_id: opp.account_id,
    },
    account: {
      id: account.id,
      name: account.name,
      city: account.city,
      state: account.state,
      last_activity_at: lastActivityIso,
    },
    stats: {
      last_activity_days_ago: lastActivityDays,
      contacts_with_email: contacts.filter((c) => (c.email ?? "").trim().length > 0).length,
      quotes_for_opportunity: oppQuotes.length,
    },
    insights,
  });
}
