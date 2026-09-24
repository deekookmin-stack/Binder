"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { loadFullData, buildOwnershipMap, computeCollectionStatus, FullData } from "@/lib/data";

export default function DashboardPage() {
  const [data, setData] = useState<FullData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFullData()
      .then(setData)
      .catch((e) => setError(e.message ?? "Something went wrong loading your data."));
  }, []);

  const ownershipMap = useMemo(
    () => (data ? buildOwnershipMap(data.ownership) : new Map()),
    [data]
  );

  const stats = useMemo(() => {
    if (!data) return null;
    const bySlot = new Map<string, typeof data.slots>();
    for (const s of data.slots) {
      if (!bySlot.has(s.collection_id)) bySlot.set(s.collection_id, []);
      bySlot.get(s.collection_id)!.push(s);
    }

    let complete = 0;
    let inProgress = 0;
    let notStarted = 0;
    let completeAM = 0,
      completeRegular = 0,
      totalAM = 0,
      totalRegular = 0;

    for (const c of data.collections) {
      const slots = bySlot.get(c.id) ?? [];
      const { status } = computeCollectionStatus(
        slots,
        data.accounts,
        data.mainAccount?.id ?? null,
        ownershipMap
      );
      if (status === "complete") complete += 1;
      else if (status === "in_progress") inProgress += 1;
      else notStarted += 1;

      if (c.type === "am") {
        totalAM += 1;
        if (status === "complete") completeAM += 1;
      } else {
        totalRegular += 1;
        if (status === "complete") completeRegular += 1;
      }
    }

    return {
      total: data.collections.length,
      complete,
      inProgress,
      notStarted,
      completeAM,
      totalAM,
      completeRegular,
      totalRegular
    };
  }, [data, ownershipMap]);

  if (error) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{error}</p>
      </AppShell>
    );
  }

  if (!data || !stats) {
    return (
      <AppShell>
        <p className="text-sm text-inkmuted">Loading your collection…</p>
      </AppShell>
    );
  }

  const pct = stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0;

  return (
    <AppShell>
      {!data.mainAccount && (
        <div className="mb-6 bg-progressbg border border-progress/30 rounded-card p-4">
          <p className="text-sm text-ink">
            <strong>No main account set yet.</strong> Head to{" "}
            <a href="/accounts" className="text-violet underline">
              Accounts
            </a>{" "}
            and add your accounts — mark your primary BCD account as &quot;main&quot; so progress
            can be tracked.
          </p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="font-display text-3xl text-ink">Your progress</h2>
        <p className="text-sm text-inkmuted mt-1">
          {stats.complete} of {stats.total} collections fully duped on{" "}
          {data.mainAccount ? <strong>{data.mainAccount.name}</strong> : "your main account"} —{" "}
          {pct}% complete.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Complete"
          value={stats.complete}
          sub="every card duped"
          color="complete"
        />
        <StatCard
          label="In progress"
          value={stats.inProgress}
          sub="some cards missing"
          color="progress"
        />
        <StatCard
          label="Not started"
          value={stats.notStarted}
          sub="nothing owned yet"
          color="notstarted"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-surface border border-line rounded-card p-5">
          <p className="text-xs font-medium text-regular uppercase tracking-wide mb-1">Regular</p>
          <p className="text-2xl font-display text-ink">
            {stats.completeRegular}
            <span className="text-inkmuted text-base font-body"> / {stats.totalRegular}</span>
          </p>
          <p className="text-xs text-inkmuted mt-1">magic shop &amp; game pulls</p>
        </div>
        <div className="bg-surface border border-line rounded-card p-5">
          <p className="text-xs font-medium text-am uppercase tracking-wide mb-1">Album Mission</p>
          <p className="text-2xl font-display text-ink">
            {stats.completeAM}
            <span className="text-inkmuted text-base font-body"> / {stats.totalAM}</span>
          </p>
          <p className="text-xs text-inkmuted mt-1">stream-to-unlock only</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href="/needed"
          className="bg-violet hover:bg-violet-dark text-white text-sm px-4 py-2.5 rounded-full font-medium transition"
        >
          See what you still need →
        </a>
        <a
          href="/collections"
          className="border border-line text-ink text-sm px-4 py-2.5 rounded-full font-medium transition hover:border-violet"
        >
          Browse all collections
        </a>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  color
}: {
  label: string;
  value: number;
  sub: string;
  color: "complete" | "progress" | "notstarted";
}) {
  const bg = { complete: "bg-completebg", progress: "bg-progressbg", notstarted: "bg-notstartedbg" }[
    color
  ];
  const text = { complete: "text-complete", progress: "text-progress", notstarted: "text-notstarted" }[
    color
  ];
  return (
    <div className={`rounded-card p-5 ${bg}`}>
      <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${text}`}>{label}</p>
      <p className="text-3xl font-display text-ink">{value}</p>
      <p className="text-xs text-inkmuted mt-1">{sub}</p>
    </div>
  );
}
