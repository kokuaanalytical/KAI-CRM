"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string | null;
  body_html: string | null;
  created_at: string;
};

export default function AdminTemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  async function load() {
    setMsg(null);
    const res = await supabase
      .from("email_templates")
      .select("id,name,subject,body,body_html,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (res.error) return setMsg(res.error.message);
    setItems((res.data ?? []) as Template[]);
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditing(null);
    setName("");
    setSubject("");
    setBodyText("");
    setBodyHtml("");
    setOpen(true);
  }

  function startEdit(t: Template) {
    setEditing(t);
    setName(t.name);
    setSubject(t.subject);
    setBodyText(t.body ?? "");
    setBodyHtml(t.body_html ?? "");
    setOpen(true);
  }

  const canSave = useMemo(() => {
    return name.trim() && subject.trim() && (bodyText.trim() || bodyHtml.trim());
  }, [name, subject, bodyText, bodyHtml]);

  async function save() {
    setMsg(null);
    if (!canSave) return setMsg("Name + subject + (body text or body html) required.");

    setBusy(true);

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      body: bodyText.trim() || null,
      body_html: bodyHtml.trim() || null,
    };

    if (!editing) {
      const ins = await supabase.from("email_templates").insert(payload);
      setBusy(false);
      if (ins.error) return setMsg(ins.error.message);
      setOpen(false);
      return load();
    }

    const upd = await supabase.from("email_templates").update(payload).eq("id", editing.id);
    setBusy(false);
    if (upd.error) return setMsg(upd.error.message);

    setOpen(false);
    load();
  }

  async function remove(id: string) {
    setMsg(null);
    setBusy(true);
    const del = await supabase.from("email_templates").delete().eq("id", id);
    setBusy(false);
    if (del.error) return setMsg(del.error.message);
    load();
  }

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Admin • Email Templates</div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl" onClick={startCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New template
            </Button>
          </DialogTrigger>

          <DialogContent className="rounded-2xl max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit template" : "Create template"}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              <Input placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />

              <Textarea
                placeholder="Body (plain text) — used when HTML is empty"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="min-h-[140px]"
              />

              <Textarea
                placeholder="Body (HTML) — optional (use for formatting; signature/logo will be appended automatically if enabled)"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className="min-h-[180px]"
              />

              {msg && <div className="text-sm text-red-400">{msg}</div>}

              <div className="flex gap-2">
                <Button className="rounded-2xl" onClick={save} disabled={busy || !canSave}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {msg && <div className="text-sm text-red-400">{msg}</div>}

      <Card className="rounded-2xl border-border bg-card/30 p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[160px]">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-muted-foreground">{t.subject}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="rounded-2xl" onClick={() => startEdit(t)} disabled={busy}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>
                    <Button variant="secondary" className="rounded-2xl" onClick={() => remove(t.id)} disabled={busy}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
                  No templates yet. Click “New template”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
