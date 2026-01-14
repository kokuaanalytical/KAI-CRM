"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CreateAccountDialog } from "@/components/command/CreateAccountDialog";
import { Search, Building2, LayoutGrid, CheckSquare, Activity, Upload, Plus, Sparkles, StickyNote } from "lucide-react";

type Role = "admin" | "rep" | null;
type AccountHit = { id: string; name: string; city: string | null; state: string | null; clia_number: string | null; };

function isK(e: KeyboardEvent) {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
}

export function CommandPaletteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" className="rounded-2xl px-3" onClick={onClick} aria-label="Open command palette">
      <Search className="h-4 w-4" />
    </Button>
  );
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const selectedAccountId = sp.get("selected"); // on /accounts
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [hits, setHits] = useState<AccountHit[]>([]);
  const [busy, setBusy] = useState(false);

  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  // AI dialogs
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isK(e)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) return setRole(null);
      const r = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
      setRole((r.data?.role as Role) ?? "rep");
    })();
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setHits([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }

    const t = setTimeout(async () => {
      setBusy(true);
      const like = `%${query.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      const res = await supabase
        .from("accounts_active")
        .select("id,name,city,state,clia_number")
        .ilike("name", like)
        .order("name", { ascending: true })
        .limit(10);
      setBusy(false);
      setHits((res.data ?? []) as any[]);
    }, 200);

    return () => clearTimeout(t);
  }, [open, q, supabase]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function goAccount(id: string) {
    onOpenChange(false);
    router.push(`/accounts?selected=${encodeURIComponent(id)}`);
  }

  async function aiNext() {
    setAiBusy(true);
    setAiText("");
    try {
      // simple: open My Day (rules) + instruct user to open account for AI detail
      setAiText("Open My Day for prioritized accounts, then open any account to see Next Best Action + Draft Email.");
      setAiOpen(true);
      onOpenChange(false);
      router.push("/my-day");
    } finally {
      setAiBusy(false);
    }
  }

  async function aiPrioritize() {
    setAiBusy(true);
    setAiText("");
    try {
      setAiText("Opening My Day (rules-based prioritization).");
      setAiOpen(true);
      onOpenChange(false);
      router.push("/my-day");
    } finally {
      setAiBusy(false);
    }
  }

  async function aiDraftFollowup() {
    if (!selectedAccountId) {
      toast({ title: "Select an account first", description: "Open an account in /accounts, then press ⌘K." });
      return;
    }
    setAiBusy(true);
    setAiText("");
    try {
      const r = await fetch("/api/ai/draft-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Draft failed");
      setAiText(j.draft ?? "");
      setAiOpen(true);
    } catch (e: any) {
      toast({ title: "Draft failed", description: e?.message ?? String(e) });
    } finally {
      setAiBusy(false);
    }
  }

  async function aiSummarizeSelected() {
    if (!selectedAccountId) {
      toast({ title: "Select an account first", description: "Open an account in /accounts, then press ⌘K." });
      return;
    }
    setAiBusy(true);
    setAiText("");
    try {
      const r = await fetch("/api/ai/account-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Summary failed");
      setAiText(j.summary ?? "");
      setAiOpen(true);
    } catch (e: any) {
      toast({ title: "Summary failed", description: e?.message ?? String(e) });
    } finally {
      setAiBusy(false);
    }
  }

  const nav = [
    { href: "/accounts", label: "Accounts", icon: Building2 },
    { href: "/pipeline", label: "Pipeline", icon: LayoutGrid },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/activities", label: "Activities", icon: Activity },
    { href: "/my-day", label: "My Day", icon: Sparkles },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 sm:max-w-[720px]">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="flex items-center gap-2">
              Command Palette
              <Badge variant="secondary" className="rounded-xl">⌘K / Ctrl+K</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-4">
            <Command>
              <CommandInput placeholder="Search accounts… or type a command" value={q} onValueChange={setQ} />
              <CommandList className="max-h-[60vh]">
                <CommandEmpty>
                  {busy ? "Searching…" : q.trim().length < 2 ? "Type 2+ letters to search accounts." : "No results."}
                </CommandEmpty>

                <CommandGroup heading="AI">
                  <CommandItem onSelect={aiNext}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI: What should I do next?
                  </CommandItem>
                  <CommandItem onSelect={aiPrioritize}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI: Prioritize my accounts
                  </CommandItem>
                  <CommandItem onSelect={aiDraftFollowup}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI: Draft follow-up for selected account
                  </CommandItem>
                  <CommandItem onSelect={aiSummarizeSelected}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI: Summarize selected account
                  </CommandItem>
                </CommandGroup>

                <CommandGroup heading="Create">
                  <CommandItem onSelect={() => setCreateAccountOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create: Account
                  </CommandItem>

                  <CommandItem
                    onSelect={async () => {
                      if (!selectedAccountId) {
                        toast({ title: "Select an account first", description: "Open an account in /accounts, then press ⌘K." });
                        return;
                      }
                      const { data: auth } = await supabase.auth.getUser();
                      if (!auth.user) return;
                      const res = await supabase.from("account_activities").insert({
                        account_id: selectedAccountId,
                        user_id: auth.user.id,
                        kind: "note",
                        body: "Quick note",
                      });
                      if (res.error) toast({ title: "Failed", description: res.error.message });
                      else toast({ title: "Activity added" });
                      onOpenChange(false);
                    }}
                  >
                    <StickyNote className="mr-2 h-4 w-4" />
                    Create: Activity (note) for selected account
                  </CommandItem>

                  {role === "admin" && (
                    <CommandItem onSelect={() => go("/import")}>
                      <Upload className="mr-2 h-4 w-4" />
                      Admin: Import/Export
                    </CommandItem>
                  )}
                </CommandGroup>

                <CommandGroup heading="Navigate">
                  {nav.map((i) => {
                    const Icon = i.icon;
                    return (
                      <CommandItem key={i.href} onSelect={() => go(i.href)}>
                        <Icon className="mr-2 h-4 w-4" />
                        {i.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>

                <CommandGroup heading="Accounts">
                  {hits.map((a) => (
                    <CommandItem key={a.id} onSelect={() => goAccount(a.id)}>
                      <Building2 className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <div className="text-sm font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(a.city ?? "—")}, {(a.state ?? "—")} • CLIA: {a.clia_number ?? "—"}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </DialogContent>
      </Dialog>

      <CreateAccountDialog
        open={createAccountOpen}
        onOpenChange={setCreateAccountOpen}
        onCreated={(id) => {
          onOpenChange(false);
          router.push(`/accounts?selected=${encodeURIComponent(id)}`);
        }}
      />

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI</DialogTitle>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap">{aiBusy ? "Working…" : aiText}</div>
          <div className="text-xs text-muted-foreground">Client names OK • no PHI • no sending</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
