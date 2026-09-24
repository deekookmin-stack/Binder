"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  loadFullData,
  buildOwnershipMap,
  computeCollectionStatus,
  FullData,
  CollectionStatus
} from "@/lib/data";
import { CardSlot } from "@/lib/supabase/client";

type StatusFilter = "all" | CollectionStatus;
type TypeFilter = "all" | "regular" | "am";
type CategoryFilter = "all" | "group" | "solo";

export default function CollectionsPage() {
  const [data, setData] = useState<FullData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
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

  const slotsByCollection = useMemo(() => {
    const map = new Map<string, CardSlot[]>();
    if (!data) return map;
    for (const s of data.slots) {
      if (!map.has(s.collection_id)) map.set(s.collection_id, []);
      map.get(s.collection_id)!.push(s);
    }
    return map;
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.collections
      .map((c) => {
        const slots = slotsByCollection.get(c.id) ?? [];
        const { status, slotsComplete, totalSlots } = computeCollectionStatus(
          slots,
          data.accounts,
          data.mainAccount?.id ?? null,
          ownershipMap
        );
        return { collection: c, status, slotsComplete, totalSlots };
      })
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => typeFilter === "all" || r.collection.type === typeFilter)
      .filter((r) => categoryFilter === "all" || r.collection.category === categoryFilter)
      .filter((r) =>
        search.trim() ? r.collection.name.toLowerCase().includes(search.trim().toLowerCase()) : true
      );
  }, [data, slotsByCollection, ownershipMap, statusFilter, typeFilter, categoryFilter, search]);

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

  return (
    <AppShell>
      <h2 className="font-display text-3xl text-ink mb-5">Collections</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "complete", "in_progress", "not_started"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-sm px-3.5 py-1.5 rounded-full border transition ${
              statusFilter === s ? "bg-ink text-white border-ink" : "border-line text-inkmuted hover:border-ink"
            }`}
          >
            {{ all: "All", complete: "Complete", in_progress: "In progress", not_started: "Not started" }[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search collection name…"
          className="flex-1 min-w-[200px] border border-line rounded-lg px-3 py-2 text-sm focus:border-violet"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white focus:border-violet"
        >
          <option value="all">Regular + AM</option>
          <option value="regular">Regular only</option>
          <option value="am">Album Mission only</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white focus:border-violet"
        >
          <option value="all">Group + Solo</option>
          <option value="group">Group only</option>
          <option value="solo">Solo only</option>
        </select>
      </div>

      <p className="text-xs text-inkmuted mb-3">{rows.length} collections</p>

      <div className="space-y-2">
        {rows.map((r) => (
          <a
            key={r.collection.id}
            href={`/collections/${r.collection.id}`}
            className="block bg-surface border border-line rounded-card p-4 hover:border-violet transition"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="font-medium text-sm text-ink">{r.collection.name}</p>
              <div className="flex items-center gap-2 shrink-0">
                <TypeTag type={r.collection.type} />
                <StatusTag status={r.status} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-paper rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet rounded-full"
                  style={{
                    width: `${r.totalSlots > 0 ? (r.slotsComplete / r.totalSlots) * 100 : 0}%`
                  }}
                />
              </div>
              <span className="text-xs text-inkmuted shrink-0">
                {r.slotsComplete}/{r.totalSlots}
              </span>
            </div>
          </a>
        ))}
      </div>
    </AppShell>
  );
}

function TypeTag({ type }: { type: "regular" | "am" }) {
  return type === "am" ? (
    <span className="text-[11px] bg-ambg text-am px-2 py-0.5 rounded-full font-medium">AM</span>
  ) : (
    <span className="text-[11px] bg-regularbg text-regular px-2 py-0.5 rounded-full font-medium">
      Regular
    </span>
  );
}

function StatusTag({ status }: { status: CollectionStatus }) {
  const styles = {
    complete: "bg-completebg text-complete",
    in_progress: "bg-progressbg text-progress",
    not_started: "bg-notstartedbg text-notstarted"
  };
  const labels = { complete: "Complete", in_progress: "In progress", not_started: "Not started" };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
