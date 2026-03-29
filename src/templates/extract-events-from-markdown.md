# Extract Events from Markdown

You are analyzing a website's event listing page that has been converted to markdown.

Your task is to extract all events as structured JSON.

---

## Input

You will receive markdown content from a website. It may contain:
- Event listings with dates, times, venues
- Ticket information and pricing
- Event descriptions
- Links to more details or ticket purchases
- Images and other media (which appear as markdown image syntax)

**Note**: The markdown may be truncated at 100KB. Extract what you can from the available content.

---

## Output Format

Return a JSON array of events. Each event should have this structure:

```json
[
  {
    "title": "Event title",
    "venue": "Venue name or location",
    "description": "Brief description (optional)",
    "price": "Price information as string (optional)",
    "event_url": "Link to event details (optional)",
    "ticket_url": "Link to purchase tickets (optional)",
    "image_url": "Link to event image (optional)",
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

### Field Guidelines

**Required fields**:
- `title`: The event name
- `instances`: Array with at least one instance containing `date`

**Optional fields** (use `null` or omit if not found):
- `venue`: Where the event takes place
- `description`: Brief description (1-3 sentences, don't include full text)
- `price`: e.g., "$25", "Free", "$10-$15", "From $20"
- `event_url`: Link to learn more
- `ticket_url`: Link to buy tickets
- `image_url`: Event poster/image
- `minimum_age`: Number (18, 21, etc.) or null if all-ages

**Instance fields**:
- `date`: **Required**. Format: `YYYY-MM-DD`
- `time`: Format: `HH:MM:SS` (24-hour). Null if time not specified.
- `end_date`: Format: `YYYY-MM-DD`. For multi-day events.
- `ticket_sale_date`: When tickets go on sale. Format: `YYYY-MM-DD`
- `ticket_sale_time`: Time tickets go on sale. Format: `HH:MM:SS`

---

## Instructions

### 1. Find All Events

Scan the entire markdown for anything that looks like an event:
- Events in lists or tables
- Event cards or sections
- Calendar-style listings
- Embedded event information

### 2. Parse Dates Intelligently

**Absolute dates**:
- "October 15, 2025" → `2025-10-15`
- "15/10/2025" → `2025-10-15`
- "Oct 15" → `2025-10-15` (infer current/next year based on context)
- "Friday, October 15" → `2025-10-15`

**Relative dates** (assume current date is the date when this is run):
- "Today" → today's date
- "Tomorrow" → tomorrow's date
- "This Friday" → next Friday's date
- "Next week" → appropriate date next week

**Recurring events**:
- "Every Friday in October" → Create separate instances for each Friday
- "October 15, 16, 17" → Create separate instances for each date
- "Oct 15 - Oct 17" → Create instances for Oct 15, 16, and 17 (or use `end_date`)

### 3. Parse Times

**Common formats**:
- "8:00 PM" → `20:00:00`
- "8 PM" → `20:00:00`
- "20:00" → `20:00:00`
- "Doors at 7, show at 8" → Use show time (`20:00:00`)

**If no time given**: Set `time` to `null`

**Multi-day events**: Use `end_date` for the last day
- "October 15-17" → `date: "2025-10-15"`, `end_date: "2025-10-17"`

### 4. Extract Venue Information

Look for:
- Explicit venue names ("Blue Note Jazz Club")
- Location indicators ("at Kensington Coffee House")
- Address information (include in venue if helpful)

If no venue specified, set to `null` or try to infer from context.

**Use the shortest, most common form of the venue name** — this is critical for deduplication:
- Use `"Studio Bell"` not `"Studio Bell, National Music Centre"` or `"Studio Bell (National Music Centre)"`
- Use `"Jack Singer Concert Hall"` not `"Werklund Centre - Jack Singer Concert Hall"`
- Use `"Engineered Air Theatre"` not `"Werklund Centre - Engineered Air Theatre"`
- Use the primary building/room name, drop parent organization suffixes
- Be consistent: if you've seen the venue before in the content, use the same form

### 5. Extract URLs

**Event URL**: Link to "More Info", "Details", or the event page itself
**Ticket URL**: Link to "Buy Tickets", "RSVP", "Tickets", or ticket vendor

Both may be the same URL if the event page has ticket purchasing.

### 6. Extract Pricing

Look for:
- "$25"
- "Free"
- "$10 - $15" (range)
- "From $20" (starting price)
- "$25 advance / $30 door"

Keep it concise. If complex pricing, simplify to "$25-$30" or "$25+".

### 7. Handle Special Cases

**No events found**: Return empty array `[]`

**Truncated markdown**: Extract what you can, don't worry about missing content

**Unclear information**: Make reasonable assumptions:
- If it mentions "show at 8pm" but no date, skip it (date required)
- If venue is in website title/header, you can use that
- If pricing is complex, simplify or omit

**Past events**: Include them (the calling code will filter by date)

---

## Examples

### Example Input 1: Simple Event

```markdown
# Upcoming Shows

## Jazz Night with Sarah Vaughan Tribute
Friday, October 15, 2025 at 8:00 PM
Blue Note Jazz Club
$25 advance / $30 door
[Buy Tickets](https://tickets.example.com/jazz)
```

### Example Output 1:

```json
[
  {
    "title": "Jazz Night with Sarah Vaughan Tribute",
    "venue": "Blue Note Jazz Club",
    "description": null,
    "price": "$25-$30",
    "event_url": null,
    "ticket_url": "https://tickets.example.com/jazz",
    "image_url": null,
    "minimum_age": null,
    "instances": [
      {
        "date": "2025-10-15",
        "time": "20:00:00",
        "end_date": null,
        "ticket_sale_date": null,
        "ticket_sale_time": null
      }
    ]
  }
]
```

---

### Example Input 2: Recurring Event

```markdown
# Pottery Workshop

Every Saturday in November
10am - 2pm
The Clay Studio
$45 per session
Tickets on sale October 1st at 9am
```

### Example Output 2:

```json
[
  {
    "title": "Pottery Workshop",
    "venue": "The Clay Studio",
    "description": null,
    "price": "$45",
    "event_url": null,
    "ticket_url": null,
    "image_url": null,
    "minimum_age": null,
    "instances": [
      {
        "date": "2025-11-01",
        "time": "10:00:00",
        "end_date": null,
        "ticket_sale_date": "2025-10-01",
        "ticket_sale_time": "09:00:00"
      },
      {
        "date": "2025-11-08",
        "time": "10:00:00",
        "end_date": null,
        "ticket_sale_date": "2025-10-01",
        "ticket_sale_time": "09:00:00"
      },
      {
        "date": "2025-11-15",
        "time": "10:00:00",
        "end_date": null,
        "ticket_sale_date": "2025-10-01",
        "ticket_sale_time": "09:00:00"
      },
      {
        "date": "2025-11-22",
        "time": "10:00:00",
        "end_date": null,
        "ticket_sale_date": "2025-10-01",
        "ticket_sale_time": "09:00:00"
      },
      {
        "date": "2025-11-29",
        "time": "10:00:00",
        "end_date": null,
        "ticket_sale_date": "2025-10-01",
        "ticket_sale_time": "09:00:00"
      }
    ]
  }
]
```

---

### Example Input 3: Multiple Events

```markdown
# This Week's Events

**Monday: Open Mic Night**
7pm, Free, All ages

**Wednesday: The National - Live**
Doors 7pm, Show 8pm
$50-$75
19+ event
[Tickets](https://tickets.com/national)

**Friday: Art Gallery Opening**
6-9pm reception, Free admission
```

### Example Output 3:

```json
[
  {
    "title": "Open Mic Night",
    "venue": null,
    "description": null,
    "price": "Free",
    "event_url": null,
    "ticket_url": null,
    "image_url": null,
    "minimum_age": null,
    "instances": [
      {
        "date": "2025-10-13",
        "time": "19:00:00",
        "end_date": null,
        "ticket_sale_date": null,
        "ticket_sale_time": null
      }
    ]
  },
  {
    "title": "The National - Live",
    "venue": null,
    "description": null,
    "price": "$50-$75",
    "event_url": null,
    "ticket_url": "https://tickets.com/national",
    "image_url": null,
    "minimum_age": 19,
    "instances": [
      {
        "date": "2025-10-15",
        "time": "20:00:00",
        "end_date": null,
        "ticket_sale_date": null,
        "ticket_sale_time": null
      }
    ]
  },
  {
    "title": "Art Gallery Opening",
    "venue": null,
    "description": null,
    "price": "Free",
    "event_url": null,
    "ticket_url": null,
    "image_url": null,
    "minimum_age": null,
    "instances": [
      {
        "date": "2025-10-17",
        "time": "18:00:00",
        "end_date": null,
        "ticket_sale_date": null,
        "ticket_sale_time": null
      }
    ]
  }
]
```

---

## Common Patterns to Recognize

### Pattern: Shopify Events
```markdown
## Product: Workshop Name
Price: $45
View Details
```
→ Extract as event (Shopify collections often used for workshops)

### Pattern: Google Calendar Embed
```markdown
Event Title
When: Oct 15, 2025, 7pm
Where: Venue Name
```
→ Extract structured data

### Pattern: Ticketmaster/Eventbrite Links
```markdown
[Event Name](https://eventbrite.com/...)
Date shown nearby
```
→ Extract event, use Eventbrite link as `ticket_url`

### Pattern: Weekly Schedule
```markdown
| Day | Event | Time |
| Mon | Jazz Night | 8pm |
| Tue | Open Mic | 7pm |
```
→ Create separate events for each

---

## Validation

Before returning, check:
- [ ] All events have `title`
- [ ] All events have at least one instance with `date`
- [ ] Dates are in `YYYY-MM-DD` format
- [ ] Times are in `HH:MM:SS` format or `null`
- [ ] No syntax errors in JSON
- [ ] Return `[]` if no events found (not null, not error)

---

## Now Extract Events

Analyze the markdown below and extract all events as JSON:

**Markdown:**
[The markdown content will be inserted here by the calling agent]

**Output:**
[Return only the JSON array, no other text]
