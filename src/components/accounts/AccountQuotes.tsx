"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileDown, ExternalLink, Trash2 } from "lucide-react";

type QuoteStatus = "draft" | "sent" | "revised" | "accepted" | "rejected" | "expired";
type ChargeType = "monthly" | "per_sample" | "one_time" | "custom";

type Quote = {
  id: string;
  opportunity_id: string | null;
  version: number;
  status: QuoteStatus;
  amount: number;
  currency: string;
  sent_at: string | null;
  expires_at: string | null;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
};

type Opp = { id: string; name: string; stage: string };

type LineItem = {
  description: string;
  charge_type: ChargeType;
  unit_price: string;
  quantity: string;     // allow blank
  unit_label: string;
};

const STATUS_OPTIONS: Array<{ value: QuoteStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "revised", label: "Revised" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const CHARGE_OPTIONS: Array<{ value: ChargeType; label: string }> = [
  { value: "monthly", label: "Monthly recurring" },
  { value: "per_sample", label: "Per-sample" },
  { value: "one_time", label: "One-time" },
  { value: "custom", label: "Custom" },
];

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function AccountQuotes({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<Quote[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // quote form
  const [opportunityId, setOpportunityId] = useState<string>("");
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [currency, setCurrency] = useState<string>("USD");
  const [version, setVersion] = useState<string>("1");
  const [sentAt, setSentAt] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // line items (day one)
  const [lines, setLines] = useState<LineItem[]>([
    { description: "Consulting fee", charge_type: "monthly", unit_price: "3000", quantity: "1", unit_label: "month" },
    { description: "Data review fee", charge_type: "per_sample", unit_price: "5", quantity: "", unit_label: "sample" },
  ]);

  async function load() {
    setErr(null);

    const q = await supabase
      .from("quotes")
      .select("id,opportunity_id,version,status,amount,currency,sent_at,expires_at,notes,pdf_url,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (q.error) setErr(q.error.message);
    setItems((q.data ?? []) as Quote[]);

    const o = await supabase
      .from("opportunities")
      .select("id,name,stage")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (o.error) setErr((e) => e ?? o.error!.message);
    setOpps((o.data ?? []) as Opp[]);
  }

  useEffect(() => { load(); }, [accountId]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { description: "", charge_type: "monthly", unit_price: "", quantity: "", unit_label: "month" },
    ]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  // compute a rough “amount” for the quote row:
  // monthly + one_time + custom totals where qty provided; per_sample excluded from the single amount (kept separate)
  const computedAmount = useMemo(() => {
    let sum = 0;
    for (const l of lines) {
      const qty = l.quantity.trim() === "" ? null : toNum(l.quantity);
      if (qty == null) continue;
      if (l.charge_type === "per_sample") continue;
      sum += toNum(l.unit_price) * qty;
    }
    return sum;
  }, [lines]);

  async function createQuote() {
    setErr(null);
    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setBusy(false);
      return setErr("Not logged in.");
    }

    // basic validation: at least 1 non-empty line
    const cleaned = lines
      .map((l) => ({
        ...l,
        description: l.description.trim(),
        unit_label: l.unit_label.trim(),
      }))
      .filter((l) => l.description.length > 0);

    if (cleaned.length === 0) {
      setBusy(false);
      return setErr("Add at least one line item description.");
    }

    // Insert quote first
    const quoteInsert = await supabase.from("quotes").insert({
      account_id: accountId,
      opportunity_id: opportunityId || null,
      version: Number(version || "1"),
      status,
      amount: computedAmount,
      currency: currency || "USD",
      sent_at: sentAt ? new Date(sentAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      notes: notes.trim() || null,
      owner_user_id: uid,
    }).select("id").maybeSingle();

    if (quoteInsert.error || !quoteInsert.data?.id) {
      setBusy(false);
      return setErr(quoteInsert.error?.message ?? "Failed to create quote.");
    }

    const quoteId = quoteInsert.data.id as string;

    // Insert line items
    const liPayload = cleaned.map((l, idx) => ({
      quote_id: quoteId,
      sort_order: idx,
      description: l.description,
      charge_type: l.charge_type,
      unit_price: toNum(l.unit_price),
      quantity: l.quantity.trim() === "" ? null : toNum(l.quantity),
      unit_label: l.unit_label || null,
      unit_type: "flat",
    }));

    const li = await supabase.from("quote_line_items").insert(liPayload);
    if (li.error) {
      setBusy(false);
      return setErr(li.error.message);
    }

    setBusy(false);
    setOpen(false);

    // reset
    setOpportunityId("");
    setStatus("draft");
    setCurrency("USD");
    setVersion("1");
    setSentAt("");
    setExpiresAt("");
    setNotes("");
    setLines([
      { description: "Consulting fee", charge_type: "monthly", unit_price: "3000", quantity: "1", unit_label: "month" },
      { description: "Data review fee", charge_type: "per_sample", unit_price: "5", quantity: "", unit_label: "sample" },
    ]);

    load();
  }

  async function generatePdf(quoteId: string) {
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/quotes/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId }),
    });
    setBusy(false);
    if (!res.ok) return setErr(await res.text());
    await load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Quotes</div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" /> Create Quote
            </Button>
          </DialogTrigger>

          <DialogContent className="rounded-2xl max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create Quote</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              <Select value={opportunityId || "__none"} onValueChange={(v) => setOpportunityId(v === "__none" ? "" : v)}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Link to opportunity (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">(No opportunity)</SelectItem>
                  {opps.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} • {o.stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-3 gap-3">
                <Input type="number" min={1} placeholder="Version" value={version} onChange={(e) => setVersion(e.target.value)} />
                <Select value={status} onValueChange={(v) => setStatus(v as QuoteStatus)}>
                  <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input type="datetime-local" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>

              <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

              <div className="rounded-2xl border border-border bg-card/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Line items</div>
                  <Button variant="secondary" className="rounded-2xl" onClick={addLine} type="button">
                    + Add line
                  </Button>
                </div>

                <div className="space-y-2">
                  {lines.map((l, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Input
                          placeholder="Description (e.g., Consulting fee)"
                          value={l.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                        />
                      </div>

                      <div className="col-span-3">
                        <Select
                          value={l.charge_type}
                          onValueChange={(v) => updateLine(idx, { charge_type: v as ChargeType })}
                        >
                          <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CHARGE_OPTIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Input
                          placeholder="Unit $"
                          value={l.unit_price}
                          onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                        />
                      </div>

                      <div className="col-span-1">
                        <Input
                          placeholder="Qty"
                          value={l.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                        />
                      </div>

                      <div className="col-span-1">
                        <Input
                          placeholder="Unit"
                          value={l.unit_label}
                          onChange={(e) => updateLine(idx, { unit_label: e.target.value })}
                        />
                      </div>

                      <div className="col-span-12 flex justify-end">
                        <Button
                          variant="secondary"
                          className="rounded-2xl"
                          onClick={() => removeLine(idx)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  Tip: leave Qty blank to show <b>TBD</b> in the PDF.
                </div>

                <div className="text-xs text-muted-foreground">
                  Computed (non per-sample) amount for tracking: <b>{computedAmount.toFixed(2)} {currency}</b>
                </div>
              </div>

              {err && <div className="text-sm text-red-400">{err}</div>}

              <Button className="rounded-2xl" onClick={createQuote} disabled={busy}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {err && <div className="text-sm text-red-400">{err}</div>}

      {items.map((q) => (
        <Card key={q.id} className="rounded-2xl border-border bg-card/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                Quote v{q.version} • {q.amount} {q.currency}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Created: {new Date(q.created_at).toLocaleString()}
                {q.sent_at ? ` • Sent: ${new Date(q.sent_at).toLocaleString()}` : ""}
                {q.expires_at ? ` • Expires: ${new Date(q.expires_at).toLocaleString()}` : ""}
              </div>
              {q.notes && <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{q.notes}</div>}
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-xl">{q.status}</Badge>

              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={() => generatePdf(q.id)}
                disabled={busy}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>

              {q.pdf_url && (
                <a href={q.pdf_url} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="rounded-2xl">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View PDF
                  </Button>
                </a>
              )}
            </div>
          </div>
        </Card>
      ))}

      {items.length === 0 && <div className="text-sm text-muted-foreground">No quotes yet.</div>}
    </div>
  );
}
