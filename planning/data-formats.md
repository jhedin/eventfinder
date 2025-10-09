# EventFinder Data Formats

This document defines all data formats used in EventFinder: LLM extraction outputs, email templates, and iCal specifications.

## LLM Extraction Format

### Event Extraction from Markdown

When the LLM extracts events from a webpage (converted to markdown via Playwright MCP), it returns a JSON array:

```json
[
  {
    "title": "string",
    "venue": "string",
    "description": "string (optional)",
    "price": "string (optional, e.g., '$45', 'Free', '$20-30')",
    "event_url": "string (optional)",
    "ticket_url": "string (optional)",
    "image_url": "string (optional)",
    "minimum_age": "number (optional, e.g., 18, 21)",
    "instances": [
      {
        "date": "YYYY-MM-DD (ISO 8601)",
        "time": "HH:MM:SS (ISO 8601, optional)",
        "end_date": "YYYY-MM-DD (optional, for multi-day events)",
        "ticket_sale_date": "YYYY-MM-DD (optional)",
        "ticket_sale_time": "HH:MM:SS (optional)"
      }
    ]
  }
]
```

**Field Notes:**
- `title`: Event name (required)
- `venue`: Venue name (required)
- `description`: Event description text (optional, can be null or empty)
- `price`: Text format like "$25", "Free", "$15-25", "$20+" (optional)
- `event_url`: Link to event detail page (optional)
- `ticket_url`: Direct ticket purchase link (optional)
- `image_url`: Event image/poster URL (optional)
- `minimum_age`: Numeric age restriction like 18, 19, 21 (optional)
- `instances`: Array of date/time occurrences (required, at least 1)
  - `date`: Event date in ISO 8601 format (required)
  - `time`: Event time in 24-hour format (optional, null if no specific time)
  - `end_date`: For multi-day events like exhibitions (optional)
  - `ticket_sale_date`: When tickets go on sale (optional)
  - `ticket_sale_time`: Time tickets go on sale (optional)

**Timezone Handling:**
- All times assumed to be in America/Edmonton (Mountain Time)
- Since EventFinder runs per-location, single timezone is sufficient
- Stored in `event_instances.timezone` (default: 'America/Edmonton')

**Example - Single Event:**
```json
[
  {
    "title": "Jazz Night with The Quartet",
    "venue": "The Palomino",
    "description": "A classic jazz evening featuring local musicians",
    "price": "$25",
    "event_url": "https://thepalomino.ca/events/jazz-night",
    "ticket_url": "https://thepalomino.ca/tickets/jazz-night",
    "image_url": "https://thepalomino.ca/images/jazz-night.jpg",
    "minimum_age": 18,
    "instances": [
      {
        "date": "2025-10-15",
        "time": "19:00:00",
        "end_date": null,
        "ticket_sale_date": "2025-10-01",
        "ticket_sale_time": "10:00:00"
      }
    ]
  }
]
```

**Example - Recurring Event:**
```json
[
  {
    "title": "Christmas Tea",
    "venue": "Lougheed House",
    "description": "Holiday afternoon tea service",
    "price": "$45",
    "event_url": "https://lougheedhouse.com/events/christmas-tea",
    "ticket_url": "https://lougheedhouse.com/tickets/christmas-tea",
    "image_url": null,
    "minimum_age": null,
    "instances": [
      {
        "date": "2025-11-30",
        "time": "14:00:00",
        "end_date": null,
        "ticket_sale_date": null,
        "ticket_sale_time": null
      },
      {
        "date": "2025-12-07",
        "time": "14:00:00",
        "end_date": null,
        "ticket_sale_date": null,
        "ticket_sale_time": null
      },
      {
        "date": "2025-12-21",
        "time": "14:00:00",
        "end_date": null,
        "ticket_sale_date": null,
        "ticket_sale_time": null
      }
    ]
  }
]
```

**Example - Multi-day Event:**
```json
[
  {
    "title": "A House of Story Exhibition",
    "venue": "Lougheed House",
    "description": "Long-running art exhibition",
    "price": "Free",
    "event_url": "https://lougheedhouse.com/exhibitions/house-of-story",
    "ticket_url": null,
    "image_url": "https://lougheedhouse.com/images/exhibition.jpg",
    "minimum_age": null,
    "instances": [
      {
        "date": "2025-09-11",
        "time": null,
        "end_date": "2025-11-16",
        "ticket_sale_date": null,
        "ticket_sale_time": null
      }
    ]
  }
]
```

---

### Relevance Matching

When determining if an event matches user preferences, the LLM returns:

```json
{
  "matches": true,
  "reason": "User is interested in jazz music and this is a jazz quartet performance at an intimate venue under $50"
}
```

**Fields:**
- `matches` (boolean): `true` if event matches user interests, `false` if not
- `reason` (string): Human-readable explanation of why it matches or doesn't match

**The reason is critical** - it provides context for why the LLM made its decision and can help debug matching logic.

**Examples:**

Match:
```json
{
  "matches": true,
  "reason": "Strong match: User loves indie rock and The National (indie rock band) is performing at an intimate venue. Price of $35 is under user's $50 preference."
}
```

No match:
```json
{
  "matches": false,
  "reason": "This is a hockey game and user explicitly stated no interest in sports events"
}
```

Nuanced match:
```json
{
  "matches": true,
  "reason": "User is interested in craft workshops. While this is candle-making (not explicitly mentioned), it fits the pattern of hands-on creative workshops user enjoys"
}
```

---

### Page Analysis (for /test-source)

When testing a URL for event extraction suitability:

```json
{
  "suitable": true,
  "confidence": "high",
  "event_count": 8,
  "platform": "Squarespace",
  "structure": "chronological list",
  "has_pagination": false,
  "has_dynamic_content": true,
  "data_completeness": {
    "dates": "complete",
    "times": "mostly present",
    "prices": "complete",
    "descriptions": "brief"
  },
  "issues": ["No venue address found", "Some events missing times"],
  "recommended_check_frequency": "daily",
  "event_urls": [
    "https://example.com/events"
  ],
  "alternative_urls": [
    "https://example.com/calendar",
    "https://example.com/upcoming"
  ]
}
```

**Fields:**
- `suitable` (boolean): Is this source good for monitoring?
- `confidence` (enum): "high", "medium", "low"
- `event_count` (number): Number of events found
- `platform` (string): Detected platform (Squarespace, WordPress, custom, etc.)
- `structure` (string): How events are organized
- `has_pagination` (boolean): Are there multiple pages?
- `has_dynamic_content` (boolean): JavaScript-rendered content?
- `data_completeness` (object): Assessment of each field type
  - `dates`, `times`, `prices`, `descriptions`: "complete", "mostly present", "partial", "missing"
- `issues` (array of strings): Problems found
- `recommended_check_frequency` (string): "daily", "weekly", "bi-weekly"
- `event_urls` (array): Main URL(s) to monitor
- `alternative_urls` (array): Other pages that might have events

---

## Email Digest Format

### Subject Line

Format: `{count} New Events ({earliest_date} - {latest_date})`

Examples:
- `8 New Events (Oct 15 - Nov 22)`
- `3 New Events (Dec 1 - Dec 15)`
- `1 New Event (Oct 20)`

### HTML Email Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* CSS styles for email */
  </style>
</head>
<body>
  <h1>{count} New Events ({date_range})</h1>

  <!-- Grouped by category -->
  <section>
    <h2>🎵 MUSIC ({music_count} events)</h2>

    <div class="event-card">
      <h3>Jazz Night with The Quartet</h3>
      <p><strong>📅 Date:</strong> Oct 15, 7:00 PM</p>
      <p><strong>📍 Venue:</strong> The Palomino, Calgary</p>
      <p><strong>💵 Price:</strong> $25</p>
      <p><strong>🔞 Age:</strong> 18+</p>

      <p>A classic jazz evening featuring local musicians...</p>

      <p>
        <a href="...">View Event</a> |
        <a href="...">Buy Tickets</a>
      </p>
    </div>

    <!-- More music events -->
  </section>

  <section>
    <h2>🎭 COMEDY ({comedy_count} events)</h2>
    <!-- Comedy events -->
  </section>

  <section>
    <h2>🎨 WORKSHOPS ({workshop_count} events)</h2>
    <!-- Workshop events -->
  </section>

  <footer>
    <p>Calendar invites attached for each event.</p>
    <p>Found via EventFinder</p>
  </footer>
</body>
</html>
```

**Event Card Fields (in order):**
1. Title (h3)
2. Date and time with 📅 emoji
3. Venue and city with 📍 emoji
4. Price with 💵 emoji
5. Age restriction with 🔞 emoji (if applicable)
6. Description paragraph
7. Links (View Event, Buy Tickets)

**Category Icons:**
- 🎵 Music
- 🎭 Comedy/Theatre
- 🎨 Workshops/Classes
- 📚 Education/Talks
- 🍴 Food & Drink
- 🎪 Festivals
- 🏛️ Museums/Galleries
- (Others as needed)

**Grouping:**
- Events grouped by category
- Categories sorted by event count (most events first)
- Within each category, events sorted chronologically

### Plain Text Email (Markdown-style)

```
# 8 New Events (Oct 15 - Nov 22)

## 🎵 MUSIC (3 events)

**Jazz Night with The Quartet**
📅 Oct 15, 7:00 PM
📍 The Palomino, Calgary
💵 $25
🔞 18+

A classic jazz evening featuring local musicians...

[View Event](https://...) | [Buy Tickets](https://...)

---

**[Next event]**

---

## 🎭 COMEDY (2 events)

**[Comedy events]**

---

## 🎨 WORKSHOPS (3 events)

**[Workshop events]**

---

Calendar invites attached for each event.
Found via EventFinder
```

**Notes:**
- Uses markdown syntax (**, #, [], etc.) but displays as plain text
- Emojis still work in plain text
- URLs shown in full or as markdown links (displayed as text)
- Readable even without markdown rendering

---

## iCal Format

### File Naming Convention

**Event reminder:**
```
event-{YYYY-MM-DD}-{slug}.ics
```

**Ticket sale reminder:**
```
tickets-{YYYY-MM-DD}-{slug}.ics
```

Where `{slug}` is the event title kebab-cased (lowercase, hyphens instead of spaces, max 50 chars).

**Examples:**
- `event-2025-10-15-jazz-night-with-the-quartet.ics`
- `tickets-2025-10-01-jazz-night-with-the-quartet.ics`

### Event Calendar Entry

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EventFinder//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH

BEGIN:VEVENT
UID:{event_hash}@eventfinder.local
DTSTAMP:{current_timestamp}
DTSTART;TZID=America/Edmonton:{event_datetime}
DTEND;TZID=America/Edmonton:{event_end_datetime}
SUMMARY:{title} @ {venue}
LOCATION:{venue}, {city}, {province}
DESCRIPTION:{description}\n\nPrice: {price}\n{age_restriction}\n\nTickets: {ticket_url}\n\nSource: {source_url}
URL:{event_url}
STATUS:CONFIRMED
TRANSP:OPAQUE

BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Reminder: {title} tomorrow
END:VALARM

BEGIN:VALARM
TRIGGER:-PT3H
ACTION:DISPLAY
DESCRIPTION:Reminder: {title} in 3 hours
END:VALARM

END:VEVENT
END:VCALENDAR
```

**Field Mapping:**
- `UID`: Use event_hash for uniqueness
- `DTSTART`: Event start datetime in America/Edmonton timezone
- `DTEND`: Event end datetime (or +2 hours if no end time)
- `SUMMARY`: "{title} @ {venue}" format
- `LOCATION`: "{venue}, {city}, {province}" format
- `DESCRIPTION`: Multi-line with description, price, age, ticket URL, source URL
- `URL`: Event detail page link
- `VALARM` (2 reminders):
  - 1 day before: `-P1D`
  - 3 hours before: `-PT3H`

### Ticket Sale Calendar Entry

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EventFinder//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH

BEGIN:VEVENT
UID:{event_hash}-tickets@eventfinder.local
DTSTAMP:{current_timestamp}
DTSTART;TZID=America/Edmonton:{ticket_sale_datetime}
DTEND;TZID=America/Edmonton:{ticket_sale_datetime + 1 hour}
SUMMARY:Tickets on sale: {title}
LOCATION:{ticket_url}
DESCRIPTION:Tickets go on sale for {title} at {venue}.\n\nEvent Date: {event_date}\n\nTickets: {ticket_url}
URL:{ticket_url}
STATUS:CONFIRMED
TRANSP:OPAQUE

BEGIN:VALARM
TRIGGER:PT0M
ACTION:DISPLAY
DESCRIPTION:Tickets on sale now: {title}
END:VALARM

END:VEVENT
END:VCALENDAR
```

**Field Mapping:**
- `UID`: Use event_hash + "-tickets" for uniqueness
- `DTSTART`: Ticket sale datetime in America/Edmonton timezone
- `DTEND`: +1 hour from ticket sale time (placeholder duration)
- `SUMMARY`: "Tickets on sale: {title}"
- `LOCATION`: Ticket URL (so calendar shows where to buy)
- `DESCRIPTION`: When tickets go on sale, event date, ticket link
- `URL`: Direct ticket purchase link
- `VALARM`: Day of ticket sale (morning of, PT0M = at event time)

**Note on ticket sale reminder timing:**
- If ticket_sale_time is specified, reminder fires at that exact time
- If no ticket_sale_time, default to 9:00 AM on ticket_sale_date
- This ensures users don't miss popular events that sell out quickly

---

## Error Handling Specifications

### Source Check Timeout
- **Value**: 5 seconds per source
- **Action on timeout**: Mark as error, increment consecutive_failures

### Auto-disable Threshold
- **Value**: 3 consecutive failures
- **Action**: Set `sources.active = 0`, log reason in error_message

### Retry Policy
- **No retries at application level** - Playwright MCP handles retries internally

### Partial Failure Handling
- **Policy**: Send digest anyway with successfully fetched events
- **Logging**: Log all failures with error details
- **User notification**: Include failed source count in email footer

---

## Configuration File Formats

### User Preferences (data/user-preferences.md)

Natural language markdown file:

```markdown
# My Event Preferences

## Location
I live in Calgary, AB, Canada (Mountain Time - America/Edmonton).

## What I Like
I'm interested in:
- Live music, especially jazz, indie rock, and folk
- Comedy shows and stand-up comedy
- Art exhibitions and gallery openings
- Craft workshops like pottery, candle making, woodworking

Examples of events I'd enjoy:
- Jazz quartet at intimate venue
- Local comedian at comedy club
- Opening night at art gallery
- Hands-on pottery workshop

## What I Don't Like
I'm not interested in:
- Sports events (hockey, football, etc.)
- Children's events
- Large festivals (prefer intimate venues)

## Other Notes
- Prefer events under $50
- Weekday evenings (6-9pm) work best for me
- Don't mind driving up to 30 minutes
```

**Sections Required:**
- Location (with city, province/state, timezone)
- What I Like (interests with examples)
- What I Don't Like (exclusions)
- Other Notes (optional preferences)

**LLM Usage:**
- LLM reads this entire file as context for relevance matching
- Natural language allows nuanced preferences
- Examples help LLM understand edge cases

### Environment Variables (.env)

```bash
# Mailgun SMTP Configuration
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=<your-sandbox-domain>  # e.g., postmaster@sandboxXXX.mailgun.org
SMTP_PASSWORD=<mailgun_smtp_password>

# Email Addresses
EMAIL_FROM=<your-sandbox-domain>@mailgun.org
EMAIL_TO=your-email@gmail.com  # Must be authorized recipient

# Database
DATABASE_PATH=./data/eventfinder.db

# Optional: Other API keys (for future use)
TICKETMASTER_API_KEY=your_key_here
```

**Required Fields:**
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD (for Mailgun)
- EMAIL_FROM (sandbox domain sender)
- EMAIL_TO (authorized recipient - must verify first)
- DATABASE_PATH (SQLite database location)

---

## Summary: All Data Flows

### 1. Event Discovery Flow
```
Source URL
  → Playwright MCP (HTML → Markdown)
  → LLM (Markdown → JSON events array)
  → Database (store events + instances)
```

### 2. Relevance Matching Flow
```
Event + User Preferences
  → LLM (matching logic)
  → {matches: bool, reason: string}
  → Database (sent_events with status)
```

### 3. Email Generation Flow
```
Matched Events
  → Group by category
  → Generate HTML (with emojis, links)
  → Generate Plain Text (markdown-style)
  → Generate iCal attachments (2 per event)
  → SMTP MCP (send multipart email)
```

### 4. Source Testing Flow
```
Test URL
  → Playwright MCP (fetch page)
  → LLM (analyze structure + extract)
  → Return analysis JSON
  → Display to user
```
