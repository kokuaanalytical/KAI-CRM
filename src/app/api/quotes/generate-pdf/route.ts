import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type LineItem = {
  description: string;
  charge_type: "monthly" | "per_sample" | "one_time" | "custom";
  unit_price: number;
  quantity: number | null;
  unit_label: string | null;
};

function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildPdfBuffer(opts: {
  quoteId: string;
  version: number;
  currency: string;
  account: { name: string; city: string | null; state: string | null };
  items: LineItem[];
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const logoPath = path.join(process.cwd(), "public", "brand", "logo.png");
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 50, 45, { width: 130 });
      } catch {}
    }

    doc.fontSize(18).text("Quote", 0, 50, { align: "right" });
    doc.fontSize(10).fillColor("#555").text(`Quote ID: ${opts.quoteId}`, { align: "right" });
    doc.text(`Version: v${opts.version}`, { align: "right" });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: "right" });
    doc.moveDown(1.5);

    doc.fillColor("#000").fontSize(12).text("Bill To:");
    doc.fontSize(11).text(opts.account.name);
    doc.fillColor("#555").fontSize(10).text(
      `${opts.account.city ?? ""}${opts.account.city && opts.account.state ? ", " : ""}${opts.account.state ?? ""}`.trim() || "—"
    );
    doc.moveDown(1);

    const x0 = 50;
    const y0 = doc.y + 10;
    const colDesc = x0;
    const colType = 310;
    const colUnit = 410;
    const colQty = 475;
    const colTotal = 530;

    doc.fontSize(10).fillColor("#000");
    doc.text("Description", colDesc, y0);
    doc.text("Category", colType, y0);
    doc.text("Unit", colUnit, y0);
    doc.text("Qty", colQty, y0, { width: 40, align: "right" });
    doc.text("Total", colTotal, y0, { width: 60, align: "right" });

    doc.moveTo(50, y0 + 14).lineTo(560, y0 + 14).strokeColor("#ddd").stroke();

    let y = y0 + 22;

    let totalMonthly = 0;
    let totalOneTime = 0;
    const perSampleLines: Array<{ desc: string; unit: number; label: string; qty: number | null; est: number | null }> = [];
    let totalCustom = 0;

    for (const it of opts.items) {
      const unitPrice = toNum(it.unit_price);
      const qty = it.quantity == null ? null : toNum(it.quantity);
      const unitLabel = (it.unit_label ?? "").trim();

      const lineTotal = qty == null ? null : unitPrice * qty;

      if (it.charge_type === "monthly" && lineTotal != null) totalMonthly += lineTotal;
      if (it.charge_type === "one_time" && lineTotal != null) totalOneTime += lineTotal;
      if (it.charge_type === "custom" && lineTotal != null) totalCustom += lineTotal;

      if (it.charge_type === "per_sample") {
        perSampleLines.push({
          desc: it.description,
          unit: unitPrice,
          label: unitLabel || "sample",
          qty,
          est: lineTotal,
        });
      }

      doc.fillColor("#000").fontSize(10);
      doc.text(it.description, colDesc, y, { width: 250 });

      doc.fillColor("#555").text(
        it.charge_type === "monthly"
          ? "Monthly"
          : it.charge_type === "per_sample"
            ? "Per-sample"
            : it.charge_type === "one_time"
              ? "One-time"
              : "Custom",
        colType,
        y
      );

      doc.fillColor("#000").text(money(unitPrice, opts.currency), colUnit, y);
      doc.fillColor("#000").text(qty == null ? "TBD" : String(qty), colQty, y, { width: 40, align: "right" });
      doc.fillColor("#000").text(lineTotal == null ? "—" : money(lineTotal, opts.currency), colTotal, y, { width: 60, align: "right" });

      y += 18;
      if (y > 690) {
        doc.addPage();
        y = 70;
      }
    }

    doc.moveDown(1);
    doc.moveTo(50, y + 8).lineTo(560, y + 8).strokeColor("#ddd").stroke();
    y += 18;

    doc.fillColor("#000").fontSize(12).text("Totals Summary", 50, y);
    y += 18;

    doc.fontSize(10).fillColor("#000");
    doc.text(`Monthly recurring total: ${money(totalMonthly, opts.currency)}`, 50, y);
    y += 14;

    doc.text(`One-time total: ${money(totalOneTime, opts.currency)}`, 50, y);
    y += 14;

    if (totalCustom > 0) {
      doc.text(`Custom total: ${money(totalCustom, opts.currency)}`, 50, y);
      y += 14;
    }

    if (perSampleLines.length) {
      y += 6;
      doc.fillColor("#000").fontSize(11).text("Per-sample fees", 50, y);
      y += 14;

      doc.fontSize(10).fillColor("#555");
      for (const p of perSampleLines) {
        const base = `${p.desc}: ${money(p.unit, opts.currency)} per ${p.label}`;
        const extra = p.qty == null ? "" : ` • Qty: ${p.qty} • Est: ${money(p.est ?? 0, opts.currency)}`;
        doc.text(base + extra, 60, y);
        y += 13;
        if (y > 720) {
          doc.addPage();
          y = 70;
        }
      }
    }

    y += 12;
    doc.fillColor("#555").fontSize(9).text(
      "Terms: Quote valid until the expiration date (if provided). Pricing subject to final agreement.",
      50,
      y,
      { width: 510 }
    );

    doc.end();
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { quote_id } = await req.json();
  if (!quote_id) return NextResponse.json({ error: "quote_id required" }, { status: 400 });

  const qRes = await supabase
    .from("quotes")
    .select("id,version,currency,account_id")
    .eq("id", quote_id)
    .maybeSingle();

  if (qRes.error || !qRes.data) return NextResponse.json({ error: qRes.error?.message ?? "Quote not found" }, { status: 404 });

  const aRes = await supabase
    .from("accounts")
    .select("id,name,city,state")
    .eq("id", qRes.data.account_id)
    .maybeSingle();

  if (aRes.error || !aRes.data) return NextResponse.json({ error: aRes.error?.message ?? "Account not found" }, { status: 404 });

  const iRes = await supabase
    .from("quote_line_items")
    .select("description,charge_type,unit_price,quantity,unit_label")
    .eq("quote_id", quote_id)
    .order("sort_order", { ascending: true })
    .limit(500);

  if (iRes.error) return NextResponse.json({ error: iRes.error.message }, { status: 400 });

  const pdf = await buildPdfBuffer({
    quoteId: qRes.data.id,
    version: qRes.data.version ?? 1,
    currency: qRes.data.currency ?? "USD",
    account: { name: aRes.data.name, city: aRes.data.city, state: aRes.data.state },
    items: (iRes.data ?? []) as any,
  });

  const pdf_path = `quote-${qRes.data.id}-v${qRes.data.version ?? 1}.pdf`;

  const up = await supabase.storage
    .from("quotes")
    .upload(pdf_path, pdf, { contentType: "application/pdf", upsert: true });

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

  const pub = supabase.storage.from("quotes").getPublicUrl(pdf_path);
  const pdf_url = pub.data.publicUrl;

  const upd = await supabase.from("quotes").update({ pdf_url, pdf_path }).eq("id", quote_id);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });

  return NextResponse.json({ ok: true, pdf_url, pdf_path });
}
