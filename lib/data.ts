import { supabase, Account, Collection, CardSlot, CardOwnership, DUPE_TARGET } from "./supabase/client";

export type FullData = {
  accounts: Account[];
  collections: Collection[];
  slots: CardSlot[];
  ownership: CardOwnership[];
  mainAccount: Account | null;
};

export async function loadFullData(): Promise<FullData> {
  const [accountsRes, collectionsRes, slotsRes] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    supabase.from("collections").select("*").order("name", { ascending: true }),
    supabase.from("card_slots").select("*").order("slot_order", { ascending: true })
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (collectionsRes.error) throw collectionsRes.error;
  if (slotsRes.error) throw slotsRes.error;

  const accounts = accountsRes.data as Account[];
  const accountIds = accounts.map((a) => a.id);

  let ownership: CardOwnership[] = [];
  if (accountIds.length > 0) {
    const ownershipRes = await supabase
      .from("card_ownership")
      .select("*")
      .in("account_id", accountIds);
    if (ownershipRes.error) throw ownershipRes.error;
    ownership = ownershipRes.data as CardOwnership[];
  }

  const mainAccount = accounts.find((a) => a.is_main) ?? null;

  return {
    accounts,
    collections: collectionsRes.data as Collection[],
    slots: slotsRes.data as CardSlot[],
    ownership,
    mainAccount
  };
}

// account_id -> card_slot_id -> quantity
export function buildOwnershipMap(ownership: CardOwnership[]) {
  const map = new Map<string, Map<string, number>>();
  for (const o of ownership) {
    if (!map.has(o.account_id)) map.set(o.account_id, new Map());
    map.get(o.account_id)!.set(o.card_slot_id, o.quantity);
  }
  return map;
}

export function qtyFor(
  ownershipMap: Map<string, Map<string, number>>,
  accountId: string,
  slotId: string
) {
  return ownershipMap.get(accountId)?.get(slotId) ?? 0;
}

export type SlotStatus = {
  slot: CardSlot;
  mainQty: number;
  needed: number;
  altSources: { accountId: string; accountName: string; qty: number }[];
};

export function computeSlotStatus(
  slot: CardSlot,
  accounts: Account[],
  mainAccountId: string | null,
  ownershipMap: Map<string, Map<string, number>>
): SlotStatus {
  const mainQty = mainAccountId ? qtyFor(ownershipMap, mainAccountId, slot.id) : 0;
  const needed = Math.max(0, DUPE_TARGET - mainQty);
  const altSources = accounts
    .filter((a) => a.id !== mainAccountId)
    .map((a) => ({
      accountId: a.id,
      accountName: a.name,
      qty: qtyFor(ownershipMap, a.id, slot.id)
    }))
    .filter((s) => s.qty > 0);

  return { slot, mainQty, needed, altSources };
}

export type CollectionStatus = "complete" | "in_progress" | "not_started";

export function computeCollectionStatus(
  collectionSlots: CardSlot[],
  accounts: Account[],
  mainAccountId: string | null,
  ownershipMap: Map<string, Map<string, number>>
): { status: CollectionStatus; slotsComplete: number; totalSlots: number } {
  let slotsComplete = 0;
  let anyOwnedAnywhere = false;

  for (const slot of collectionSlots) {
    const mainQty = mainAccountId ? qtyFor(ownershipMap, mainAccountId, slot.id) : 0;
    if (mainQty >= DUPE_TARGET) slotsComplete += 1;

    if (mainQty > 0) anyOwnedAnywhere = true;
    else {
      for (const a of accounts) {
        if (a.id === mainAccountId) continue;
        if (qtyFor(ownershipMap, a.id, slot.id) > 0) {
          anyOwnedAnywhere = true;
          break;
        }
      }
    }
  }

  const totalSlots = collectionSlots.length;
  let status: CollectionStatus = "not_started";
  if (slotsComplete === totalSlots && totalSlots > 0) status = "complete";
  else if (anyOwnedAnywhere) status = "in_progress";

  return { status, slotsComplete, totalSlots };
}
  
