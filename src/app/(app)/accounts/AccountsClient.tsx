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

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type ViewMode = "cards" | "list";
type SortKey = "recent" | "name_asc" | "name_desc" | "city_asc" | "state_asc";

const PAGE_SIZE = 200;

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

export default function AccountsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("selected");

  const [query, setQuery] = useState("");
  const qDebounced = useDebounced(query, 250);

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [cityFilter, setCityFilter] = useState<string>("");

  const [accounts, setAccounts] = useState<Account[]>([]);
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

  // Mobile: show detail as a sheet instead of trapping scroll in split view
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setDetailOpen(!!selectedId);
  }, [selectedId]);

  function selectAccount(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("selected", id);
    router.push(`/accounts?${next.toString()}`);
  }

  function clearSelection() {
    const next = new URLSearchParams(params.toString());
    next.delete("selected");
    const qs = next.toString();
    router.push(qs ? `/accounts?${qs}` : "/accounts");
  }

  function buildQuery() {
    let qb = supabase
      .from("accounts_active")
      .select("id,name,clia_name,clia_number,city,state,phone,website,stage,last_activity_at");

    const q = qDebounced.trim();
    if (q) {
      const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      qb = qb.or(`name.ilike.${like},city.ilike.${like},state.ilike.${like},clia_number.ilike.${like}`);
    }

    if (stateFilter !== "ALL") qb = qb.eq("state", stateFilter);
    if (cityFilter.trim()) qb = qb.eq("city", cityFilter.trim());

    if (sortKey === "recent") {
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
    setAccounts(rows);
    setHasMore(rows.length === PAGE_SIZE);
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
    setAccounts((prev) => [...prev, ...rows]);
    setPage(nextPage);
    setHasMore(rows.length === PAGE_SIZE);
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
  }

  return (
    <>
      {/* Desktop/tablet split view */}
      <div className="hidden md:grid h-[calc(100dvh-64px)] min-h-0 grid-cols-[420px_1fr] gap-4">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search targets…" className="rounded-2xl" />

            <div className="grid grid-cols-2 gap-2">
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="rounded-2xl"><SelectValue placeholder="All states" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All states</SelectItem>
                  {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <CityCombobox supabase={supabase} stateFilter={stateFilter} value={cityFilter} onChange={setCityFilter} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant={viewMode === "cards" ? "default" : "secondary"} className="rounded-2xl" onClick={() => setViewMode("cards")}>
                  Cards
                </Button>
                <Button variant={viewMode === "list" ? "default" : "secondary"} className="rounded-2xl" onClick={() => setViewMode("list")}>
                  List
                </Button>
              </div>

              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-[190px] rounded-2xl"><SelectValue placeholder="Sort…" /></SelectTrigger>
                <SelectContent>
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
                  Clear filters
                </Button>
                <Button variant="secondary" className="rounded-2xl" onClick={loadFirstPage} disabled={busy}>
                  Refresh
                </Button>
              </div>
            </div>

            {err && <div className="text-sm text-red-400">{err}</div>}
          </div>

          <div className="min-h-0 flex-1">
            <ScrollArea className="h-full rounded-2xl border border-border bg-card/20 p-3">
              {viewMode === "cards" ? (
                <div className="space-y-3">
                  {accounts.map((a) => (
                    <AccountCard key={a.id} account={a} selected={a.id === selectedId} onSelect={() => selectAccount(a.id)} />
                  ))}
                  {accounts.length === 0 && !busy && (
                    <div className="p-6 text-center text-sm text-muted-foreground">No matching accounts.</div>
                  )}
                  <div ref={sentinelRef} className="h-10" />
                  <div className="pt-1 text-center text-xs text-muted-foreground">
                    {busy ? "Loading more…" : hasMore ? "Scroll for more" : "No more results"}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border overflow-hidden bg-card/10">
                  <div className="max-h-full overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((a) => (
                          <TableRow
                            key={a.id}
                            className={`cursor-pointer ${a.id === selectedId ? "bg-card/40" : ""}`}
                            onClick={() => selectAccount(a.id)}
                          >
                            <TableCell className="font-medium">{a.name}</TableCell>
                            <TableCell className="text-muted-foreground">{a.city ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{a.state ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                        {accounts.length === 0 && !busy && (
                          <TableRow>
                            <TableCell colSpan={3} className="p-6 text-center text-sm text-muted-foreground">
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

        <div className="h-full min-h-0 overflow-auto rounded-2xl border border-border bg-card/20 p-3">
          <AccountDetail account={selected} />
        </div>
      </div>

      {/* Mobile: list full-screen + detail in sheet */}
      <div className="md:hidden h-[calc(100dvh-64px)] min-h-0 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search targets…" className="rounded-2xl" />

          <div className="grid grid-cols-2 gap-2">
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="rounded-2xl"><SelectValue placeholder="All states" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All states</SelectItem>
                {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <CityCombobox supabase={supabase} stateFilter={stateFilter} value={cityFilter} onChange={setCityFilter} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant={viewMode === "cards" ? "default" : "secondary"} className="rounded-2xl" onClick={() => setViewMode("cards")}>
                Cards
              </Button>
              <Button variant={viewMode === "list" ? "default" : "secondary"} className="rounded-2xl" onClick={() => setViewMode("list")}>
                List
              </Button>
            </div>

            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[170px] rounded-2xl"><SelectValue placeholder="Sort…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="name_asc">A–Z</SelectItem>
                <SelectItem value="name_desc">Z–A</SelectItem>
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

        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full rounded-2xl border border-border bg-card/20 p-3 touch-pan-y">
            {viewMode === "cards" ? (
              <div className="space-y-3">
                {accounts.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    selected={a.id === selectedId}
                    onSelect={() => selectAccount(a.id)}
                  />
                ))}
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((a) => (
                        <TableRow
                          key={a.id}
                          className={`cursor-pointer ${a.id === selectedId ? "bg-card/40" : ""}`}
                          onClick={() => selectAccount(a.id)}
                        >
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-muted-foreground">{a.city ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{a.state ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                      {accounts.length === 0 && !busy && (
                        <TableRow>
                          <TableCell colSpan={3} className="p-6 text-center text-sm text-muted-foreground">
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

        <Sheet open={detailOpen} onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) clearSelection();
        }}>
          <SheetContent side="bottom" className="h-[92dvh] p-0">
            <SheetHeader className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-base">
                  {selected?.name ?? "Account"}
                </SheetTitle>
                <Button variant="secondary" className="rounded-2xl" onClick={clearSelection}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            <div className="h-[calc(92dvh-56px)] overflow-auto touch-pan-y px-4 py-3">
              <AccountDetail account={selected} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
