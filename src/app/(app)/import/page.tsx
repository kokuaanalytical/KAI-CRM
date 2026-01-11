"use client";

import { useMemo, useState } from "react";
import { parseCsv, toCsv } from "@/lib/csv";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportExportPage() {
  return (
    <div className="h-full space-y-4">
      <div className="text-sm text-muted-foreground">Import / Export</div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AccountsImportCard />
        <ContactsImportCard />
      </div>

      <ExportsCard />
    </div>
  );
}

function AccountsImportCard() {
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const template = useMemo(() => {
    const h = [
      "account_name","clia_name","clia_number","address1","city","state","phone","website","lab_type","notes","owner_email"
    ];
    return toCsv(h, []);
  }, []);

  async function onFile(file: File) {
    setMsg(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    setHeaders(parsed.headers);
    setPreview(parsed.rows.slice(0, 25));
    setMsg(`Loaded ${parsed.rows.length} rows. Review preview, then click Import.`);
    // stash full rows in window (simple, no state bloat)
    (window as any).__kai_accounts_rows = parsed.rows;
  }

  async function importNow() {
    setBusy(true);
    setMsg(null);

    const rows = (window as any).__kai_accounts_rows as Record<string, string>[] | undefined;
    if (!rows || rows.length === 0) {
      setBusy(false);
      return setMsg("No rows loaded yet.");
    }

    const res = await fetch("/api/import/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((r) => ({
          account_name: r.account_name ?? r.name ?? "",
          clia_name: r.clia_name ?? "",
          clia_number: r.clia_number ?? "",
          address1: r.address1 ?? "",
          city: r.city ?? "",
          state: r.state ?? "",
          phone: r.phone ?? "",
          website: r.website ?? "",
          lab_type: r.lab_type ?? "",
          notes: r.notes ?? "",
          owner_email: r.owner_email ?? "",
        })),
      }),
    });

    setBusy(false);

    if (!res.ok) {
      const j = await res.json().catch(() => null);
      if (j?.errors) return setMsg(`Import blocked. First error: row ${j.errors[0].row} — ${j.errors[0].error}`);
      return setMsg(`Import failed: ${(await res.text()) || res.statusText}`);
    }

    const j = await res.json();
    setMsg(`✅ Accounts imported: ${j.inserted} (owner_email respected only for admin).`);
  }

  return (
    <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
      <div className="text-sm font-semibold">Import Accounts (CSV)</div>
      <div className="text-xs text-muted-foreground">
        Maps <b>state → territory</b>. Optional <b>owner_email</b> is <b>admin-only</b>.
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="rounded-2xl" onClick={() => download("kai_accounts_template.csv", template)}>
          Download template
        </Button>

        <label className="inline-flex">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        <Button className="rounded-2xl" onClick={importNow} disabled={busy}>
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>

      {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

      {preview.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {(headers.length ? headers : Object.keys(preview[0])).slice(0, 8).map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((r, i) => (
                <TableRow key={i}>
                  {(headers.length ? headers : Object.keys(r)).slice(0, 8).map((h) => (
                    <TableCell key={h}>{r[h]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function ContactsImportCard() {
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const template = useMemo(() => {
    const h = [
      "account_clia_number","account_name","state",
      "contact_name","title","email","phone","notes"
    ];
    return toCsv(h, []);
  }, []);

  async function onFile(file: File) {
    setMsg(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    setHeaders(parsed.headers);
    setPreview(parsed.rows.slice(0, 25));
    setMsg(`Loaded ${parsed.rows.length} rows. Review preview, then click Import.`);
    (window as any).__kai_contacts_rows = parsed.rows;
  }

  async function importNow() {
    setBusy(true);
    setMsg(null);

    const rows = (window as any).__kai_contacts_rows as Record<string, string>[] | undefined;
    if (!rows || rows.length === 0) {
      setBusy(false);
      return setMsg("No rows loaded yet.");
    }

    const res = await fetch("/api/import/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((r) => ({
          account_clia_number: r.account_clia_number ?? "",
          account_name: r.account_name ?? "",
          state: r.state ?? "",
          contact_name: r.contact_name ?? r.name ?? "",
          title: r.title ?? "",
          email: r.email ?? "",
          phone: r.phone ?? "",
          notes: r.notes ?? "",
        })),
      }),
    });

    setBusy(false);

    if (!res.ok) {
      const j = await res.json().catch(() => null);
      if (j?.errors) return setMsg(`Import blocked. First error: row ${j.errors[0].row} — ${j.errors[0].error}`);
      return setMsg(`Import failed: ${(await res.text()) || res.statusText}`);
    }

    const j = await res.json();
    setMsg(`✅ Contacts imported: ${j.inserted}`);
  }

  return (
    <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
      <div className="text-sm font-semibold">Import Contacts (CSV)</div>
      <div className="text-xs text-muted-foreground">
        Matches to account by <b>account_clia_number</b> first, else <b>account_name + state</b>.
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="rounded-2xl" onClick={() => download("kai_contacts_template.csv", template)}>
          Download template
        </Button>

        <label className="inline-flex">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        <Button className="rounded-2xl" onClick={importNow} disabled={busy}>
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>

      {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

      {preview.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {(headers.length ? headers : Object.keys(preview[0])).slice(0, 8).map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((r, i) => (
                <TableRow key={i}>
                  {(headers.length ? headers : Object.keys(r)).slice(0, 8).map((h) => (
                    <TableCell key={h}>{r[h]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function ExportsCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function exportAccounts() {
    setBusy("accounts"); setMsg(null);
    const { data, error } = await supabase.from("accounts").select("*").limit(10000);
    setBusy(null);
    if (error) return setMsg(error.message);
    const rows = (data ?? []) as any[];
    const headers = ["id","name","clia_name","clia_number","address1","city","state","phone","website","lab_type","stage","notes","owner_user_id","territory_id","created_at","updated_at"];
    download("kai_accounts_export.csv", toCsv(headers, rows));
  }

  async function exportContacts() {
    setBusy("contacts"); setMsg(null);
    const { data, error } = await supabase.from("contacts").select("*").limit(10000);
    setBusy(null);
    if (error) return setMsg(error.message);
    const rows = (data ?? []) as any[];
    const headers = ["id","account_id","name","title","email","phone","notes","owner_user_id","created_at","updated_at"];
    download("kai_contacts_export.csv", toCsv(headers, rows));
  }

  async function exportPipeline() {
    setBusy("pipeline"); setMsg(null);
    const { data, error } = await supabase.from("opportunities").select("*").limit(10000);
    setBusy(null);
    if (error) return setMsg(error.message);
    const rows = (data ?? []) as any[];
    const headers = ["id","account_id","name","stage","est_monthly_volume","expected_close_date","pricing_tier","owner_user_id","created_at","updated_at"];
    download("kai_pipeline_export.csv", toCsv(headers, rows));
  }

  async function exportActivities() {
    setBusy("activities"); setMsg(null);
    const { data, error } = await supabase.from("activities").select("*").limit(20000);
    setBusy(null);
    if (error) return setMsg(error.message);
    const rows = (data ?? []) as any[];
    const headers = ["id","account_id","type","subject","notes","due_at","completed_at","owner_user_id","created_at","updated_at"];
    download("kai_activities_export.csv", toCsv(headers, rows));
  }

  return (
    <Card className="rounded-2xl border-border bg-card/30 p-4 space-y-3">
      <div className="text-sm font-semibold">Export (CSV)</div>
      <div className="flex flex-wrap gap-2">
        <Button className="rounded-2xl" variant="secondary" onClick={exportAccounts} disabled={!!busy}>
          {busy === "accounts" ? "Exporting…" : "Export Accounts"}
        </Button>
        <Button className="rounded-2xl" variant="secondary" onClick={exportContacts} disabled={!!busy}>
          {busy === "contacts" ? "Exporting…" : "Export Contacts"}
        </Button>
        <Button className="rounded-2xl" variant="secondary" onClick={exportPipeline} disabled={!!busy}>
          {busy === "pipeline" ? "Exporting…" : "Export Pipeline"}
        </Button>
        <Button className="rounded-2xl" variant="secondary" onClick={exportActivities} disabled={!!busy}>
          {busy === "activities" ? "Exporting…" : "Export Activities"}
        </Button>
      </div>
      {msg && <div className="text-sm text-red-400">{msg}</div>}
    </Card>
  );
}
