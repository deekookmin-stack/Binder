-- Run this in Supabase SQL Editor to add card thumbnail support.
-- This is a small addition, not the full setup script — safe to run
-- even though you already ran supabase-setup.sql before.

alter table card_slots add column if not exists image_url text;
