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

## Step 3: Fetch and Extract Events

**For each source from Step 2**, do the following:

### 3.1: Fetch Website

Use the built-in **WebFetch tool** to fetch the URL:
- On error: Log it, continue to next source
- If the page returns empty or minimal content (likely JS-rendered): note it but continue

**If the page appears to be JS-heavy and WebFetch returns little content**: Make a note in the summary for future Browserless.io upgrade, but continue.

### 3.2: Extract Events from Markdown

Analyze the fetched content and extract events as structured JSON.

Use your understanding of:
- Common event page patterns (dates, venues, ticket links)
- Natural language date references ("Tomorrow", "Next Friday")
- Event details scattered across the page

**Output Format**:
```json
[
  {
    "title": "Jazz Night with Sarah Vaughan Tribute",
    "venue": "Blue Note Jazz Club",
    "description": "An evening celebrating Sarah Vaughan...",
    "price": "$25-$35",
    "event_url": "https://example.com/events/jazz-night",
    "ticket_url": "https://tickets.example.com/jazz-night",
    "image_url": "https://example.com/images/event.jpg",
    "minimum_age": 18,
    "instances": [
      {
        "date": "2025-10-15",
        "time": "20:00:00",
        "end_date": "2025-10-15",
        "ticket_sale_date": "2025-10-01",
        "ticket_sale_time": "09:00:00"
      }
    ]
  }
]
```

**Important**:
- Return empty array `[]` if no events found
- Parse dates carefully (handle relative dates like "Tomorrow")
- Include all instances for recurring events
- Timezone: Assume `America/Edmonton` unless specified

### 3.3: Update Source Status

After fetching (success or failure), update the database:

**On success:**
```bash
node scripts/db-query.js "UPDATE sources SET last_checked_at = CURRENT_TIMESTAMP, last_success_at = CURRENT_TIMESTAMP, consecutive_failures = 0, error_message = NULL, error_type = NULL WHERE id = ?" '<source_id>'
```

**On failure:**
```bash
node scripts/db-query.js "UPDATE sources SET last_checked_at = CURRENT_TIMESTAMP, consecutive_failures = consecutive_failures + 1, error_message = ?, error_type = ? WHERE id = ?" '"<error message>"' '"<error type>"' '<source_id>'
```

**Auto-disable after 3 failures:**
```bash
node scripts/db-query.js "UPDATE sources SET active = 0 WHERE consecutive_failures >= 3"
```

---

## Step 4: Check for Duplicates

**For each extracted event**, check if it already exists.

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
