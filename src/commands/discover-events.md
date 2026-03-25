# Discover Events

**You are EventFinder.** Run the complete event discovery workflow: fetch sources, extract events, match to preferences, and post digest to Discord.

---

## Step 1: Load User Preferences

Read the file `data/user-preferences.md` to understand what events the user cares about.

This file contains natural language descriptions of:
- Music genres, artists, venues they like
- Arts & culture interests
- Workshop/class topics
- Location and timezone
- Exclusions (things they DON'T want)

Keep these preferences in mind throughout the workflow.

---

## Step 2: Query Active Sources

Run the following query using `node scripts/db-query.js`:

```bash
node scripts/db-query.js "SELECT id, url, name, description FROM sources WHERE active = 1 ORDER BY last_checked_at ASC"
```

This gives you the websites to check for events.

---

## Step 2b: Read Gmail Newsletter Inbox (optional)

**If the Gmail connector is available**, read unread venue newsletters:

1. Search for unread emails: `is:unread newer_than:2d`
2. For each email: extract the plain text body
3. Pass the body through the same event extraction process as Step 3.2 (treat it like markdown from a website)
4. Mark each email as read after processing
5. Associate these events with a special source (use `source_id` for a "Gmail Newsletters" source entry — create it if it doesn't exist)

Feed extracted events into the same deduplication and preference matching pipeline (Steps 4–5).

**If Gmail connector is not available**: Skip this step and continue.

---

## Step 3: Fetch and Extract Events (Parallel Subagents)

Dispatch sources to subagents in **batches of 4–5** to avoid filling the main context with raw HTML. Each subagent fetches its assigned URLs and returns structured JSON events.

### 3.1: Split Sources into Batches

Divide the source list from Step 2 into groups of 4–5 sources. For 20 sources that's 4–5 batches.

### 3.2: Dispatch Subagents in Parallel

Use the **Agent tool** to spawn one subagent per batch simultaneously. Pass each subagent:
- The list of sources to fetch (id, url, name, description)
- The event extraction instructions below
- Today's date (for relative date parsing)
- The output file path to write results to (e.g. `/tmp/eventfinder-batch-1.json`)

**Subagent prompt template**:
```
You are an event scraper. Fetch each URL below using WebFetch and extract events as JSON.

Today's date: {TODAY}
Default timezone: America/Edmonton

Sources to fetch:
{SOURCE_LIST}

Output file: {OUTPUT_FILE}

For each source:
1. Fetch the URL with WebFetch
2. Extract all events from the page content
3. If the page returns minimal/empty content (JS-rendered), mark as js_heavy=true

Build a JSON object:
{
  "results": [
    {
      "source_id": 1,
      "source_url": "https://...",
      "success": true,
      "js_heavy": false,
      "error": null,
      "events": [
        {
          "title": "Jazz Night",
          "venue": "Blue Note",
          "description": "...",
          "price": "$25",
          "event_url": "...",
          "ticket_url": "...",
          "image_url": "...",
          "minimum_age": null,
          "instances": [
            {
              "date": "2026-04-15",
              "time": "20:00:00",
              "end_date": null,
              "ticket_sale_date": null,
              "ticket_sale_time": null
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Return empty "events": [] if no events found on a page
- Parse dates carefully — handle "Tomorrow", "Next Friday", relative dates
- Include all instances for recurring events

IMPORTANT: Write the JSON object to the output file using the Write tool, then return only a one-line summary like:
"Batch complete: 3 sources succeeded, 1 failed, 42 events extracted. Written to {OUTPUT_FILE}"
```

### 3.3: Collect Subagent Results

Wait for all subagents to complete. Each subagent has written its results to `/tmp/eventfinder-batch-N.json`. Run the import script to merge all batch files into the database:

```bash
node scripts/import-batch-results.js
```

This script:
- Reads all `/tmp/eventfinder-batch-*.json` files
- Deduplicates events (hash check)
- Inserts new events into the DB
- Updates source status (last_checked_at, consecutive_failures, etc.)
- Outputs a summary of what was inserted vs skipped

After running, the batch files are no longer needed.

Note any `js_heavy: true` sources reported in the import script output for the Step 9 summary (future Browserless.io upgrade).

---

## Step 4: Check for Duplicates

The import script (Step 3.3) handles hash-based deduplication automatically. After it runs, review its output to understand what was new vs. skipped.

For the **preference matching** step (Step 5), query for events that were inserted in this run:

```bash
node scripts/db-query.js "SELECT e.id, e.title, e.venue, e.description, e.price, e.event_url, e.ticket_url, e.source_id FROM events e WHERE e.id NOT IN (SELECT event_id FROM sent_events)"
```

These are the events not yet assessed for relevance.

> **Note**: The import script also handles fuzzy duplicate detection via the existing event_hash column. If you need to manually check for a specific duplicate:

### 4.1: Generate Event Hash

Create a normalized hash from title + venue:
```
hash = sha256(normalize(title) + normalize(venue))
```

Normalization:
- Lowercase
- Remove punctuation
- Remove extra whitespace
- Remove accents

Example:
```
"Jazz Night!" at "Blue Note Café"
→ "jazznight" + "bluenotecafe"
→ hash("jazzniteblunotecafe")
```

### 4.2: Check Exact Match

```bash
node scripts/db-query.js "SELECT id, title, venue FROM events WHERE event_hash = ?" '"<hash>"'
```

If found: **Skip this event** (already in database)

### 4.3: Fuzzy Duplicate Check

If no exact match, query for similar events:

```bash
node scripts/db-query.js "SELECT id, title, venue, event_url FROM events e JOIN event_instances ei ON e.id = ei.event_id WHERE e.venue LIKE ? AND ei.instance_date BETWEEN ? AND ? LIMIT 5" '"%<venue_keyword>%"' '"<date_minus_3>"' '"<date_plus_3>"'
```

**Ask yourself**: Is this new event the same as any of these existing events?

Example reasoning:
```
New: "Christmas Afternoon Tea" at "Lougheed House" on Nov 30
Existing: "Christmas Tea" at "Lougheed House" on Nov 30

Decision: YES, same event (just slightly different wording)
Action: Skip
```

If it's a duplicate: **Skip this event**

If it's genuinely new: **Continue to relevance matching**

---

## Step 5: Match to User Preferences

For each **new, non-duplicate event**, determine if it matches user interests.

Use your judgment based on `data/user-preferences.md`:

**Consider**:
- Does the event type match their interests? (jazz music, pottery class, etc.)
- Is the venue type relevant? (jazz club, gallery, workshop space)
- Does it align with their preferences? (time of day, age restrictions)
- Is it explicitly excluded? (sports, nightclubs, late events)

**Contextual understanding**:
- "The National" (band) vs "National Holiday" (not a band)
- "Blue Note" (jazz club) implies jazz music
- "Workshop" at craft store implies hands-on class

**Output your decision**:
```json
{
  "matches": true,
  "reason": "User is interested in jazz music, and this is a jazz performance at a well-known jazz venue"
}
```

or

```json
{
  "matches": false,
  "reason": "User excluded sports events, and this is a hockey game"
}
```

### 5.1: Store in Database

**Insert event:**
```bash
node scripts/db-query.js "INSERT INTO events (event_hash, title, venue, description, price, event_url, ticket_url, image_url, minimum_age, source_id, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id" '"<hash>"' '"<title>"' '"<venue>"' '"<description>"' '"<price>"' '"<event_url>"' '"<ticket_url>"' '"<image_url>"' '<minimum_age_or_null>' '<source_id>' '"<source_url>"'
```

**Insert event instances** (one call per instance):
```bash
node scripts/db-query.js "INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone, ticket_sale_date, ticket_sale_time) VALUES (?, ?, ?, ?, ?, ?, ?)" '<event_id>' '"<date>"' '"<time_or_null>"' '<end_date_or_null>' '"America/Edmonton"' '<ticket_sale_date_or_null>' '<ticket_sale_time_or_null>'
```

**Mark status based on relevance:**

If **matches = true**:
```bash
node scripts/db-query.js "INSERT INTO sent_events (event_id, instance_id, status, reason) SELECT ?, id, 'pending', ? FROM event_instances WHERE event_id = ?" '<event_id>' '"<reason>"' '<event_id>'
```

If **matches = false**:
```bash
node scripts/db-query.js "INSERT INTO sent_events (event_id, instance_id, status, reason) SELECT ?, id, 'excluded', ? FROM event_instances WHERE event_id = ?" '<event_id>' '"<reason>"' '<event_id>'
```

---

## Step 6: Generate Discord Digest

Query for all pending (unsent) events:

```bash
node scripts/db-query.js "SELECT e.*, ei.instance_date, ei.instance_time, ei.end_date, ei.ticket_sale_date, ei.ticket_sale_time, ei.id as instance_id FROM events e JOIN event_instances ei ON e.id = ei.event_id JOIN sent_events se ON se.instance_id = ei.id WHERE se.status = 'pending' ORDER BY ei.instance_date ASC"
```

If **no pending events**: Skip to Step 8 and report "No new events to send"

### 6.1: Categorize Events

Group events by category:
- 🎵 **Music**: Concerts, live music, band performances
- 🎨 **Arts & Culture**: Gallery openings, theater, film, poetry
- 🛠️ **Workshops**: Classes, hands-on learning, craft sessions
- 📅 **Other**: Events that don't fit above

### 6.2: Format Discord Messages

Format one message per category. Each message must be **≤ 2000 characters** (Discord limit). Split into multiple messages if needed.

**Format**:
```
🎵 **Music** — 3 new events

**Jazz Night with Sarah Vaughan Tribute**
📅 Fri Oct 15 at 8:00 PM · 📍 Blue Note Jazz Club · 💰 $25-$35
🎫 <ticket_url> · 🔗 <event_url>

**The National - Live**
📅 Sat Oct 22 at 8:00 PM · 📍 MacEwan Ballroom · 💰 $50-$75
🎫 <ticket_url>
```

Only include fields that are available (skip null fields).

---

## Step 7: Post to Discord

Use the Bash tool to POST each category message to the Discord webhook:

```bash
node -e "
const url = process.env.DISCORD_WEBHOOK_URL;
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: '<message>' })
}).then(r => console.log('Status:', r.status));
"
```

Post a header message first:
```
🗓️ **EventFinder Digest** — {count} new events · {date}
```

Then one message per non-empty category.

**If `DISCORD_WEBHOOK_URL` is not set**: Skip this step, log a warning, continue to Step 8.

---

## Step 8: Mark Events as Sent + Save Database

After successful Discord post, mark all posted instances as sent:

```bash
node scripts/db-query.js "UPDATE sent_events SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE instance_id IN (<comma_separated_instance_ids>)"
```

Then commit the updated database back to GitHub:

```bash
git config user.email "eventfinder-bot@users.noreply.github.com"
git config user.name "EventFinder Bot"
git add data/eventfinder.db
git commit -m "chore: update event database [skip ci]"
git push
```

**If Discord post failed**: Do NOT mark as sent (events stay 'pending' for retry next run). Still commit the DB to save any newly discovered events.

---

## Step 9: Report Summary

Display a summary:

```
✅ Event Discovery Complete

Sources checked: 10
  Succeeded: 8
  Failed: 2
  JS-heavy (limited data): 1

Events discovered: 45
  New: 12
  Duplicates skipped: 33

Relevance matching:
  Matched: 8 events
  Excluded: 4 events

Discord digest: ✅ posted (8 events across 3 categories)

Database committed to GitHub: ✅

Failed sources (if any):
  example.com/events: Timeout
```

---

## Error Handling

**If source fetch fails**:
- Log error to database
- Continue to next source

**If event extraction fails**:
- Log warning
- Continue to next source

**If Discord post fails**:
- Report error clearly
- Events remain 'pending' (will retry next run)
- Still commit DB to GitHub

**If database operations fail**:
- Report error and stop (data integrity critical)

---

## Notes

- **Be flexible**: Websites have different formats, adapt your extraction
- **Be smart**: Use context clues (venue names, event descriptions)
- **Be conservative**: When in doubt about duplicates, skip it (better to miss than duplicate)
- **Be helpful**: Provide clear reasoning for matches/exclusions

This is an **autonomous workflow**. Execute all steps without asking for confirmation unless you encounter an error you can't handle.
