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

Read `data/flyer-preferences.md` first. This tells you:
- **Staples** they always want to see when on sale (these get top priority)
- **Dietary** restrictions (skip items that don't apply)
- **Categories** they care about vs ones to skip
- What they consider a **good deal**

Then process the raw items from Phase 1:

**Filter:** Drop anything the preferences say to skip (non-food, alcohol if not wanted, baby products, etc.). Canadian Tire, London Drugs, Costco, and Shoppers flyers are mostly non-food — be aggressive.

**Deduplicate:** Safeway and Sobeys are the same company with identical flyers. Keep one (label as "Safeway", drop Sobeys). When multiple stores carry the same item, show the best price and mention alternatives: `Chicken Breast — **$6.88** @ Superstore (also $6.99 @ Co-op)`.

**Categorize** each remaining item into: Meat & Seafood, Produce, Dairy, Bakery, Frozen, Pantry, Beverages.

**Rank by relevance:**
1. Staples from preferences that are on sale (always include these)
2. Biggest discount % on items with visible `original_price`
3. Good deals on everyday items the household would use
4. Skip niche/specialty items unless the discount is exceptional

**Cap:** ~15-20 items per category max. This is a digest, not a catalog.

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

## Phase 2.5: Store

Persist the curated deals into the database so they're queryable later.

### Ensure flyer sources exist

For each store in the curated results, ensure a row exists in `sources` with `type = 'flyer'`. Use the store name as both `name` and `url` (e.g., `url = 'flipp://safeway'`). If the source already exists, reuse it.

### Insert flyer items

For each curated item, insert into `flyer_items`:

| Column | Value |
|---|---|
| `item_hash` | hash of `item_name + brand + sale_price + source_id + sale_end` |
| `item_name` | item `name` from curated JSON |
| `brand` | item `brand` (if present) |
| `sale_price` | item `price` |
| `regular_price` | item `original_price` (if present) |
| `category` | the category key (e.g., "Meat & Seafood") |
| `sale_start` | from the raw batch data for that store |
| `sale_end` | from the raw batch data for that store |
| `image_url` | from raw batch data if available |
| `source_id` | the `sources.id` for that store |
| `source_url` | `'flipp://' + store_name_lowercase` |

Use `INSERT OR IGNORE` to skip duplicates (same `item_hash`).

To get `sale_start`/`sale_end` and `image_url`, cross-reference the raw batch data in `/tmp/eventfinder-flyer-batch-flipp.json` with the curated items by store name and item name.

Report: `{n} items stored, {n} duplicates skipped`.

---

## Phase 3: Publish

Read `/tmp/eventfinder-flyer-curated.json` and post to Discord.

### Posting Order (top = lowest priority, bottom = highest)

Discord shows the bottom of a channel first. Post in this order so the most important content is what the user sees first:

1. **Header message** (top): `🛒 **Flyer Deals** — {n} deals from {n} stores · {date}`
2. **Low-priority categories**: 🥤 Beverages, 🥫 Pantry, 🍞 Bakery, 🧊 Frozen
3. **Mid-priority categories**: 🧀 Dairy, 🥬 Produce
4. **High-priority category**: 🥩 Meat & Seafood
5. **Highlights embed** (bottom — seen first): The best preference-matching deals

### Highlights Embed

The final embed should be a **⭐ Highlights** section — the 5-10 best deals that match the user's staples list from `data/flyer-preferences.md`. These are the "don't miss" items: deepest discounts on things they actually buy regularly.

```json
{
  "embeds": [{
    "title": "⭐ Highlights — This Week's Best Deals",
    "color": 16766720,
    "description": "• Chicken Breast — **$4.99/lb** @ Safeway ~~$7.99~~ (37% off)\n• Butter — **$3.99** @ No Frills ~~$5.99~~ (33% off)\n• Eggs — **$3.25/dz** @ Shoppers ~~$4.99~~ (35% off)"
  }]
}
```

Include the discount % in highlights to make the savings obvious.

### Category Embeds

Use one embed per category:

```json
{
  "embeds": [{
    "title": "🥩 Meat & Seafood",
    "color": 15158332,
    "description": "• Chicken Breast — **$4.99/lb** @ Safeway ~~$7.99~~\n• Ground Beef — **$3.99/lb** @ No Frills ~~$5.99~~"
  }]
}
```

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
Phase 2.5 — Store: {n} items stored, {n} duplicates skipped
Phase 3 — Publish: ✅ posted to Discord
```

---

## Error Handling

- Flipp fetch fails for a merchant → log, continue
- Discord post fails → report, still commit DB
- No webhook URL → skip post, report warning

This is an **autonomous workflow**. Execute all phases without confirmation.
