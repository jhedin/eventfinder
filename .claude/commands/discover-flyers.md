# Discover Flyers

Run the flyer deal discovery workflow: fetch deals from Flipp API, import into DB, post digest to Discord.

---

## Step 1: Fetch from Flipp API

```bash
npm install
node scripts/fetch-flipp-flyers.js
```

Fetches structured JSON for all 13 configured merchants via the public Flipp API. Writes `/tmp/eventfinder-flyer-batch-flipp.json`.

---

## Step 2: Read Gmail Flyer Newsletters (if available)

If the Gmail connector is available:

1. Search: `to:j.hedin.open.claw+flyers@gmail.com is:unread newer_than:7d`
2. For each email, extract deals using `src/templates/extract-flyers-from-markdown.md`
3. Write results to `/tmp/eventfinder-flyer-batch-gmail.json` (same format as Flipp output)
4. Mark each email as read

Skip if Gmail connector is not available.

---

## Step 3: Import Results

```bash
node scripts/import-flyer-results.js
```

Reads all `/tmp/eventfinder-flyer-batch-*.json` files, deduplicates, and inserts into `flyer_items` / `sent_flyer_items` tables.

---

## Step 4: Generate and Post Discord Digest

Query pending items:

```bash
node scripts/db-query.js "SELECT fi.*, s.name as store_name, sfi.id as sent_id FROM flyer_items fi JOIN sources s ON s.id = fi.source_id JOIN sent_flyer_items sfi ON sfi.flyer_item_id = fi.id WHERE sfi.status = 'pending' ORDER BY fi.category, fi.item_name, s.name"
```

If no pending items, skip to Step 5.

### Formatting

Group by **category first**, with `@ Store` tags on each item for cross-store comparison.

Category emojis: 🥩 Meat & Seafood, 🥬 Produce, 🧀 Dairy, 🍞 Bakery, 🧊 Frozen, 🥫 Pantry, 🥤 Beverages

```
🛒 **Flyer Deals** — {count} deals from {store_count} stores · {date}

🥩 **Meat & Seafood**
• Boneless Chicken Breast — **$4.99/lb** @ Safeway ~~$7.99~~
• Boneless Chicken Breast — **$5.49/lb** @ Co-op
• Ground Beef — **$3.99/lb** @ No Frills ~~$5.99~~

🥬 **Produce**
• Strawberries 1lb — **2 for $5** @ Superstore
• Avocados — **$0.99 ea** @ Safeway ~~$1.49~~
```

- Strikethrough `~~regular_price~~` only when available
- Brand in parentheses if present: `• Chicken Breast (Maple Leaf) — **$4.99/lb** @ Safeway`
- Split messages at 2000 chars (Discord limit)

### Posting

POST to `DISCORD_FLYERS_WEBHOOK_URL`. If not set, skip with a warning.

---

## Step 5: Mark Sent + Save Database

```bash
node scripts/db-query.js "UPDATE sent_flyer_items SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE status = 'pending'"
git config user.email "eventfinder-bot@users.noreply.github.com"
git config user.name "EventFinder Bot"
git add data/eventfinder.db
git commit -m "chore: update flyer database [skip ci]"
git push
```

If Discord post failed, do NOT mark as sent. Still commit DB.

---

## Step 6: Report Summary

```
✅ Flyer Discovery Complete
Flipp API: {n} merchants, {n} items fetched
Gmail: {n} emails processed (or skipped)
Import: {n} new, {n} duplicates skipped
Discord: ✅ posted ({n} deals across {n} stores)
Database: ✅ committed
```

---

## Error Handling

- Flipp fetch fails for a merchant → log, continue to next
- Gmail unavailable → skip, Flipp is primary
- Discord post fails → items stay 'pending' for retry, still commit DB
- DB operation fails → stop (data integrity critical)

This is an **autonomous workflow**. Execute all steps without confirmation.
