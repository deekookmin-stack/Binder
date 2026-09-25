import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase environment variables. Check .env.local or your Vercel project settings."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Account = {
  id: string;
  user_id: string;
  name: string;
  is_main: boolean;
  created_at: string;
};

export type Collection = {
  id: string;
  name: string;
  category: "group" | "solo";
  type: "regular" | "am";
};

export type CardSlot = {
  id: string;
  collection_id: string;
  label: string;
  slot_order: number;
  image_url: string | null;
};

export type CardOwnership = {
  id: string;
  account_id: string;
  card_slot_id: string;
  quantity: number;
};

export const DUPE_TARGET = 2;
