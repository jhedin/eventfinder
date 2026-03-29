# Discover Flyers

**You are FlyerFinder.** Run the complete flyer discovery workflow: fetch deals from the Flipp API and Gmail newsletters, then post digest to Discord.

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Fetch Flyer Deals from Flipp API (Primary Source)

Run the Flipp fetch script:

```bash
node scripts/fetch-flipp-flyers.js
```

This calls the public Flipp API (`backflipp.wishabi.com`) which returns structured JSON for all configured merchants in the Calgary area. It writes results to `/tmp/eventfinder-flyer-batch-flipp.json`.

The script is pre-configured with these merchant IDs:
- 208: Shoppers Drug Mart
- 228: London Drugs
- 2051: Calgary Co-op
- 2072: Sobeys
- 2126: Safeway
- 2271: Real Canadian Superstore
- 2332: No Frills
- 2471: Canadian Tire
- 2596: Costco
- 2702: Wholesale Club
- 3407: Co-op Wine Spirits Beer
- 3656: Sobeys & Safeway Liquor
- 6373: T&T Supermarket

No authentication, no browser, no scraping — just structured JSON.

---

## Step 3: Read Gmail Flyer Newsletters (Supplemental)

**If the Gmail connector is available**, read unread flyer newsletter emails for any deals not covered by Flipp:

1. Search for unread flyer emails: `to:j.hedin.open.claw+flyers@gmail.com is:unread newer_than:7d`
2. For each email:
   - Read the plain text / HTML body
   - Identify the store name from the sender or subject line
   - Pass the body through deal extraction (use the template in `src/templates/extract-flyers-from-markdown.md`)
   - Write results to `/tmp/eventfinder-flyer-batch-gmail.json` in the same format
3. Mark each email as read after processing

**If Gmail connector is not available**: Skip this step and continue.

---

## Step 4: Import Results

Run the flyer import script:

```bash
node scripts/import-flyer-results.js
```

This reads all `/tmp/eventfinder-flyer-batch-*.json` files (from both Flipp and Gmail), deduplicates them, and imports into the `flyer_items` table. Each new item gets a `pending` entry in `sent_flyer_items`.

Note the import summary (new items, duplicates, failures).

---

## Step 5: Generate Discord Digest

Query for all pending (unsent) flyer items:

```bash
node scripts/db-query.js "SELECT fi.*, s.name as store_name, sfi.id as sent_id FROM flyer_items fi JOIN sources s ON s.id = fi.source_id JOIN sent_flyer_items sfi ON sfi.flyer_item_id = fi.id WHERE sfi.status = 'pending' ORDER BY s.name, fi.category, fi.item_name"
```

If **no pending items**: Skip to Step 8 and report "No new flyer deals to send."

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

Flipp API: 13 merchants fetched, 850 total items
Gmail newsletters: 3 emails processed, 45 items extracted

Import:
  New items: 420
  Duplicates skipped: 475

Discord digest: ✅ posted (420 deals across 13 stores)

Database committed to GitHub: ✅
```

---

## Error Handling

**If Flipp API fetch fails**:
- Report error for that merchant
- Continue to next merchant

**If Gmail reading fails**:
- Log warning
- Continue (Flipp data is the primary source)

**If Discord post fails**:
- Report error clearly
- Items remain 'pending' (will retry next run)
- Still commit DB to GitHub

**If database operations fail**:
- Report error and stop (data integrity critical)

---

## Notes

- **Flipp API is the primary source**: Structured JSON, no auth, no browser needed. Covers all 13 configured stores.
- **Gmail newsletters are supplemental**: May catch deals or store-specific promotions not in Flipp.
- **No preference filtering**: All deals are posted (no relevance matching step)
- **Group by store**: Deals are organized by store, then by category within each store
- **Deduplication**: Items are hashed by name + brand + price + source + sale_end to avoid re-posting
- **Separate channel**: Uses `DISCORD_FLYERS_WEBHOOK_URL` (not the events webhook)

This is an **autonomous workflow**. Execute all steps without asking for confirmation unless you encounter an error you can't handle.
