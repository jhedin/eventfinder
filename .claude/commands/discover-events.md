# Discover Events

**You are EventFinder.** Run the complete event discovery workflow: fetch sources, extract events, match to preferences, and post digest to Discord.

---

## ⚠️ Resuming a Previous Session

If this session is continuing a previous interrupted run, **do not write ad-hoc scripts**. Instead:

1. Check DB state to determine where the workflow left off:
   ```bash
   node scripts/db-query.js "SELECT COUNT(*) as events FROM events"
   node scripts/db-query.js "SELECT COUNT(*) as pending FROM sent_events WHERE status = 'pending'"
   ```
2. If there are pending events → jump directly to **Step 6** (Generate Discord Digest)
3. If there are no pending events → run the full workflow from Step 1

**Always follow this workflow in full, even during recovery.** Do not skip steps or implement partial versions. The workflow already handles: Google Calendar links, proper Discord formatting, currency symbols, curl usage — do not re-implement these.

---

## Step 0: Install Dependencies

Run this first to ensure Node dependencies are available:

```bash
npm install
```

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
node scripts/db-query.js "SELECT id, url, name, description FROM sources WHERE active = 1 AND type = 'event' ORDER BY last_checked_at ASC"
```

This gives you the websites to check for events.

---

## Step 2b: Read Gmail Newsletter Inbox (optional)

**If the Gmail connector is available**, read unread venue newsletters:

1. Search for unread emails: `is:unread newer_than:2d -to:j.hedin.open.claw+flyers@gmail.com`
2. For each email: extract the plain text body
3. Pass the body through the same event extraction process as Step 3.2 (treat it like markdown from a website)
4. Mark each email as read after processing
5. Associate these events with a special source (use `source_id` for a "Gmail Newsletters" source entry — create it if it doesn't exist)

Feed extracted events into the same deduplication and preference matching pipeline (Steps 4–5).

**If Gmail connector is not available**: Skip this step and continue.

---

## Step 3: Fetch and Extract Events

### 3.1: Fetch All Sources

Run this single Bash command to fetch all active sources:

```bash
node scripts/scrape-all.js
```

This script reads all active sources from the DB, fetches each using Browserless.io (via `BROWSERLESS_TOKEN` env var, which renders JavaScript and bypasses bot protection), and falls back to plain fetch if the token is not set. It writes one HTML file per source to `/tmp/eventfinder-page-{id}.html` and a manifest to `/tmp/eventfinder-fetch-manifest.json`.

After it completes, proceed to 3.2.

### 3.2: Dispatch Extraction Subagents in Parallel

Read `/tmp/eventfinder-fetch-manifest.json` to get the fetch results. Dispatch **one subagent per source** simultaneously using the **Agent tool** — do not batch multiple sources together, as large HTML files cause timeouts.

**IMPORTANT**:
- Set `model: "haiku"` on every Agent tool call — extraction is mechanical and does not need a large model
- Set `allowed_tools: ["Read", "Write"]` to prevent subagents from using WebFetch or Bash

Pass each subagent:
- The single source (id, url, name) with its fetch status and html_file path — taken from the manifest
- Today's date (for relative date parsing)
- The output file path (e.g. `/tmp/eventfinder-src-{source_id}.json`)

**Subagent prompt template**:
```
You are an event extractor. Your ONLY job is to read one pre-fetched HTML file and extract events as structured JSON.

You have access to ONLY two tools: Read (to read the HTML file) and Write (to write the output JSON).
The HTML file has already been downloaded — do not try to fetch any URLs.

Today's date: {TODAY}
Default timezone: America/Edmonton

Output file: {OUTPUT_FILE}

Source:
{SOURCE_ID} | {SOURCE_URL} | {HTML_FILE} | {FETCH_SUCCESS} | {FETCH_ERROR}

Instructions:
1. If fetch_success is false: write the error result immediately — do NOT try to fetch the URL yourself
2. If fetch_success is true: use the Read tool to read the HTML file ONCE, then extract all future events (on or after {TODAY})

Build a JSON object:
{
  "results": [
    {
      "source_id": {SOURCE_ID},
      "source_url": "{SOURCE_URL}",
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
- Read the file exactly ONCE — do not re-read it
- Return empty "events": [] if no events found on a page
- Mark js_heavy=true if the HTML looks like a JS-only shell (minimal content, no events visible)
- Parse dates carefully — handle "Tomorrow", "Next Friday", relative dates
- Include all instances for recurring events
- Only include events on or after {TODAY}

Write the JSON object to the output file using the Write tool, then return only a one-line summary like:
"Source {SOURCE_ID} complete: 12 events extracted. Written to {OUTPUT_FILE}"
```

### 3.3: Collect Subagent Results

Wait for all subagents to complete. Each subagent has written its results to `/tmp/eventfinder-src-{source_id}.json`. Run the import script to merge all result files into the database:

```bash
node scripts/import-batch-results.js
```

This script finds all `/tmp/eventfinder-*.json` files, handles deduplication, DB insertion, and source status updates. **Do not write your own insertion script** — use this one. If it reports "No batch files found", check that the subagents actually wrote their output files before proceeding.

Note any `js_heavy: true` sources reported in the output for the Step 9 summary.

---

## Steps 4–5: Assess Events and Match to User Preferences

Delegate this entire step to a **Haiku subagent** so the full event list never enters the main context. Set `model: "haiku"` on the Agent tool call.

Grant the subagent these tools: `Bash`, `Read`, `Write`.

**Subagent prompt**:
```
You are an event relevance matcher for EventFinder.

Your job:
1. Query unreviewed events from the database
2. Read the user's preferences
3. Decide which events match, then write a decisions file

Tools available: Bash (to run db-query.js), Read (to read preferences), Write (to write decisions).

Today's date: {TODAY}

## Step 1: Query unreviewed events
Run:
  node scripts/db-query.js "SELECT e.id, e.title, e.venue, e.description, e.price, e.event_url, e.source_id FROM events e WHERE e.id NOT IN (SELECT DISTINCT event_id FROM sent_events)"

## Step 2: Read user preferences
Read the file: data/user-preferences.md

## Step 3: Assess every event
For each event, decide: does it match the user's interests?

Consider: event type, venue, price, exclusions. When in doubt, include it (status: "pending").

Contextual understanding:
- "The National" = indie rock band
- "Blue Note" / "jazz club" = jazz music
- Workshop at craft/art store = hands-on class (probably interested)
- Blues Can / Ironwood / King Eddy = blues/folk/roots music venues

## Step 4: Write decisions file
Write ALL decisions to /tmp/relevance-decisions.json in this format:
[
  {"event_id": 42, "status": "pending", "reason": "Jazz quartet at intimate venue — matches jazz interest"},
  {"event_id": 43, "status": "excluded", "reason": "Heavy metal festival — explicitly excluded"}
]

- status "pending" = matches user interests (include in digest)
- status "excluded" = does not match

Write the file, then return a one-line summary:
"Relevance complete: N matched, N excluded. Written to /tmp/relevance-decisions.json"
```

Wait for the subagent to complete, then run:

```bash
node scripts/record-relevance-batch.js /tmp/relevance-decisions.json
```

This script is safe to re-run — it skips events already assessed.

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

Format one message per category. Each message must be **≤ 1950 characters** (Discord limit, leave buffer). Split into multiple messages if needed.

**Google Calendar quick-add URL format**:
```
https://calendar.google.com/calendar/render?action=TEMPLATE&text=TITLE&dates=START/END&details=DESCRIPTION&location=VENUE
```
- `text`: URL-encode the event title
- `dates`: `YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS` (local time, no Z suffix — let Google handle timezone)
  - If no time known: use `YYYYMMDD/YYYYMMDD` (all-day format)
  - End time: use start + 2 hours if no end time available
- `details`: URL-encode the event_url
- `location`: URL-encode the venue name

**YouTube search URL format** (for music events only):
```
https://www.youtube.com/results?search_query=ARTIST+NAME
```
- URL-encode the artist/band name from the event title
- Only generate for 🎵 Music category events, not workshops or arts events

Generate **up to 3 links per event**:

1. **Event calendar link** (always): `📆 Add event` — links to the event date/time
2. **Ticket sale reminder** (only if `ticket_sale_date` is set): `🔔 Tickets on sale [date]` — links to the ticket sale date as an all-day event, with title prefixed "🎫 Tickets on sale: [event title]"
3. **YouTube search** (music events only): `🎧 Listen` — YouTube search for the artist name

**Format**:
```
🎵 **Music** — 3 new events

**Jazz Night with Sarah Vaughan Tribute**
📅 Fri Oct 15 at 8:00 PM · 📍 Blue Note Jazz Club · 💰 $25-$35
🔗 <event_url> · 📆 Add event · 🎧 Listen

**The National - Live**
📅 Sat Oct 22 at 8:00 PM · 📍 MacEwan Ballroom · 💰 $50-$75
🎫 <ticket_url> · 🔗 <event_url> · 📆 Add event · 🔔 Tickets on sale Apr 1 · 🎧 Listen
```

Only include fields that are available (skip null fields). Always include 📆. Only include 🔔 if ticket_sale_date is known. Only include 🎧 for music events.

---

## Step 7: Post to Discord

Use the Bash tool to POST each category message to the Discord webhook using `curl`. **Always use curl — do not use Node.js fetch, which times out in this environment.**

**Always write the JSON body to a temp file** — never inline it in the shell command. Inlining breaks `$` signs (prices like `$25` become empty strings) and single quotes in content.

```bash
# Write message to temp file first (preserves $, quotes, special chars)
node -e "require('fs').writeFileSync('/tmp/discord_msg.json', JSON.stringify({content: process.argv[1]}))" "<message>"

# Then post it
curl -s -o /dev/null -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d @/tmp/discord_msg.json \
  "$DISCORD_WEBHOOK_URL"
```

A response of `204` means success. If you get a non-204 response or an error, retry once before giving up.

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
git commit -m "chore: update event database with $(date +%Y-%m-%d) discovery run [skip ci]"
git pull origin main --no-rebase -X ours
git push origin HEAD:main
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
