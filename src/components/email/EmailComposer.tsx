"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
};

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string | null;      // existing plain-text column (if you have it)
  body_html: string | null; // new HTML column
};

function contactLabel(c: Contact) {
  const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unnamed contact";
  const email = c.email ? ` — ${c.email}` : " (no email)";
  const role = c.role ? ` • ${c.role}` : "";
  return `${name}${email}${role}`;
}

export function EmailComposer({ account }: { account: any }) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [fromEmail, setFromEmail] = useState<string>("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [contactId, setContactId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);

  const [includeSig, setIncludeSig] = useState(true);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );

  async function load() {
    setMsg(null);

    const conn = await supabase.from("gmail_connections").select("email").maybeSingle();
    if (!conn.error && conn.data?.email) {
      setConnected(true);
      setFromEmail(conn.data.email);
    } else {
      setConnected(false);
      setFromEmail("");
    }

    const c = await supabase
      .from("contacts")
      .select("id,first_name,last_name,email,role")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (c.error) {
      setContacts([]);
      setMsg(`Contacts load failed: ${c.error.message}`);
    } else {
      setContacts((c.data ?? []) as Contact[]);
    }

    const t = await supabase
      .from("email_templates")
      .select("id,name,subject,body,body_html")
      .order("created_at", { ascending: false })
      .limit(200);

    if (t.error) {
      setTemplates([]);
      setMsg((m) => m ?? `Templates load failed: ${t.error.message}`);
    } else {
      setTemplates((t.data ?? []) as Template[]);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pickContact(id: string) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    setTo(c.email ?? "");
  }

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    // prefer html if present, otherwise use plain body text
    if (t.body_html && t.body_html.trim()) {
      setBodyHtml(t.body_html);
      setBodyText(""); // keep editor simple; we send html
    } else {
      setBodyHtml(null);
      setBodyText(t.body ?? "");
    }
  }

  async function aiDraft() {
    setBusy(true);
    setMsg(null);

    const res = await fetch("/api/ai/email-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, contact: selectedContact, intent: "initial outreach / follow-up" }),
    });

    setBusy(false);
    if (!res.ok) return setMsg(await res.text());
    const j = await res.json();

    setSubject(j.subject ?? subject);
    setBodyText(j.body ?? bodyText);
    setBodyHtml(null); // AI draft is plain text; signature will be appended as HTML server-side
  }

  async function send() {
    setMsg(null);
    if (!connected) return setMsg("Connect Gmail first.");
    if (!to.trim()) return setMsg("To is required.");
    if (!subject.trim()) return setMsg("Subject is required.");
    if (!bodyHtml && !bodyText.trim()) return setMsg("Body is required.");

    setBusy(true);
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: account.id,
        to,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        include_signature: includeSig,
      }),
    });
    setBusy(false);

    if (!res.ok) return setMsg(await res.text());
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="rounded-2xl">Email</Button>
      </DialogTrigger>

      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Send Email
            {connected ? (
              <Badge variant="secondary" className="rounded-xl">From: {fromEmail}</Badge>
            ) : (
              <Badge variant="secondary" className="rounded-xl">Gmail not connected</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {!connected && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              To send from your company email, connect Gmail via OAuth.
            </div>
            <a href="/api/google/oauth/start">
              <Button className="rounded-2xl">Connect Gmail</Button>
            </a>
          </div>
        )}

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Select value={contactId} onValueChange={(v) => { setContactId(v); pickContact(v); }}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder={contacts.length ? "Pick contact…" : "No contacts yet"} />
              </SelectTrigger>
              <SelectContent>
                {contacts.length === 0 ? (
                  <SelectItem value="__none" disabled>No contacts found for this account</SelectItem>
                ) : (
                  contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {contactLabel(c)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); applyTemplate(v); }}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder={templates.length ? "Template…" : "No templates yet"} />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <SelectItem value="__none" disabled>No templates yet (admin must create)</SelectItem>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />

          {/* If template uses HTML, we still show a plain editor for now; send uses body_html */}
          <Textarea
            value={bodyHtml ? "[This template is HTML. Edit it in Admin → Templates.]" : bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Email body…"
            className="min-h-[200px]"
            disabled={!!bodyHtml}
          />

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={includeSig} onChange={(e) => setIncludeSig(e.target.checked)} />
            Include my Gmail signature (logo, etc.)
          </label>

          {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

          <div className="flex gap-2">
            <Button variant="secondary" className="rounded-2xl" onClick={aiDraft} disabled={busy}>
              {busy ? "Thinking…" : "AI Draft"}
            </Button>
            <Button className="rounded-2xl" onClick={send} disabled={busy || !connected}>
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
