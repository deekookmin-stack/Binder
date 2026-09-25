"use client";

import { useState, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { supabase, Account, Collection, CardSlot } from "@/lib/supabase/client";

type ParsedCard = {
  collection: string;
  member: string;
  qty: number;
};

type MatchResult = {
  parsed: ParsedCard;
  slot: CardSlot | null;
  collection: Collection | null;
  matched: boolean;
};

function parseText(raw: string): ParsedCard[] {
  const lines = raw.split("\n").map((l) => l.trim());
  const cards: ParsedCard[] = [];
  const seen = new Set<string>();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.startsWith("×")) { i++; continue; }

    // find next non-empty line
    let j = i + 1;
    while (j < lines.length && !lines[j]) j++;

    const isQty = j < lines.length && /^\d+$/.test(lines[j]);

    // handle "COLLECTION NAME4" merged pattern (first card sometimes)
    const merged = line.match(/^(.+?)\s*(\d+)$/);

    let collection = "";
    let qty = 0;
    let memberLineIdx = -1;

    if (isQty) {
      collection = (merged ? merged[1] : line).trim();
      qty = parseInt(lines[j]);
      let k = j + 1;
      while (k < lines.length && !lines[k]) k++;
      memberLineIdx = k;
      i = k + 1;
    } else if (merged && parseInt(merged[2]) > 0) {
      collection = merged[1].trim();
      qty = parseInt(merged[2]);
      let k = i + 1;
      while (k < lines.length && !lines[k]) k++;
      memberLineIdx = k;
      i = k + 1;
    } else {
      i++;
      continue;
    }

    const member = memberLineIdx >= 0 && memberLineIdx < lines.length
      ? lines[memberLineIdx].trim()
      : "";

    if (!collection || !member || qty <= 0) continue;

    const key = `${collection.toUpperCase()}||${member.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      cards.push({ collection, member, qty });
    }
  }

  return cards;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchCards(
  parsed: ParsedCard[],
  collections: Collection[],
  slots: CardSlot[]
): MatchResult[] {
  const slotsByCollection = new Map<string, CardSlot[]>();
  for (const s of slots) {
    if (!slotsByCollection.has(s.collection_id)) slotsByCollection.set(s.collection_id, []);
    slotsByCollection.get(s.collection_id)!.push(s);
  }

  return parsed.map((p) => {
    const normCol = normalize(p.collection);
    const normMember = normalize(p.member);

    // find best collection match
    let bestCol: Collection | null = null;
    let bestScore = 0;
    for (const c of collections) {
      const normC = normalize(c.name);
      if (normC === normCol) { bestCol = c; bestScore = 1; break; }
      // partial: one contains the other
      if (normC.includes(normCol) || normCol.includes(normC)) {
        const score = Math.min(normC.length, normCol.length) / Math.max(normC.length, normCol.length);
        if (score > bestScore) { bestScore = score; bestCol = c; }
      }
    }

    if (!bestCol || bestScore < 0.5) return { parsed: p, slot: null, collection: null, matched: false };

    // find slot within that collection by member label
    const colSlots = slotsByCollection.get(bestCol.id) ?? [];
    let bestSlot: CardSlot | null = null;
    let bestSlotScore = 0;
    for (const s of colSlots) {
      const normLabel = normalize(s.label);
      if (normLabel === normMember) { bestSlot = s; bestSlotScore = 1; break; }
      if (normLabel.includes(normMember) || normMember.includes(normLabel)) {
        const score = Math.min(normLabel.length, normMember.length) / Math.max(normLabel.length, normMember.length);
        if (score > bestSlotScore) { bestSlotScore = score; bestSlot = s; }
      }
    }

    if (!bestSlot || bestSlotScore < 0.4) return { parsed: p, slot: null, collection: bestCol, matched: false };
    return { parsed: p, slot: bestSlot, collection: bestCol, matched: true };
  });
}

export default function ImportPage() {
  const [step, setStep] = useState<"pick" | "paste" | "preview" | "done">("pick");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [rawText, setRawText] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [slots, setSlots] = useState<CardSlot[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  async function loadAccounts() {
    setLoading(true);
    const { data } = await supabase.from("accounts").select("*").order("created_at");
    setAccounts((data as Account[]) ?? []);
    setLoading(false);
    setStep("pick");
  }

  useState(() => { loadAccounts(); });

  async function loadCollectionsAndSlots() {
    setLoading(true);
    const [colRes, slotRes] = await Promise.all([
      supabase.from("collections").select("*"),
      supabase.from("card_slots").select("*")
    ]);
    setCollections((colRes.data as Collection[]) ?? []);
    setSlots((slotRes.data as CardSlot[]) ?? []);
    setLoading(false);
  }

  async function handleParse() {
    if (!rawText.trim()) { setError("Paste your BCD cards text first."); return; }
    setError(null);
    setLoading(true);
    if (collections.length === 0) await loadCollectionsAndSlots();
    const parsed = parseText(rawText);
    const matched = matchCards(parsed, collections, slots);
    setResults(matched);
    setStep("preview");
    setLoading(false);
  }

  async function handleSave() {
    if (!selectedAccount) return;
    setSaving(true);
    const matched = results.filter((r) => r.matched && r.slot);
    let count = 0;
    for (const r of matched) {
      const { data: existing } = await supabase
        .from("card_ownership")
        .select("id")
        .eq("account_id", selectedAccount)
        .eq("card_slot_id", r.slot!.id)
        .single();
      if (existing) {
        await supabase
          .from("card_ownership")
          .update({ quantity: r.parsed.qty })
          .eq("id", existing.id);
      } else {
        await supabase.from("card_ownership").insert([{
          account_id: selectedAccount,
          card_slot_id: r.slot!.id,
          quantity: r.parsed.qty
        }]);
      }
      count++;
    }
    setSavedCount(count);
    setSaving(false);
    setStep("done");
  }

  const matched = results.filter((r) => r.matched);
  const unmatched = results.filter((r) => !r.matched);
  const accountName = accounts.find((a) => a.id === selectedAccount)?.name ?? "";

  return (
    <AppShell>
      <h2 className="font-display text-3xl text-ink mb-1">Import cards</h2>
      <p className="text-sm text-inkmuted mb-6">
        Copy your BCD photocards page text and paste it here — deezdex reads your card counts automatically.
      </p>

      {step === "pick" && (
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-card p-5">
            <p className="text-sm font-medium text-ink mb-3">Which account are you importing for?</p>
            {loading ? (
              <p className="text-sm text-inkmuted">Loading accounts…</p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-inkmuted">
                No accounts yet.{" "}
                <a href="/accounts" className="text-violet underline">Add one first</a>.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAccount(a.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm ${
                      selectedAccount === a.id
                        ? "border-violet bg-ruby-bg text-ink"
                        : "border-line text-inkmuted hover:border-violet"
                    }`}
                  >
                    {a.name} {a.is_main && <span className="text-xs text-violet ml-1">★ Main</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setStep("paste")}
            disabled={!selectedAccount}
            className="w-full bg-violet hover:bg-violet-dark text-white rounded-lg py-3 text-sm font-medium transition disabled:opacity-40"
          >
            Continue →
          </button>
        </div>
      )}

      {step === "paste" && (
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-card p-5">
            <p className="text-sm font-medium text-ink mb-1">
              Importing for: <span className="text-violet">{accountName}</span>
            </p>
            <p className="text-xs text-inkmuted mb-4 leading-relaxed">
              Open BCD → Photocards, scroll all the way to the bottom, tap and hold any card text → Select all → Copy. Then paste it in the box below.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={10}
              className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-inkmuted resize-none focus:border-violet"
              placeholder="Paste your BCD cards text here…"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setStep("pick")}
              className="flex-1 border border-line text-inkmuted rounded-lg py-2.5 text-sm"
            >
              Back
            </button>
            <button
              onClick={handleParse}
              disabled={loading}
              className="flex-1 bg-violet hover:bg-violet-dark text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-40"
            >
              {loading ? "Reading…" : "Read cards →"}
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-completebg border border-complete/20 rounded-card p-4 text-center">
              <p className="text-2xl font-display text-complete">{matched.length}</p>
              <p className="text-xs text-inkmuted mt-1">cards matched</p>
            </div>
            <div className="bg-progressbg border border-progress/20 rounded-card p-4 text-center">
              <p className="text-2xl font-display text-progress">{unmatched.length}</p>
              <p className="text-xs text-inkmuted mt-1">not recognised</p>
            </div>
          </div>

          {unmatched.length > 0 && (
            <div className="bg-surface border border-line rounded-card p-4">
              <p className="text-xs font-medium text-inkmuted uppercase tracking-wide mb-2">
                Not recognised — may be new collections not in deezdex yet
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {unmatched.map((r, i) => (
                  <p key={i} className="text-xs text-inkmuted">
                    {r.parsed.collection} · {r.parsed.member}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface border border-line rounded-card p-4">
            <p className="text-xs font-medium text-inkmuted uppercase tracking-wide mb-2">
              Preview — matched cards
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {matched.slice(0, 50).map((r, i) => (
                <div key={i} className="flex justify-between text-xs py-1 border-b border-line last:border-0">
                  <span className="text-ink">{r.collection?.name} · {r.slot?.label}</span>
                  <span className="text-progress font-medium">×{r.parsed.qty}</span>
                </div>
              ))}
              {matched.length > 50 && (
                <p className="text-xs text-inkmuted pt-1">…and {matched.length - 50} more</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("paste")}
              className="flex-1 border border-line text-inkmuted rounded-lg py-2.5 text-sm"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving || matched.length === 0}
              className="flex-1 bg-violet hover:bg-violet-dark text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-40"
            >
              {saving ? "Saving…" : `Save ${matched.length} cards →`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-12 border border-line rounded-card bg-surface">
          <p className="text-4xl mb-3">🦋</p>
          <p className="font-display text-2xl text-ink mb-1">Done!</p>
          <p className="text-sm text-inkmuted mb-6">
            {savedCount} cards saved to <span className="text-violet">{accountName}</span>.
            {unmatched.length > 0 && ` ${unmatched.length} unrecognised cards were skipped — these are likely new BCD collections not in deezdex yet.`}
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/"
              className="bg-violet hover:bg-violet-dark text-white text-sm px-5 py-2.5 rounded-full font-medium transition"
            >
              See dashboard
            </a>
            <button
              onClick={() => {
                setStep("pick");
                setRawText("");
                setResults([]);
              }}
              className="border border-line text-inkmuted text-sm px-5 py-2.5 rounded-full transition hover:border-violet"
            >
              Import another account
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
