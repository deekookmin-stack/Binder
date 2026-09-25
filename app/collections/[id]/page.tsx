"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase, Account, Collection, CardSlot, CardOwnership, DUPE_TARGET } from "@/lib/supabase/client";

export default function CollectionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [slots, setSlots] = useState<CardSlot[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ownership, setOwnership] = useState<CardOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    const [colRes, slotsRes, accRes] = await Promise.all([
      supabase.from("collections").select("*").eq("id", id).single(),
      supabase.from("card_slots").select("*").eq("collection_id", id).order("slot_order"),
      supabase.from("accounts").select("*").order("created_at")
    ]);

    if (colRes.error) {
      setError(colRes.error.message);
      setLoading(false);
      return;
    }
    setCollection(colRes.data as Collection);
    setSlots((slotsRes.data ?? []) as CardSlot[]);
    setAccounts((accRes.data ?? []) as Account[]);

    const slotIds = (slotsRes.data ?? []).map((s: CardSlot) => s.id);
    if (slotIds.length > 0) {
      const ownRes = await supabase.from("card_ownership").select("*").in("card_slot_id", slotIds);
      setOwnership((ownRes.data ?? []) as CardOwnership[]);
    }
    setLoading(false);
  }

  const ownershipMap = useMemo(() => {
    const map = new Map<string, number>(); // `${accountId}:${slotId}` -> qty
    for (const o of ownership) map.set(`${o.account_id}:${o.card_slot_id}`, o.quantity);
    return map;
  }, [ownership]);

  const mainAccount = accounts.find((a) => a.is_main) ?? null;

  async function handleSetImage(slot: CardSlot) {
    const url = window.prompt("Paste an image link for this card (leave blank to remove):", slot.image_url ?? "");
    if (url === null) return;
    const cleanUrl = url.trim() || null;
    await supabase.from("card_slots").update({ image_url: cleanUrl }).eq("id", slot.id);
    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, image_url: cleanUrl } : s)));
  }

  async function updateQty(accountId: string, slotId: string, qty: number) {
    const safeQty = Math.max(0, Math.min(99, qty));
    const key = `${accountId}:${slotId}`;
    setSaving(key);

    const existing = ownership.find((o) => o.account_id === accountId && o.card_slot_id === slotId);
    if (existing) {
      await supabase.from("card_ownership").update({ quantity: safeQty }).eq("id", existing.id);
    } else {
      await supabase
        .from("card_ownership")
        .insert([{ account_id: accountId, card_slot_id: slotId, quantity: safeQty }]);
    }

    setOwnership((prev) => {
      const idx = prev.findIndex((o) => o.account_id === accountId && o.card_slot_id === slotId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: safeQty };
        return copy;
      }
      return [
        ...prev,
        { id: crypto.randomUUID(), account_id: accountId, card_slot_id: slotId, quantity: safeQty }
      ];
    });
    setSaving(null);
  }

  if (error) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{error}</p>
      </AppShell>
    );
  }

  if (loading || !collection) {
    return (
      <AppShell>
        <p className="text-sm text-inkmuted">Loading…</p>
      </AppShell>
    );
  }

  if (accounts.length === 0) {
    return (
      <AppShell>
        <div className="text-center py-16 border border-dashed border-line rounded-card">
          <p className="text-ink font-medium">Add an account first</p>
          <p className="text-sm text-inkmuted mt-1">
            You need at least one account before entering card counts.
          </p>
          <a href="/accounts" className="text-violet underline text-sm mt-2 inline-block">
            Go to Accounts
          </a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <a href="/collections" className="text-sm text-inkmuted hover:text-ink transition">
        ← All collections
      </a>

      <div className="flex items-center gap-2 mt-2 mb-1">
        <h2 className="font-display text-3xl text-ink">{collection.name}</h2>
        {collection.type === "am" ? (
          <span className="text-xs bg-ambg text-am px-2 py-0.5 rounded-full font-medium">
            Album Mission
          </span>
        ) : (
          <span className="text-xs bg-regularbg text-regular px-2 py-0.5 rounded-full font-medium">
            Regular
          </span>
        )}
      </div>
      <p className="text-sm text-inkmuted mb-6">
        Goal: {DUPE_TARGET} copies of every card below, on{" "}
        {mainAccount ? <strong>{mainAccount.name}</strong> : "your main account"}.
      </p>

      <div className="overflow-x-auto border border-line rounded-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper">
              <th className="text-left font-medium text-inkmuted px-2 py-3 sticky left-0 bg-paper w-12"></th>
              <th className="text-left font-medium text-inkmuted px-4 py-3 sticky left-12 bg-paper">
                Card
              </th>
              {accounts.map((a) => (
                <th
                  key={a.id}
                  className={`text-center font-medium px-3 py-3 whitespace-nowrap ${
                    a.is_main ? "text-violet" : "text-inkmuted"
                  }`}
                >
                  {a.name}
                  {a.is_main && " ★"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const mainQty = mainAccount
                ? ownershipMap.get(`${mainAccount.id}:${slot.id}`) ?? 0
                : 0;
              const done = mainQty >= DUPE_TARGET;
              return (
                <tr key={slot.id} className="border-b border-line last:border-0">
                  <td className="px-2 py-2 sticky left-0 bg-surface">
                    <button
                      onClick={() => handleSetImage(slot)}
                      className="w-9 h-12 rounded-md overflow-hidden border border-line bg-paper flex items-center justify-center shrink-0 hover:border-violet transition"
                      title="Set card image"
                    >
                      {slot.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={slot.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-inkmuted text-[9px]">＋</span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 sticky left-12 bg-surface">
                    <span className={done ? "text-complete font-medium" : "text-ink"}>
                      {slot.label}
                    </span>
                    {done && <span className="ml-1.5 text-complete text-xs">✓</span>}
                  </td>
                  {accounts.map((a) => {
                    const key = `${a.id}:${slot.id}`;
                    const qty = ownershipMap.get(key) ?? 0;
                    return (
                      <td key={a.id} className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={qty}
                          onChange={(e) => updateQty(a.id, slot.id, parseInt(e.target.value) || 0)}
                          className={`w-14 text-center border rounded-lg py-1 text-sm transition ${
                            a.is_main && qty >= DUPE_TARGET
                              ? "border-complete bg-completebg text-complete"
                              : "border-line bg-surface text-ink focus:border-violet"
                          } ${saving === key ? "opacity-50" : ""}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
                                       }
                                                                          
