"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { supabase, Account, Collection, CardSlot } from "@/lib/supabase/client";

type ParsedCard = {
  collection: string;
  member: string;
  qty: number;
  image_url?: string | null;
};

type MatchResult = {
  parsed: ParsedCard;
  slot: CardSlot | null;
  collection: Collection | null;
  matched: boolean;
};

// Parse pasted BCD text (phone method)
function parseText(raw: string): ParsedCard[] {
  const lines = raw.split("\n").map((l) => l.trim());
  const cards: ParsedCard[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.startsWith("×")) { i++; continue; }
    let j = i + 1;
    while (j < lines.length && !lines[j]) j++;
    const isQty = j < lines.length && /^\d+$/.test(lines[j]);
    const merged = line.match(/^(.+?)\s*(\d+)$/);
    let collection = "", qty = 0, memberLineIdx = -1;
    if (isQty) {
      collection = (merged ? merged[1] : line).trim();
      qty = parseInt(lines[j]);
      let k = j + 1;
      while (k < lines.length && !lines[k]) k++;
      memberLineIdx = k; i = k + 1;
    } else if (merged && parseInt(merged[2]) > 0) {
      collection = merged[1].trim(); qty = parseInt(merged[2]);
      let k = i + 1;
      while (k < lines.length && !lines[k]) k++;
      memberLineIdx = k; i = k + 1;
    } else { i++; continue; }
    const member = memberLineIdx >= 0 && memberLineIdx < lines.length ? lines[memberLineIdx].trim() : "";
    if (!collection || !member || qty <= 0) continue;
    const key = `${collection.toUpperCase()}||${member.toLowerCase()}`;
    if (!seen.has(key)) { seen.add(key); cards.push({ collection, member, qty }); }
  }
  return cards;
}

// Parse exported JSON file (PC scraper method)
function parseJson(json: string): ParsedCard[] {
  try {
    const data = JSON.parse(json);
    if (!data.cards || !Array.isArray(data.cards)) throw new Error("Invalid format");
    const seen = new Set<string>();
    const cards: ParsedCard[] = [];
    for (const c of data.cards) {
      const key = `${(c.collection||'').toUpperCase()}||${(c.member||'').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        cards.push({ collection: c.collection, member: c.member, qty: c.qty || 1, image_url: c.image_url || null });
      }
    }
    return cards;
  } catch {
    throw new Error("Couldn't read the file — make sure you're uploading the .json file exported by the scraper script.");
  }
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchCards(parsed: ParsedCard[], collections: Collection[], slots: CardSlot[]): MatchResult[] {
  const slotsByCollection = new Map<string, CardSlot[]>();
  for (const s of slots) {
    if (!slotsByCollection.has(s.collection_id)) slotsByCollection.set(s.collection_id, []);
    slotsByCollection.get(s.collection_id)!.push(s);
  }
  return parsed.map((p) => {
    const normCol = normalize(p.collection);
    const normMember = normalize(p.member);
    let bestCol: Collection | null = null, bestScore = 0;
    for (const c of collections) {
      const normC = normalize(c.name);
      if (normC === normCol) { bestCol = c; bestScore = 1; break; }
      if (normC.includes(normCol) || normCol.includes(normC)) {
        const score = Math.min(normC.length, normCol.length) / Math.max(normC.length, normCol.length);
        if (score > bestScore) { bestScore = score; bestCol = c; }
      }
    }
    if (!bestCol || bestScore < 0.5) return { parsed: p, slot: null, collection: null, matched: false };
    const colSlots = slotsByCollection.get(bestCol.id) ?? [];
    let bestSlot: CardSlot | null = null, bestSlotScore = 0;
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
  const [step, setStep] = useState<"pick" | "input" | "preview" | "done">("pick");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [rawText, setRawText] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [slots, setSlots] = useState<CardSlot[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [hasImages, setHasImages] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("accounts").select("*").order("created_at").then(({ data }) => {
      setAccounts((data as Account[]) ?? []);
    });
  }, []);

  async function loadCollectionsAndSlots(): Promise<{ cols: Collection[]; sls: CardSlot[] }> {
    if (collections.length > 0 && slots.length > 0) {
      return { cols: collections, sls: slots };
    }
    const [colRes, slotRes] = await Promise.all([
      supabase.from("collections").select("*"),
      supabase.from("card_slots").select("*")
    ]);
    const cols = (colRes.data as Collection[]) ?? [];
    const sls = (slotRes.data as CardSlot[]) ?? [];
    setCollections(cols);
    setSlots(sls);
    return { cols, sls };
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = parseJson(text);
      setHasImages(parsed.some((c) => !!c.image_url));
      const { cols, sls } = await loadCollectionsAndSlots();
      const matched = matchCards(parsed, cols, sls);
      setResults(matched);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setLoading(false);
  }

  async function handleParseText() {
    if (!rawText.trim()) { setError("Paste your BCD cards text first."); return; }
    setError(null);
    setLoading(true);
    const { cols, sls } = await loadCollectionsAndSlots();
    const parsed = parseText(rawText);
    setHasImages(false);
    const matched = matchCards(parsed, cols, sls);
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
      // Save ownership count
      const { data: existing } = await supabase
        .from("card_ownership").select("id")
        .eq("account_id", selectedAccount).eq("card_slot_id", r.slot!.id).single();
      if (existing) {
        await supabase.from("card_ownership").update({ quantity: r.parsed.qty }).eq("id", existing.id);
      } else {
        await supabase.from("card_ownership").insert([{ account_id: selectedAccount, card_slot_id: r.slot!.id, quantity: r.parsed.qty }]);
      }
      // Save image URL if present
      if (r.parsed.image_url) {
        await supabase.from("card_slots").update({ image_url: r.parsed.image_url }).eq("id", r.slot!.id);
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
      <p className="text-sm text-inkmuted mb-6">Load your BCD card counts into deezdex — either via the scraper script (PC, includes images) or by pasting text (phone).</p>

      {step === "pick" && (
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-card p-5">
            <p className="text-sm font-medium text-ink mb-3">Which account are you importing for?</p>
            {accounts.length === 0 ? (
              <p className="text-sm text-inkmuted">No accounts yet. <a href="/accounts" className="text-violet underline">Add one first</a>.</p>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <button key={a.id} onClick={() => setSelectedAccount(a.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm ${selectedAccount === a.id ? "border-violet bg-ruby-bg text-ink" : "border-line text-inkmuted hover:border-violet"}`}>
                    {a.name} {a.is_main && <span className="text-xs text-violet ml-1">★ Main</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setStep("input")} disabled={!selectedAccount}
            className="w-full bg-violet hover:bg-violet-dark text-white rounded-lg py-3 text-sm font-medium transition disabled:opacity-40">
            Continue →
          </button>
        </div>
      )}

      {step === "input" && (
        <div className="space-y-4">
          <p className="text-sm text-inkmuted">Importing for: <span className="text-violet font-medium">{accountName}</span></p>

          <div className="flex gap-2 mb-2">
            <button onClick={() => setInputMode("file")}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${inputMode === "file" ? "border-violet bg-ruby-bg text-ink" : "border-line text-inkmuted"}`}>
              📁 Upload .json file
            </button>
            <button onClick={() => setInputMode("text")}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${inputMode === "text" ? "border-violet bg-ruby-bg text-ink" : "border-line text-inkmuted"}`}>
              📋 Paste text
            </button>
          </div>

          {inputMode === "file" ? (
            <div className="bg-surface border border-line rounded-card p-5">
              <p className="text-xs text-inkmuted mb-3 leading-relaxed">
                Run the scraper script on your PC (get it from the <a href="https://claude.ai/artifact/EBb3Tq6FEWyMEP8Wf98WKg" target="_blank" className="text-violet underline">script page</a>), then upload the .json file it downloads. This also imports card images automatically.
              </p>
              <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={loading}
                className="w-full border border-violet text-violet rounded-lg py-3 text-sm font-medium transition hover:bg-ruby-bg disabled:opacity-40">
                {loading ? "Reading file…" : "Choose .json file"}
              </button>
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-card p-5">
              <p className="text-xs text-inkmuted mb-3 leading-relaxed">
                Open BCD → Photocards, scroll to the bottom, tap and hold any card text → Select all → Copy. Paste below.
              </p>
              <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={8}
                className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-inkmuted resize-none focus:border-violet"
                placeholder="Paste your BCD cards text here…" />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep("pick")} className="flex-1 border border-line text-inkmuted rounded-lg py-2.5 text-sm">Back</button>
            {inputMode === "text" && (
              <button onClick={handleParseText} disabled={loading}
                className="flex-1 bg-violet hover:bg-violet-dark text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-40">
                {loading ? "Reading…" : "Read cards →"}
              </button>
            )}
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-completebg border border-complete/20 rounded-card p-4 text-center">
              <p className="text-2xl font-display text-complete">{matched.length}</p>
              <p className="text-xs text-inkmuted mt-1">cards matched{hasImages ? " + images" : ""}</p>
            </div>
            <div className="bg-progressbg border border-progress/20 rounded-card p-4 text-center">
              <p className="text-2xl font-display text-progress">{unmatched.length}</p>
              <p className="text-xs text-inkmuted mt-1">not recognised</p>
            </div>
          </div>

          {unmatched.length > 0 && (
            <div className="bg-surface border border-line rounded-card p-4">
              <p className="text-xs font-medium text-inkmuted uppercase tracking-wide mb-2">Not recognised — likely new BCD collections</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {unmatched.map((r, i) => (
                  <p key={i} className="text-xs text-inkmuted">{r.parsed.collection} · {r.parsed.member}</p>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface border border-line rounded-card p-4">
            <p className="text-xs font-medium text-inkmuted uppercase tracking-wide mb-2">Preview — first 50 matched</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {matched.slice(0, 50).map((r, i) => (
                <div key={i} className="flex justify-between text-xs py-1 border-b border-line last:border-0">
                  <span className="text-ink truncate mr-2">{r.collection?.name} · {r.slot?.label}</span>
                  <span className="text-progress font-medium shrink-0">×{r.parsed.qty}</span>
                </div>
              ))}
              {matched.length > 50 && <p className="text-xs text-inkmuted pt-1">…and {matched.length - 50} more</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("input")} className="flex-1 border border-line text-inkmuted rounded-lg py-2.5 text-sm">Back</button>
            <button onClick={handleSave} disabled={saving || matched.length === 0}
              className="flex-1 bg-violet hover:bg-violet-dark text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-40">
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
            {hasImages && " Card images imported too."}
            {unmatched.length > 0 && ` ${unmatched.length} unrecognised cards skipped — these may be new collections not in deezdex yet.`}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="/" className="bg-violet hover:bg-violet-dark text-white text-sm px-5 py-2.5 rounded-full font-medium transition">See dashboard</a>
            <button onClick={() => { setStep("pick"); setRawText(""); setResults([]); setHasImages(false); }}
              className="border border-line text-inkmuted text-sm px-5 py-2.5 rounded-full transition hover:border-violet">
              Import another account
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
