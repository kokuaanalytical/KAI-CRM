"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import type { Account } from "@/types/crm";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountDetail } from "@/components/accounts/AccountDetail";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Flame, Save, Trash2, Hourglass } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

// ✅ Tier 4 priority badge
import { PriorityBadge } from "@/components/accounts/PriorityBadge";
import { computePriorityScore } from "@/lib/priority/nextAction";

type ViewMode = "cards" | "list";
type SortKey =
  | "recent"
  | "needs_followup"
  | "name_asc"
  | "name_desc"
  | "city_asc"
  | "state_asc";

const PAGE_SIZE = 200;
const STALE_WARN_DAYS = 14;
const STALE_CRIT_DAYS = 30;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA",
  "MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type CityOption = { city: string };

function CityCombobox({
  supabase,
  stateFilter,
  value,
  onChange,
}: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  stateFilter: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounced(search, 200);

  const [options, setOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadCities() {
    setBusy(true);

    const res = await supabase.rpc("city_suggestions", {
      state_code: stateFilter,
      q: searchDebounced.trim() || null,
      lim: 50,
    });

    setBusy(false);

    if (res.error) {
      setOptions([]);
      return;
    }

    const rows = (res.data ?? []) as CityOption[];
    setOptions(rows.map((r) => r.city).filter(Boolean));
  }

  useEffect(() => {
    if (!open) return;
    loadCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stateFilter, searchDebounced]);

  useEffect(() => {
    onChange("");
    setSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFilter]);

  const label = value || "All cities";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="rounded-2xl w-full justify-between" type="button">
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput
            placeholder={stateFilter === "ALL" ? "Search city…" : `Search city in ${stateFilter}…`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{busy ? "Loading…" : "No cities found."}</CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${value === "" ? "opacity-100" : "opacity-0"}`} />
                All cities
              </CommandItem>

              {options.map((c) => (
                <CommandItem
                  key={c}
                  value={c}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === c ? "opacity-100" : "opacity-0"}`} />
                  {c}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  const diff = Date.now() - d;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function StaleBadge({ lastActivityAt }: { lastActivityAt: string | null | undefined }) {
  const d = daysSince(lastActivityAt);
  if (d == null) return null;

  if (d >= STALE_CRIT_DAYS) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-2 py-1 text-xs text-red-300 ring-1 ring-red-500/25">
        <Flame className="h-3.5 w-3.5" /> {d}d stale
      </span>
    );
  }

  if (d >= STALE_WARN_DAYS) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-yellow-500/15 px-2 py-1 text-xs text-yellow-300 ring-1 ring-yellow-500/25">
        <AlertTriangle className="h-3.5 w-3.5" /> {d}d
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
      {d}d
    </span>
  );
}

function FlagBadges({ stale30, unassigned7 }: { stale30?: boolean; unassigned7?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {stale30 ? (
        <span className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-2 py-1 text-xs text-red-300 ring-1 ring-red-500/25">
          <Flame className="h-3.5 w-3.5" /> 30d+
        </span>
      ) : null}
      {unassigned7 ? (
        <span className="inline-flex items-center gap-1 rounded-xl bg-sky-500/15 px-2 py-1 text-xs text-sky-300 ring-1 ring-sky-500/25">
          <Hourglass className="h-3.5 w-3.5" /> Unassigned 7d+
        </span>
      ) : null}
    </div>
  );
}

type SavedViewRow = {
  id: string;
  name: string;
  payload: any;
  is_shared: boolean;
  user_id?: string;
};

type FlagRow = {
  account_id: string;
  stale_30: boolean;
  unassigned_7: boolean;
};

function priorityTooltip(a: any, flags: FlagRow | undefined, score: number) {
  const parts: string[] = [];

  const last = a.last_activity_at ? new Date(a.last_activity_at).getTime() : null;
  if (!last) parts.push("No recorded activity yet");
  else {
    const d = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
    parts.push(`No activity in ${d} days`);
  }

  parts.push(`Stage: ${a.stage ?? "—"}`);
  if (!a.owner_user_id) parts.push("Unassigned owner");
  if (flags?.unassigned_7) parts.push("Unassigned 7d+ flag");
  if (flags?.stale_30) parts.push("Stale 30d+ flag");

  return `Priority score: ${score}/100\n• ` + parts.join("\n• ");
}

export default function AccountsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("selected");

  const [query, setQuery] = useState("");
  const qDebounced = useDebounced(query, 250);

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortKey, setSortKey] = useState<SortKey>("needs_followup");

  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [cityFilter, setCityFilter] = useState<string>("");

  const [accounts, setAccounts] = useState<any[]>([]);
  const [flagsById, setFlagsById] = useState<Record<string, FlagRow>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const requestSeq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  // Saved views
  const [views, setViews] = useState<SavedViewRow[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>("__none__");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveShared, setSaveShared] = useState(false);

  async function loadViews() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return;

    const res = await supabase
      .from("saved_views")
      .select("id,name,payload,is_shared,user_id")
      .eq("kind", "accounts")
      .order("updated_at", { ascending: false });

    if (res.error) {
      setViews([]);
      return;
    }

    setViews((res.data ?? []) as any[]);
  }

  useEffect(() => {
    loadViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function currentPayload() {
    return {
      query,
      stateFilter,
      cityFilter,
      sortKey,
      viewMode,
    };
  }

  async function applyView(id: string) {
    setActiveViewId(id);
    if (id === "__none__") return;

    const v = views.find((x) => x.id === id);
    if (!v) return;

    const p = v.payload ?? {};
    setQuery(p.query ?? "");
    setStateFilter(p.stateFilter ?? "ALL");
    setCityFilter(p.cityFilter ?? "");
    setSortKey(p.sortKey ?? "needs_followup");
    setViewMode(p.viewMode ?? "cards");
  }

  async function saveNewView() {
    setErr(null);
    const name = saveName.trim();
    if (!name) return;

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return;

    const payload = currentPayload();

    const res = await supabase
      .from("saved_views")
      .insert({
        user_id: uid,
        kind: "accounts",
        name,
        payload,
        is_shared: !!saveShared,
      })
      .select("id,name,payload,is_shared")
      .single();

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setSaveOpen(false);
    setSaveName("");
    setSaveShared(false);
    await loadViews();
    setActiveViewId(res.data.id);
  }

  async function updateActiveView() {
    setErr(null);
    if (!activeViewId || activeViewId === "__none__") return;

    const res = await supabase
      .from("saved_views")
      .update({ payload: currentPayload() })
      .eq("id", activeViewId);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    await loadViews();
  }

  async function deleteActiveView() {
    setErr(null);
    if (!activeViewId || activeViewId === "__none__") return;

    const res = await supabase.from("saved_views").delete().eq("id", activeViewId);
    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setActiveViewId("__none__");
    await loadViews();
  }

  function selectAccount(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("selected", id);
    router.push(`/accounts?${next.toString()}`);
  }

  function buildQuery() {
    // ✅ include owner_user_id for priority logic + tooltips
    let qb = supabase
      .from("accounts_active")
      .select("id,name,clia_name,clia_number,city,state,phone,website,stage,last_activity_at,owner_user_id");

    const q = qDebounced.trim();
    if (q) {
      const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      qb = qb.or(`name.ilike.${like},city.ilike.${like},state.ilike.${like},clia_number.ilike.${like}`);
    }

    if (stateFilter !== "ALL") qb = qb.eq("state", stateFilter);
    if (cityFilter.trim()) qb = qb.eq("city", cityFilter.trim());

    if (sortKey === "needs_followup") {
      qb = qb.order("last_activity_at", { ascending: true, nullsFirst: true }).order("name", { ascending: true });
    } else if (sortKey === "recent") {
      qb = qb.order("last_activity_at", { ascending: false, nullsFirst: false }).order("name", { ascending: true });
    } else if (sortKey === "name_asc") {
      qb = qb.order("name", { ascending: true }).order("state", { ascending: true }).order("city", { ascending: true });
    } else if (sortKey === "name_desc") {
      qb = qb.order("name", { ascending: false }).order("state", { ascending: true }).order("city", { ascending: true });
    } else if (sortKey === "city_asc") {
      qb = qb.order("city", { ascending: true, nullsFirst: false }).order("state", { ascending: true }).order("name", { ascending: true });
    } else if (sortKey === "state_asc") {
      qb = qb.order("state", { ascending: true }).order("city", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
    }

    return qb;
  }

  async function loadFlagsForAccounts(accountIds: string[]) {
    if (accountIds.length === 0) return;
    const res = await supabase
      .from("account_flags")
      .select("account_id,stale_30,unassigned_7")
      .in("account_id", accountIds);

    if (res.error) return;

    const next: Record<string, FlagRow> = {};
    (res.data ?? []).forEach((r: any) => {
      next[r.account_id] = r;
    });
    setFlagsById(next);
  }

  async function loadFirstPage() {
    setErr(null);
    setBusy(true);
    setPage(0);
    setHasMore(true);

    const seq = ++requestSeq.current;
    const { data, error } = await buildQuery().range(0, PAGE_SIZE - 1);
    if (seq !== requestSeq.current) return;

    setBusy(false);

    if (error) {
      setErr(error.message);
      setAccounts([]);
      setHasMore(false);
      return;
    }

    const rows = (data ?? []) as Account[];
    setAccounts(rows as any[]);
    setHasMore(rows.length === PAGE_SIZE);

    loadFlagsForAccounts((rows as any[]).map((r) => r.id));
  }

  async function loadMore() {
    if (busy || !hasMore) return;

    setErr(null);
    setBusy(true);

    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const seq = ++requestSeq.current;
    const { data, error } = await buildQuery().range(from, to);
    if (seq !== requestSeq.current) return;

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    const rows = (data ?? []) as Account[];
    setAccounts((prev) => [...prev, ...(rows as any[])]);
    setPage(nextPage);
    setHasMore(rows.length === PAGE_SIZE);

    loadFlagsForAccounts((rows as any[]).map((r) => r.id));
  }

  useEffect(() => {
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, sortKey, stateFilter, cityFilter]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "600px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, busy, page, qDebounced, sortKey, stateFilter, cityFilter]);

  function clearFilters() {
    setStateFilter("ALL");
    setCityFilter("");
    setQuery("");
  }

  const sharedViews = views.filter((v) => v.is_shared);
  const myViews = views.filter((v) => !v.is_shared);

  return (
    <div className="grid h-[calc(100dvh-64px)] min-h-0 grid-cols-1 gap-4 md:grid-cols-[420px_1fr]">
      <div className="flex min-h-0 flex-col gap-3">
        {/* Saved Views */}
        <div className="rounded-2xl border border-border bg-card/20 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Views</div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="rounded-2xl" onClick={() => setSaveOpen(true)}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={updateActiveView}
                disabled={activeViewId === "__none__"}
                title="Update currently selected view"
              >
                Update
              </Button>
              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={deleteActiveView}
                disabled={activeViewId === "__none__"}
                title="Delete currently selected view"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Select value={activeViewId} onValueChange={applyView}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Select a saved view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No saved view</SelectItem>

              {sharedViews.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  🌐 {v.name}
                </SelectItem>
              ))}

              {myViews.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  👤 {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save current view</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g. Needs follow-up (CA)"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveShared}
                    onChange={(e) => setSaveShared(e.target.checked)}
                  />
                  Make this view shared (visible to everyone)
                </label>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setSaveOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="rounded-2xl" onClick={saveNewView}>
                    Save view
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search targets…"
            className="rounded-2xl"
          />

          <div className="grid grid-cols-2 gap-2">
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="All states" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All states</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <CityCombobox supabase={supabase} stateFilter={stateFilter} value={cityFilter} onChange={setCityFilter} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "cards" ? "default" : "secondary"}
                className="rounded-2xl"
                onClick={() => setViewMode("cards")}
              >
                Cards
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "secondary"}
                className="rounded-2xl"
                onClick={() => setViewMode("list")}
              >
                List
              </Button>
            </div>

            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[210px] rounded-2xl">
                <SelectValue placeholder="Sort…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needs_followup">Needs follow‑up</SelectItem>
                <SelectItem value="recent">Recent activity</SelectItem>
                <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z–A)</SelectItem>
                <SelectItem value="city_asc">City</SelectItem>
                <SelectItem value="state_asc">State</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing {accounts.length.toLocaleString()}
              {busy ? " • Loading…" : hasMore ? "" : " • End"}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="rounded-2xl" onClick={clearFilters} disabled={busy}>
                Clear
              </Button>
              <Button variant="secondary" className="rounded-2xl" onClick={loadFirstPage} disabled={busy}>
                Refresh
              </Button>
            </div>
          </div>

          {err && <div className="text-sm text-red-400">{err}</div>}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full rounded-2xl border border-border bg-card/20 p-3 touch-pan-y">
            {viewMode === "cards" ? (
              <div className="space-y-3">
                {accounts.map((a) => {
                  const f = flagsById[a.id];

                  const score = computePriorityScore({
                    id: a.id,
                    name: a.name,
                    stage: a.stage ?? null,
                    owner_user_id: a.owner_user_id ?? null,
                    last_activity_at: a.last_activity_at ?? null,
                    stale_30: !!f?.stale_30,
                    unassigned_7: !!f?.unassigned_7,
                    // lite list scoring (deep signals handled in account detail / my-day)
                    open_tasks_due_soon: 0,
                    open_tasks_total: 0,
                    recent_activity_count: 0,
                    est_monthly_volume: null,
                  });

                  return (
                    <div key={a.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PriorityBadge score={score} tooltip={priorityTooltip(a, f, score)} compact />
                          <StaleBadge lastActivityAt={a.last_activity_at} />
                          <FlagBadges stale30={!!f?.stale_30} unassigned7={!!f?.unassigned_7} />
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Last activity: {a.last_activity_at ? new Date(a.last_activity_at).toLocaleDateString() : "—"}
                        </div>
                      </div>

                      <AccountCard
                        account={a}
                        selected={a.id === selectedId}
                        onSelect={() => selectAccount(a.id)}
                        priorityScore={score}
                        priorityTooltip={priorityTooltip(a, f, score)}
                      />
                    </div>
                  );
                })}

                {accounts.length === 0 && !busy && (
                  <div className="p-6 text-center text-sm text-muted-foreground">No matching accounts.</div>
                )}

                <div ref={sentinelRef} className="h-10" />
                <div className="pt-1 text-center text-xs text-muted-foreground">
                  {busy ? "Loading more…" : hasMore ? "Scroll for more" : "No more results"}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden bg-card/10 touch-pan-y">
                <div className="max-h-full overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Stale</TableHead>
                        <TableHead>Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((a) => {
                        const f = flagsById[a.id];
                        const score = computePriorityScore({
                          id: a.id,
                          name: a.name,
                          stage: a.stage ?? null,
                          owner_user_id: a.owner_user_id ?? null,
                          last_activity_at: a.last_activity_at ?? null,
                          stale_30: !!f?.stale_30,
                          unassigned_7: !!f?.unassigned_7,
                          open_tasks_due_soon: 0,
                          open_tasks_total: 0,
                          recent_activity_count: 0,
                          est_monthly_volume: null,
                        });

                        return (
                          <TableRow
                            key={a.id}
                            className={`cursor-pointer ${a.id === selectedId ? "bg-card/40" : ""}`}
                            onClick={() => selectAccount(a.id)}
                          >
                            <TableCell className="font-medium">{a.name}</TableCell>
                            <TableCell className="text-muted-foreground">{a.city ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{a.state ?? "—"}</TableCell>
                            <TableCell>
                              <PriorityBadge score={score} tooltip={priorityTooltip(a, f, score)} compact />
                            </TableCell>
                            <TableCell><StaleBadge lastActivityAt={a.last_activity_at} /></TableCell>
                            <TableCell><FlagBadges stale30={!!f?.stale_30} unassigned7={!!f?.unassigned_7} /></TableCell>
                          </TableRow>
                        );
                      })}

                      {accounts.length === 0 && !busy && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                            No matching accounts.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <div ref={sentinelRef} className="h-10" />
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    {busy ? "Loading more…" : hasMore ? "Scroll for more" : "No more results"}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Detail */}
      <div className="h-full min-h-0 overflow-auto rounded-2xl border border-border bg-card/20 p-3 touch-pan-y">
        {/* ✅ Key forces remount when switching accounts (fixes "notes/address bleed") */}
        <AccountDetail key={selected?.id ?? "none"} account={selected} />
      </div>
    </div>
  );
}