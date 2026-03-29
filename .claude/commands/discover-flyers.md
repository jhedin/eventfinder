# Discover Flyers

**You are FlyerFinder.** Run the complete flyer discovery workflow: fetch grocery store flyer pages, extract deals, and post digest to Discord.

---

## Step 1: Query Active Flyer Sources

Run the following query using `node scripts/db-query.js`:

```bash
node scripts/db-query.js "SELECT id, url, name, description FROM sources WHERE active = 1 AND type = 'flyer' ORDER BY last_checked_at ASC"
```

This gives you the grocery store flyer pages to check.

If **no active flyer sources**: Report "No active flyer sources. Use /add-flyer-source to add one." and stop.

---

## Step 2: Fetch All Flyer Sources

Run the scraper with the flyer type flag:

```bash
node scripts/scrape-all.js --type=flyer
```

This fetches all active flyer source pages and writes HTML files + manifest to `/tmp/eventfinder-flyer-*`.

---

## Step 3: Extract Deals (Parallel Subagents)

Read the manifest at `/tmp/eventfinder-flyer-fetch-manifest.json` to see which pages were fetched successfully.

Dispatch subagents in **batches of 4–5** sources to avoid filling the main context with raw HTML.

### 3.1: Dispatch Subagents in Parallel

Use the **Agent tool** to spawn one subagent per batch simultaneously. Pass each subagent:
- The list of sources with their HTML file paths from the manifest
- The flyer extraction instructions from `src/templates/extract-flyers-from-markdown.md`
- Today's date

**Subagent prompt template**:
```
You are a grocery flyer scraper. Read each HTML file below and extract deals as JSON.

Today's date: {TODAY}

Sources to process:
{SOURCE_LIST with html_file paths}

For each source:
1. Read the HTML file from /tmp
2. Extract all deals from the page content using the flyer extraction template
3. Return structured JSON

Return a JSON object:
{
  "results": [
    {
      "source_id": 1,
      "source_url": "https://...",
      "success": true,
      "error": null,
      "store_name": "Real Canadian Superstore",
      "sale_start": "2026-03-27",
      "sale_end": "2026-04-02",
      "items": [
        {
          "item_name": "Boneless Chicken Breast",
          "brand": "Maple Leaf",
          "description": "Family pack, ~1.5kg",
          "sale_price": "$4.99/lb",
          "regular_price": "$7.99/lb",
          "unit": "/lb",
          "category": "Meat & Seafood",
          "item_url": null,
          "image_url": null
        }
      ]
    }
  ]
}

Rules:
- Return empty "items": [] if no deals found on a page
- Parse prices carefully — handle "2 for $5", "$4.99/lb", "50% off", etc.
- Detect flyer validity dates from page headers
- Return only the JSON object, no other text
```

### 3.2: Collect and Write Batch Results

Each subagent writes its results to `/tmp/eventfinder-flyer-batch-{N}.json`.

Wait for all subagents to complete.

---

## Step 4: Import Results

Run the flyer import script:

```bash
node scripts/import-flyer-results.js
```

This deduplicates and imports all extracted deals into the `flyer_items` table, with each new item getting a `pending` entry in `sent_flyer_items`.

Note the import summary (new items, duplicates, failures).

---

## Step 5: Generate Discord Digest

Query for all pending (unsent) flyer items:

```bash
node scripts/db-query.js "SELECT fi.*, s.name as store_name, sfi.id as sent_id FROM flyer_items fi JOIN sources s ON s.id = fi.source_id JOIN sent_flyer_items sfi ON sfi.flyer_item_id = fi.id WHERE sfi.status = 'pending' ORDER BY s.name, fi.category, fi.item_name"
```

If **no pending items**: Skip to Step 7 and report "No new flyer deals to send."

### 5.1: Group by Store, then Category

Organize deals hierarchically:
1. Group by `store_name`
2. Within each store, group by `category`
3. Within each category, list items alphabetically

### 5.2: Format Discord Messages

Each message must be **<= 2000 characters** (Discord limit). Split across multiple messages if needed.

**Category emoji map**:
- Produce → 🥬
- Meat & Seafood → 🥩
- Dairy → 🧀
- Bakery → 🍞
- Frozen → 🧊
- Pantry → 🥫
- Beverages → 🥤
- Household → 🏠
- Personal Care → 🧴
- Other → 📦

**Header message**:
```
🛒 **Flyer Deals** — {count} deals from {store_count} stores · {date}
```

**Per-store format**:
```
**{Store Name}** (valid {sale_start} - {sale_end})

🥩 Meat & Seafood
• Boneless Chicken Breast — **$4.99/lb** ~~$7.99~~
• Atlantic Salmon Fillets — **$9.99/lb** ~~$13.99~~

🥬 Produce
• Strawberries 1lb — **2 for $5**
• Avocados — **$0.99 ea** ~~$1.49~~
```

- Show `~~regular_price~~` strikethrough only if regular_price is available
- Include brand in parentheses if present: `• Chicken Breast (Maple Leaf) — **$4.99/lb**`
- If a store has many deals, prioritize showing them all but split into multiple messages if needed

---

## Step 6: Post to Discord

Use the Bash tool to POST each message to the Discord flyers webhook:

```bash
node -e "
const url = process.env.DISCORD_FLYERS_WEBHOOK_URL;
if (!url) { console.log('WARNING: DISCORD_FLYERS_WEBHOOK_URL not set, skipping'); process.exit(0); }
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: \`<message>\` })
}).then(r => console.log('Status:', r.status));
"
```

Post the header message first, then one message per store (splitting if over 2000 chars).

**If `DISCORD_FLYERS_WEBHOOK_URL` is not set**: Skip this step, log a warning, continue to Step 7.

---

## Step 7: Mark Items as Sent + Save Database

After successful Discord post, mark all posted items as sent:

```bash
node scripts/db-query.js "UPDATE sent_flyer_items SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE status = 'pending'"
```

Then commit the updated database back to GitHub:

```bash
git config user.email "eventfinder-bot@users.noreply.github.com"
git config user.name "EventFinder Bot"
git add data/eventfinder.db
git commit -m "chore: update flyer database [skip ci]"
git push
```

**If Discord post failed**: Do NOT mark as sent (items stay 'pending' for retry next run). Still commit the DB to save newly discovered items.

---

## Step 8: Report Summary

Display a summary:

```
✅ Flyer Discovery Complete

Sources checked: 3
  Succeeded: 3
  Failed: 0

Deals extracted: 85
  New: 42
  Duplicates skipped: 43

Discord digest: ✅ posted (42 deals across 3 stores)

Database committed to GitHub: ✅

Failed sources (if any):
  example.com/flyer: Timeout
```

---

## Error Handling

**If source fetch fails**:
- Log error to database
- Continue to next source

**If deal extraction fails**:
- Log warning
- Continue to next source

**If Discord post fails**:
- Report error clearly
- Items remain 'pending' (will retry next run)
- Still commit DB to GitHub

**If database operations fail**:
- Report error and stop (data integrity critical)

---

## Notes

- **No preference filtering**: All deals are posted (no relevance matching step)
- **Group by store**: Deals are organized by store, then by category within each store
- **Deduplication**: Items are hashed by name + brand + price + source + sale_end to avoid re-posting
- **Historical data**: Old flyer items are kept in the database for historical lookups
- **Separate channel**: Uses `DISCORD_FLYERS_WEBHOOK_URL` (not the events webhook)

This is an **autonomous workflow**. Execute all steps without asking for confirmation unless you encounter an error you can't handle.
