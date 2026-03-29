# /search — Search Events

Search the event database using full-text search (FTS5 with Porter stemming).

## Usage

```
/search <query>
```

Examples:
- `/search jazz` — all upcoming jazz events
- `/search "cat power"` — exact phrase
- `/search blues april` — blues events (implicit AND)
- `/search wood*` — woodworking, woodturning, etc.
- `/search candlelight OR tribute` — either term

## Instructions

### Step 1: Translate user query to FTS5 terms

The user's query may be natural language. Translate it to good FTS5 search terms:
- "woodworking workshops" → `wood*` (prefix catches woodturning, carving, etc.)
- "something with jazz in april" → `jazz` (date filtering handled separately)
- "cat power show" → `"cat power"` (phrase)
- "blues or folk" → `blues OR folk`
- "indie rock" → `indie OR rock`

### Step 2: Run the search script

```bash
node scripts/search-events.js <fts_query> --limit 20
```

Options:
- `--limit N` — max results (default 20)
- `--from YYYY-MM-DD` — only events on/after this date (default: today)
- `--all` — include past events too
- `--json` — get raw JSON for further processing

### Step 3: Display results

Format results clearly with dates, venue, price, and URLs. Include a Google Calendar quick-add link for each result.

**Google Calendar URL format:**
```
https://calendar.google.com/calendar/render?action=TEMPLATE&text=TITLE&dates=START/END&location=VENUE&details=URL
```
- `text`: URL-encode the event title
- `dates`: `YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS` (no Z — local time)
  - If no time: use `YYYYMMDD/YYYYMMDD` (all-day)
  - If no end time: start + 2 hours
- `location`: URL-encode the venue
- `details`: URL-encode the event_url

**Example output format:**

```
🔍 "jazz" — 8 results

🎵 **The Jonny Chavez Quartet at Gulbar**
Sun Mar 29 at 6:00 PM · Gulbar · Free
🔗 https://www.jazzyyc.com/...
📆 [Add to calendar](https://calendar.google.com/...)

🎵 **Jazz Night at Ambrose**
Tue Mar 31 at 7:30 PM · Ambrose University
🔗 https://www.jazzyyc.com/...
📆 [Add to calendar](https://calendar.google.com/...)
```

### Step 4: Handle no results

If the search returns nothing, suggest alternative search terms and try a broader query. For example, if `woodworking` returns 0 results, try `wood*` or `workshop`.

### FTS5 Syntax Reference

| Pattern | Matches |
|---------|---------|
| `jazz` | "jazz", "jazzy" (stemmed) |
| `"big band"` | exact phrase "big band" |
| `jazz blues` | both words present |
| `jazz OR blues` | either word |
| `jazz NOT metal` | jazz without metal |
| `wood*` | woodturning, woodcarving, woodwork... |
| `perform*` | perform, performance, performing |
