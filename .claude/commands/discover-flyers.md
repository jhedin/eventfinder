# Discover Flyers

Three-phase workflow: **Gather → Classify → Publish**.

---

## Phase 1: Gather

Fetch raw flyer data from all configured stores.

```bash
npm install
node scripts/fetch-flipp-flyers.js
```

Output: `/tmp/eventfinder-flyer-batch-flipp.json` — array of store objects, each with `items` containing `name`, `brand`, `price`, `original_price`, `discount`.

Read the output file and report how many items were fetched per store.

---

## Phase 2: Classify

Process the raw items from Phase 1. For each store's items:

**Filter:** Drop non-grocery items. Canadian Tire, London Drugs, Costco, and Shoppers flyers are mostly non-food — be aggressive. Keep only food, drinks, and alcohol.

**Deduplicate:** Safeway and Sobeys are the same company with identical flyers. Keep one (label as "Safeway", drop Sobeys). Same for any other duplicates across stores.

**Categorize** each remaining item into: Meat & Seafood, Produce, Dairy, Bakery, Frozen, Pantry, Beverages.

**Rank:** Prefer items with `original_price` (showing real savings) or a `discount` percentage. For stores with many items, keep the best 20-40 deals — biggest discounts, most useful staples.

Write the curated results to `/tmp/eventfinder-flyer-curated.json`:
```json
{
  "date": "2026-03-29",
  "categories": {
    "Meat & Seafood": [
      {"name": "Chicken Breast", "price": "$4.99/lb", "original_price": "$7.99", "store": "Safeway"},
      {"name": "Ground Beef", "price": "$3.99/lb", "original_price": "$5.99", "store": "No Frills"}
    ],
    "Produce": [...],
    ...
  }
}
```

Report a summary: how many items kept vs dropped per store, total per category.

---

## Phase 3: Publish

Read `/tmp/eventfinder-flyer-curated.json` and post to Discord.

Use **embeds** — one per category:

```json
{
  "embeds": [{
    "title": "🥩 Meat & Seafood",
    "color": 15158332,
    "description": "• Chicken Breast — **$4.99/lb** @ Safeway ~~$7.99~~\n• Ground Beef — **$3.99/lb** @ No Frills ~~$5.99~~"
  }]
}
```

- Post header first: `🛒 **Flyer Deals** — {n} deals from {n} stores · {date}`
- Category emojis: 🥩 Meat & Seafood, 🥬 Produce, 🧀 Dairy, 🍞 Bakery, 🧊 Frozen, 🥫 Pantry, 🥤 Beverages
- Bold sale price, strikethrough original, `@ Store` tag, `(Brand)` if helpful
- Max 10 embeds per message, 4096 chars per embed description — split across messages if needed

POST to `DISCORD_FLYERS_WEBHOOK_URL`. If not set, skip with warning.

After posting, commit DB:
```bash
git config user.email "eventfinder-bot@users.noreply.github.com"
git config user.name "EventFinder Bot"
git add data/eventfinder.db
git commit -m "chore: update flyer database [skip ci]"
git push
```

---

## Summary

```
✅ Flyer Discovery Complete
Phase 1 — Gather: {n} merchants, {n} raw items
Phase 2 — Classify: {n} items kept, {n} dropped, {n} categories
Phase 3 — Publish: ✅ posted to Discord
```

---

## Error Handling

- Flipp fetch fails for a merchant → log, continue
- Discord post fails → report, still commit DB
- No webhook URL → skip post, report warning

This is an **autonomous workflow**. Execute all phases without confirmation.
