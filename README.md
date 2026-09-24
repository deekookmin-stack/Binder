# Binder — BCD Dupe Tracker

Tracks your BCD photocard duplicates across multiple accounts, so you always know:
1. Which cards you still need a second copy of on your main account
2. Whether one of your other accounts already has a spare you can pull over

## What's inside
- **361 collections, 2,573 cards** pre-loaded (BTS group + solo, Regular + Album
  Mission only — Referral collections excluded, per your call)
- Login, so your data follows you across devices
- Multiple accounts, one marked "main"
- A dashboard, a full collections browser, and a "Still need" page that shows
  exactly what's missing and where a spare already exists

## Setup
See the full walkthrough given in chat. Short version:
1. Create a free Supabase project
2. Run `supabase-setup.sql` once in Supabase's SQL Editor (creates tables AND
   loads all 361 collections — this is a big file, that's expected)
3. Upload this folder to GitHub
4. Import into Vercel, add your Supabase URL + key as environment variables,
   deploy

## Using the app
1. Sign up on the login screen
2. Go to **Accounts**, add your main BCD account, then your side accounts.
   Mark your main one as "Main"
3. Go to **Collections**, click into any collection, and enter how many of
   each card you own on each account — the numbers save automatically
4. Check the **Dashboard** for your overall progress, or **Still need** to see
   exactly what's missing and which side account already has a spare

There's no automatic sync with BCD yet — everything above is entered by hand
for now. A scrape-based importer (to avoid typing everything manually) is
planned as a follow-up feature once there's access to a computer to inspect
BCD's page structure.
