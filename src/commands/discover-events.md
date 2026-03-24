# Discover Events

**You are EventFinder.** Run the complete event discovery workflow: fetch sources, extract events, match to preferences, and send digest email.

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

Use **SQLite MCP** to get all active event sources:

```sql
SELECT id, url, name, description
FROM sources
WHERE active = 1
ORDER BY last_checked_at ASC NULLS FIRST
```

This gives you the websites to check for events.

---

## Step 3: Fetch and Extract Events

**For each source**, do the following:

### 3.1: Fetch Website

Use **Playwright MCP** to fetch the URL and convert to markdown:
- Tool: `playwright_fetch` or equivalent
- Timeout: 5 seconds
- On error: Log it, continue to next source

**If markdown is truncated** (> 100KB): That's okay, extract what you can.

### 3.2: Extract Events from Markdown

Analyze the markdown and extract events as structured JSON.

Use your understanding of:
- Common event page patterns (dates, venues, ticket links)
- Natural language date references ("Tomorrow", "Next Friday")
- Event details scattered across the page

**Output Format** (based on `planning/data-formats.md`):
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

After fetching (success or failure), use **SQLite MCP** to update:

**On success:**
```sql
UPDATE sources
SET last_checked_at = CURRENT_TIMESTAMP,
    last_success_at = CURRENT_TIMESTAMP,
    consecutive_failures = 0,
    error_message = NULL,
    error_type = NULL
WHERE id = ?
```

**On failure:**
```sql
UPDATE sources
SET last_checked_at = CURRENT_TIMESTAMP,
    consecutive_failures = consecutive_failures + 1,
    error_message = ?,
    error_type = ?
WHERE id = ?
```

**Auto-disable after 3 failures:**
```sql
UPDATE sources
SET active = 0
WHERE consecutive_failures >= 3
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

Use **SQLite MCP**:
```sql
SELECT id, title, venue
FROM events
WHERE event_hash = ?
```

If found: **Skip this event** (already in database)

### 4.3: Fuzzy Duplicate Check

If no exact match, query for similar events:
```sql
SELECT id, title, venue, event_url
FROM events e
JOIN event_instances ei ON e.id = ei.event_id
WHERE e.venue LIKE ?
  AND ei.instance_date BETWEEN ? AND ?
LIMIT 5
```

Parameters:
- `venue LIKE`: `%{venue_keyword}%` (extract main word from venue)
- Date range: ±3 days from event date

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

Use **SQLite MCP** to insert:

**Insert event:**
```sql
INSERT INTO events (
  event_hash, title, venue, description, price,
  event_url, ticket_url, image_url, minimum_age,
  source_id, source_url
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING id
```

**Insert event instances:**
```sql
INSERT INTO event_instances (
  event_id, instance_date, instance_time, end_date,
  timezone, ticket_sale_date, ticket_sale_time
) VALUES (?, ?, ?, ?, ?, ?, ?)
```

**Mark status based on relevance:**

If **matches = true**:
```sql
INSERT INTO sent_events (event_id, instance_id, status, reason)
SELECT ?, id, 'pending', ?
FROM event_instances WHERE event_id = ?
```

If **matches = false**:
```sql
INSERT INTO sent_events (event_id, instance_id, status, reason)
SELECT ?, id, 'excluded', ?
FROM event_instances WHERE event_id = ?
```

---

## Step 6: Generate Email Digest

Query for all unsent events:

```sql
SELECT
  e.*,
  ei.instance_date,
  ei.instance_time,
  ei.end_date,
  ei.ticket_sale_date,
  ei.ticket_sale_time
FROM events e
JOIN event_instances ei ON e.id = ei.event_id
WHERE ei.id NOT IN (
  SELECT instance_id FROM sent_events WHERE status = 'sent'
)
AND ei.id NOT IN (
  SELECT instance_id FROM sent_events WHERE status = 'excluded'
)
ORDER BY ei.instance_date ASC
```

If **no unsent events**: Stop here and report "No new events to send"

### 6.1: Categorize Events

Group events by category based on your understanding:
- 🎵 **Music**: Concerts, live music, band performances
- 🎨 **Arts & Culture**: Gallery openings, theater, film, poetry
- 🛠️ **Workshops**: Classes, hands-on learning, craft sessions
- 📅 **Other**: Events that don't fit above

### 6.2: Generate Email Content

**Subject Line**:
```
{count} New Events ({earliest_date} - {latest_date})
```
Example: `8 New Events (Oct 15 - Nov 22)`

**HTML Email** (use template structure from `planning/data-formats.md`):
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
    .category { margin: 30px 0; }
    .event-card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
    .event-title { font-size: 18px; font-weight: bold; }
    .event-meta { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🎉 {count} New Events</h1>

  <div class="category">
    <h2>🎵 Music</h2>
    <!-- Event cards -->
  </div>

  <div class="category">
    <h2>🎨 Arts & Culture</h2>
    <!-- Event cards -->
  </div>

  <!-- More categories -->
</body>
</html>
```

**Plain Text Email** (markdown-style):
```
# 8 New Events

## 🎵 Music

### Jazz Night with Sarah Vaughan Tribute
📅 Friday, October 15, 2025 at 8:00 PM
📍 Blue Note Jazz Club
💰 $25-$35
🎫 Tickets: https://tickets.example.com/...
🔗 More info: https://example.com/events/...

Why this matches: User is interested in jazz music, and this is...

---

## 🎨 Arts & Culture

...
```

---

## Step 7: Send Email via MCP

Use **smtp-email MCP** to send the digest:

```javascript
send_digest_email({
  to: process.env.EMAIL_TO,  // Or read from .env via context
  subject: "8 New Events (Oct 15 - Nov 22)",
  html: "<html>...</html>",
  text: "Plain text version...",
  events: [
    {
      title: "Jazz Night",
      venue: "Blue Note",
      description: "...",
      event_url: "...",
      ticket_url: "...",
      instances: [
        {
          date: "2025-10-15",
          time: "20:00:00",
          ticket_sale_date: "2025-10-01",
          ticket_sale_time: "09:00:00"
        }
      ]
    },
    // All other events...
  ]
})
```

The MCP server will:
- Read SMTP credentials from `.env`
- Generate iCal files (`events-2025-10-09.ics`, `tickets-2025-10-09.ics`)
- Send multipart email with attachments
- Return success/failure

---

## Step 8: Mark Events as Sent

After successful email send, update the database:

```sql
UPDATE sent_events
SET status = 'sent',
    sent_at = CURRENT_TIMESTAMP
WHERE instance_id IN (
  -- IDs of all instances that were sent
)
```

---

## Step 9: Report Summary

Display a summary to the user:

```
✅ Event Discovery Complete

Sources checked: 10
Sources succeeded: 8
Sources failed: 2 (auto-disabled after 3 failures)

Events discovered: 45
New events: 12
Duplicates skipped: 33

Relevance matching:
- Matched: 8 events
- Excluded: 4 events

Email sent: ✅
- Subject: "8 New Events (Oct 15 - Nov 22)"
- Events: 8
- Attachments: events-2025-10-09.ics, tickets-2025-10-09.ics
- Sent to: jhedin10@gmail.com

Failed sources (if any):
- example.com/events: Timeout after 5s
```

---

## Error Handling

**If source fetch fails**:
- Log error to database
- Continue to next source
- Don't crash the entire workflow

**If event extraction fails**:
- Log warning
- Continue to next source

**If email send fails**:
- Report error clearly
- Events remain in 'pending' status (will retry next run)

**If database operations fail**:
- Report error and stop (data integrity critical)

---

## Notes

- **Be flexible**: Websites have different formats, adapt your extraction
- **Be smart**: Use context clues (venue names, event descriptions)
- **Be conservative**: When in doubt about duplicates, skip it (better to miss than duplicate)
- **Be helpful**: Provide clear reasoning for matches/exclusions

This is an **autonomous workflow**. Execute all steps without asking for confirmation unless you encounter an error you can't handle.
