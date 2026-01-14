"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CreateAccountDialog } from "@/components/command/CreateAccountDialog";
import {
  Search,
  Building2,
  LayoutGrid,
  CheckSquare,
  Activity,
  Settings,
  Upload,
  Plus,
  Shield,
  StickyNote,
} from "lucide-react";

type Role = "admin" | "rep" | null;
type AccountHit = { id: string; name: string; city: string | null; state: string | null; clia_number: string | null; };

function isK(e: KeyboardEvent) {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
}

export function CommandPaletteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="rounded-2xl px-3"
      onClick={onClick}
      aria-label="Open command palette"
      title="Search (⌘K / Ctrl+K)"
    >
      <Search className="h-4 w-4" />
    </Button>
  );
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { toast } = useToast();

  const selectedAccountId = sp.get("selected"); // works on /accounts
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [hits, setHits] = useState<AccountHit[]>([]);
  const [busy, setBusy] = useState(false);

  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [quickActivityOpen, setQuickActivityOpen] = useState(false);
  const [quickActivityBody, setQuickActivityBody] = useState("");

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

  async function addQuickActivity() {
    if (!selectedAccountId) return;
    const text = quickActivityBody.trim();
    if (!text) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const res = await supabase.from("account_activities").insert({
      account_id: selectedAccountId,
      user_id: auth.user.id,
      kind: "note",
      body: text,
    });

    if (res.error) {
      toast({ title: "Failed to add activity", description: res.error.message });
      return;
    }

    toast({ title: "Activity added" });
    setQuickActivityBody("");
    setQuickActivityOpen(false);
    onOpenChange(false);
  }

  const nav = [
    { href: "/accounts", label: "Accounts", icon: Building2 },
    { href: "/pipeline", label: "Pipeline", icon: LayoutGrid },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/activities", label: "Activities", icon: Activity },
  ];

  const admin = [
    { href: "/import", label: "Import/Export", icon: Upload },
    { href: "/admin", label: "Admin", icon: Settings },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 sm:max-w-[720px]">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="flex items-center gap-2">
              Command Palette
              <Badge variant="secondary" className="rounded-xl">⌘K / Ctrl+K</Badge>
              {role === "admin" && (
                <Badge variant="secondary" className="rounded-xl flex items-center gap-1">
                  <Shield className="h-3 w-3" /> admin
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-4">
            <Command>
              <CommandInput placeholder="Search accounts… or type a command" value={q} onValueChange={setQ} />
              <CommandList className="max-h-[60vh]">
                <CommandEmpty>
                  {busy ? "Searching…" : q.trim().length < 2 ? "Type 2+ letters to search accounts." : "No results."}
                </CommandEmpty>

                <CommandGroup heading="Create">
                  <CommandItem onSelect={() => setCreateAccountOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create: Account
                  </CommandItem>

                  <CommandItem
                    onSelect={() => {
                      if (!selectedAccountId) {
                        toast({ title: "Select an account first", description: "Open an account in /accounts, then press ⌘K." });
                        return;
                      }
                      setQuickActivityOpen(true);
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

                {role === "admin" && (
                  <CommandGroup heading="Admin">
                    {admin.map((i) => {
                      const Icon = i.icon;
                      return (
                        <CommandItem key={i.href} onSelect={() => go(i.href)}>
                          <Icon className="mr-2 h-4 w-4" />
                          {i.label}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

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

      <Dialog open={quickActivityOpen} onOpenChange={setQuickActivityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add note to selected account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="w-full min-h-28 rounded-2xl border border-border bg-background p-3 text-sm"
              value={quickActivityBody}
              onChange={(e) => setQuickActivityBody(e.target.value)}
              placeholder="Type note…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" className="rounded-2xl" onClick={() => setQuickActivityOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-2xl" onClick={addQuickActivity} disabled={!quickActivityBody.trim()}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
