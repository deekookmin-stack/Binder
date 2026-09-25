"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { loadFullData, buildOwnershipMap, computeSlotStatus, FullData } from "@/lib/data";
import { Collection, CardSlot } from "@/lib/supabase/client";

type TypeFilter = "all" | "regular" | "am";
type SourceFilter = "all" | "have_spare" | "no_spare";

export default function NeededPage() {
  const [data, setData] = useState<FullData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFullData()
      .then(setData)
      .catch((e) => setError(e.message ?? "Something went wrong loading your data."));
  }, []);

  const ownershipMap = useMemo(
    () => (data ? buildOwnershipMap(data.ownership) : new Map()),
    [data]
  );

  const collectionById = useMemo(() => {
    const map = new Map<string, Collection>();
    data?.collections.forEach((c) => map.set(c.id, c));
    return map;
  }, [data]);

  const neededRows = useMemo(() => {
    if (!data) return [];
    const rows: { slot: CardSlot; collection: Collection; needed: number; altSources: { accountName: string; qty: number }[] }[] = [];

    for (const slot of data.slots) {
      const collection = collectionById.get(slot.collection_id);
      if (!collection) continue;
      const status = computeSlotStatus(slot, data.accounts, data.mainAccount?.id ?? null, ownershipMap);
      if (status.needed <= 0) continue;
      rows.push({
        slot,
        collection,
        needed: status.needed,
        altSources: status.altSources.map((s) => ({ accountName: s.accountName, qty: s.qty }))
      });
    }

    return rows
      .filter((r) => typeFilter === "all" || r.collection.type === typeFilter)
      .filter((r) => {
        if (sourceFilter === "all") return true;
        const hasSpare = r.altSources.length > 0;
        return sourceFilter === "have_spare" ? hasSpare : !hasSpare;
      })
      .filter((r) =>
        search.trim()
          ? `${r.collection.name} ${r.slot.label}`.toLowerCase().includes(search.trim().toLowerCase())
          : true
      )
      .sort((a, b) => a.collection.name.localeCompare(b.collection.name));
  }, [data, collectionById, ownershipMap, typeFilter, sourceFilter, search]);

  if (error) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{error}</p>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <p className="text-sm text-inkmuted">Loading…</p>
      </AppShell>
    );
  }

  if (!data.mainAccount) {
    return (
      <AppShell>
        <div className="text-center py-16 border border-dashed border-line rounded-card">
          <p className="text-ink font-medium">Set a main account first</p>
          <p className="text-sm text-inkmuted mt-1">
            Head to Accounts and mark your primary BCD account as main.
          </p>
          <a href="/accounts" className="text-violet underline text-sm mt-2 inline-block">
            Go to Accounts
          </a>
        </div>
      </AppShell>
    );
  }

  const pullableNow = neededRows.filter((r) => r.altSources.length > 0);

  return (
    <AppShell>
      <h2 className="font-display text-3xl text-ink mb-1">Still need</h2>
      <p className="text-sm text-inkmuted mb-6">
        Every card missing a dupe on <strong>{data.mainAccount.name}</strong>.{" "}
        {pullableNow.length > 0 && (
          <span className="text-complete font-medium">
            {pullableNow.length} of these you already have a spare of on another account.
          </span>
        )}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "regular", "am"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`text-sm px-3.5 py-1.5 rounded-full border transition ${
              typeFilter === t ? "bg-violet text-white border-violet" : "border-line text-inkmuted hover:border-violet"
            }`}
          >
            {{ all: "All", regular: "Regular", am: "Album Mission" }[t]}
          </button>
        ))}
        <span className="w-px bg-line mx-1" />
        {(["all", "have_spare", "no_spare"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            className={`text-sm px-3.5 py-1.5 rounded-full border transition ${
              sourceFilter === s ? "bg-violet text-white border-violet" : "border-line text-inkmuted hover:border-violet"
            }`}
          >
            {{ all: "Any source", have_spare: "Pull from alt", no_spare: "Need to acquire" }[s]}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search collection or card…"
        className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-surface text-ink placeholder-inkmuted focus:border-violet mb-6"
      />

      <p className="text-xs text-inkmuted mb-3">{neededRows.length} cards</p>

      {neededRows.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-line rounded-card">
          <p className="text-ink font-medium">Nothing matches — you&apos;re all caught up here 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {neededRows.map((r) => (
            <div
              key={r.slot.id}
              className="bg-surface border border-line rounded-card p-4 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="min-w-0">
                <a
                  href={`/collections/${r.collection.id}`}
                  className="font-medium text-sm text-ink hover:text-violet transition"
                >
                  {r.collection.name}
                </a>
                <p className="text-xs text-inkmuted mt-0.5">
                  {r.slot.label} · need {r.needed} more ·{" "}
                  {r.collection.type === "am" ? (
                    <span className="text-am">Album Mission</span>
                  ) : (
                    <span className="text-regular">Regular</span>
                  )}
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {r.altSources.length > 0 ? (
                  r.altSources.map((s) => (
                    <span
                      key={s.accountName}
                      className="text-xs bg-completebg text-complete px-2.5 py-1 rounded-full font-medium"
                    >
                      {s.accountName} ×{s.qty}
                    </span>
                  ))
                ) : (
                  <span className="text-xs bg-notstartedbg text-notstarted px-2.5 py-1 rounded-full">
                    Not on any account
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
      }
                                            
