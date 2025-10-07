# EventFinder: Technical Design

## Architecture Overview

EventFinder consists of three main components:

1. **LLM Script Runner** (Claude Code) - Orchestrates event discovery and matching
2. **Data Layer** (SQLite) - Persistent storage for sources, interests, events
3. **External Services** - Email (SMTP), Web fetching (RSS/HTTP)

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code (LLM)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Event Discovery Script (src/script.md)              │   │
│  │  - Fetch sources                                      │   │
│  │  - Parse events                                       │   │
│  │  - Match interests                                    │   │
│  │  - Generate digest                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│              ↓                           ↓                   │
│    ┌──────────────────┐        ┌─────────────────┐          │
│    │ Slash Commands   │        │  Context Files  │          │
│    │ /add-site        │        │  - domain.md    │          │
│    │ /add-interest    │        │  - examples.md  │          │
│    │ /run-now         │        │  - templates    │          │
│    └──────────────────┘        └─────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                   ↓                           ↓
    ┌──────────────────────────┐   ┌──────────────────────────┐
    │   SQLite Database        │   │   External Services      │
    │   - sources              │   │   - SMTP (Nodemailer)    │
    │   - interests            │   │   - HTTP/RSS Fetcher     │
    │   - events               │   │   - iCal Generator       │
    │   - sent_digests         │   │                          │
    └──────────────────────────┘   └──────────────────────────┘
```

## Data Model

### Database Schema (SQLite)

#### `sources` table
```sql
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- User-friendly name
  url TEXT NOT NULL UNIQUE,        -- Source URL
  type TEXT NOT NULL,              -- 'rss', 'html', 'api'
  category TEXT,                   -- 'music', 'comedy', 'sports', etc.
  scraper_config TEXT,             -- JSON: selectors, patterns, etc.
  active BOOLEAN DEFAULT 1,        -- Is this source enabled?
  last_checked_at DATETIME,        -- Last successful fetch
  last_error TEXT,                 -- Last error message (if any)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `interests` table
```sql
CREATE TABLE interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,              -- 'artist', 'venue', 'genre', 'keyword'
  value TEXT NOT NULL,             -- The actual interest (e.g., "Fleet Foxes")
  priority TEXT DEFAULT 'medium',  -- 'high', 'medium', 'low'
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_interests_type ON interests(type);
CREATE INDEX idx_interests_value ON interests(value);
```

#### `events` table
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_hash TEXT NOT NULL UNIQUE, -- SHA256(title + date + venue)
  source_id INTEGER,               -- FK to sources

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  event_date DATETIME NOT NULL,
  event_time TEXT,                 -- Time as string (e.g., "8:00 PM")
  timezone TEXT,                   -- IANA timezone (e.g., "America/Los_Angeles")

  -- Location
  venue_name TEXT,
  venue_address TEXT,
  city TEXT,

  -- Links
  event_url TEXT,
  ticket_url TEXT,
  image_url TEXT,

  -- Tickets
  ticket_sale_date DATETIME,       -- When tickets go on sale
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),

  -- Categorization
  artist TEXT,                     -- Primary artist/performer
  genre TEXT,                      -- Genre/category

  -- Matching
  interest_match_score INTEGER,    -- How well this matches interests
  matched_interests TEXT,          -- JSON array of matched interest IDs

  -- Tracking
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_in_digest_id INTEGER,       -- FK to sent_digests (null if not sent)

  FOREIGN KEY (source_id) REFERENCES sources(id)
);
CREATE INDEX idx_events_hash ON events(event_hash);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_sent ON events(sent_in_digest_id);
```

#### `sent_digests` table
```sql
CREATE TABLE sent_digests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_count INTEGER,
  email_to TEXT,
  email_subject TEXT,
  email_body TEXT,                 -- Full HTML body (for reference)
  success BOOLEAN DEFAULT 1,
  error_message TEXT
);
```

## Configuration Files

### `data/sources.json`
User-managed list of event sources (also in DB, but JSON for easy editing).

```json
{
  "sources": [
    {
      "name": "The Fillmore",
      "url": "https://www.fillmore.com/events",
      "type": "html",
      "category": "music",
      "scraper": {
        "event_selector": ".event-card",
        "title_selector": "h3.event-title",
        "date_selector": ".event-date",
        "link_selector": "a.event-link"
      }
    },
    {
      "name": "Bandsintown SF",
      "url": "https://www.bandsintown.com/rss/San+Francisco",
      "type": "rss",
      "category": "music"
    }
  ]
}
```

### `data/interests.json`
User-managed interests (also in DB).

```json
{
  "interests": [
    {
      "type": "artist",
      "value": "Fleet Foxes",
      "priority": "high"
    },
    {
      "type": "venue",
      "value": "The Fillmore",
      "priority": "high"
    },
    {
      "type": "genre",
      "value": "indie rock",
      "priority": "medium"
    },
    {
      "type": "keyword",
      "value": "psychedelic",
      "priority": "low"
    }
  ]
}
```

### `.env` additions
```env
# Database
DATABASE_PATH=./data/eventfinder.db

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=EventFinder <your-email@gmail.com>
EMAIL_TO=your-email@gmail.com

# Schedule
DIGEST_TIME=09:00              # Time to send digest (24h format)
CHECK_INTERVAL=daily           # How often to check sources

# Scraping
USER_AGENT=Mozilla/5.0 EventFinder/1.0
REQUEST_DELAY_MS=2000          # Delay between requests
MAX_RETRIES=3

# Matching
MIN_INTEREST_SCORE=50          # Minimum score for inclusion
```

## Tech Stack

### Core Dependencies
- **better-sqlite3** - Fast, synchronous SQLite for Node.js
- **nodemailer** - Email sending (SMTP)
- **ical-generator** - Create iCalendar (.ics) files
- **rss-parser** - Parse RSS/Atom feeds
- **node-cron** - Schedule daily runs

### Web Fetching
- **axios** - HTTP client for fetching pages
- **cheerio** - jQuery-like HTML parsing (for scraping)
- Native `fetch` - For simple requests

### LLM Integration
- Claude Code provides the LLM context
- Prompts in markdown files (src/script.md, src/templates/)
- Tools available: file read/write, bash commands, web fetch

## Event Discovery Workflow

### Daily Scheduled Run
```
1. Cron triggers at configured time (e.g., 6am)
   ↓
2. Load all active sources from DB
   ↓
3. For each source:
     a. Fetch content (RSS or HTTP)
     b. Parse for event data
     c. Extract structured data (use LLM for messy HTML)
     d. Generate event hash
     e. Check if event exists in DB
     f. If new: insert, calculate interest score
     g. If exists: update last_seen_at
   ↓
4. Query DB for unsent events above interest threshold
   ↓
5. Generate email digest HTML
   ↓
6. For each event, generate 2 iCal attachments
   ↓
7. Send email via SMTP
   ↓
8. Update events.sent_in_digest_id
   ↓
9. Insert record into sent_digests table
   ↓
10. Log results
```

### LLM-Assisted Event Parsing

For unstructured HTML, the LLM is prompted:

```markdown
## Task: Extract Event Data

From the following HTML snippet, extract event information:

<html>
[HTML content]
</html>

Return JSON:
{
  "title": "Event name",
  "artist": "Primary performer",
  "date": "2025-03-15",  // ISO format
  "time": "8:00 PM",
  "venue": "Venue name",
  "venue_address": "123 Main St, City, ST",
  "description": "Brief description",
  "ticket_url": "https://...",
  "ticket_sale_date": "2025-03-01T10:00:00",  // ISO with time
  "genre": "rock"
}

Guidelines:
- Parse relative dates ("Next Friday") to absolute
- Extract artist from title if possible
- Venue may be in address or separate element
- Ticket sale date may be in text like "On sale Friday, 10am"
```

## Interest Matching Algorithm

```javascript
function scoreEvent(event, interests) {
  let score = 0;
  let matched = [];

  for (const interest of interests) {
    let points = 0;
    let multiplier = interest.priority === 'high' ? 2 :
                     interest.priority === 'medium' ? 1 : 0.5;

    const value = interest.value.toLowerCase();

    switch (interest.type) {
      case 'artist':
        if (event.artist?.toLowerCase().includes(value) ||
            event.title?.toLowerCase().includes(value)) {
          points = 100;
        }
        break;

      case 'venue':
        if (event.venue_name?.toLowerCase().includes(value)) {
          points = 80;
        }
        break;

      case 'genre':
        if (event.genre?.toLowerCase().includes(value)) {
          points = 50;
        }
        break;

      case 'keyword':
        if (event.title?.toLowerCase().includes(value) ||
            event.description?.toLowerCase().includes(value)) {
          points = 30;
        }
        break;
    }

    if (points > 0) {
      score += points * multiplier;
      matched.push(interest.id);
    }
  }

  return { score, matched };
}
```

## Email Digest Format

### HTML Template

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
    .header { background: #4A90E2; color: white; padding: 20px; text-align: center; }
    .event { border: 1px solid #ddd; margin: 20px 0; padding: 15px; border-radius: 5px; }
    .event-title { font-size: 18px; font-weight: bold; color: #333; }
    .event-meta { color: #666; margin: 10px 0; }
    .button { background: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 EventFinder Daily Digest</h1>
    <p>{{ date }} - {{ event_count }} new events</p>
  </div>

  {{#each events}}
  <div class="event">
    <div class="event-title">{{ title }}</div>
    <div class="event-meta">
      📅 {{ formatted_date }} at {{ time }}<br>
      📍 {{ venue_name }}<br>
      🎵 {{ artist }}
    </div>
    <p>{{ description }}</p>
    <a href="{{ event_url }}" class="button">View Event</a>
    {{#if ticket_url}}
    <a href="{{ ticket_url }}" class="button">Buy Tickets</a>
    {{/if}}
    <p style="color: #999; font-size: 12px;">
      🎫 Calendar invite attached ({{ matched_interest_names }})
    </p>
  </div>
  {{/each}}

  <div style="text-align: center; color: #999; margin-top: 40px; padding: 20px;">
    <p>EventFinder · Manage settings: run <code>/add-interest</code> or <code>/add-site</code></p>
  </div>
</body>
</html>
```

### iCal Generation

```javascript
const ical = require('ical-generator');

function generateTicketSaleIcal(event) {
  const calendar = ical({ name: 'EventFinder' });
  calendar.method('REQUEST');

  const ticketDate = event.ticket_sale_date ||
                     new Date(event.event_date.getTime() - 7*24*60*60*1000); // 1 week before

  calendar.createEvent({
    start: ticketDate,
    end: new Date(ticketDate.getTime() + 60*60*1000), // 1 hour duration
    summary: `🎫 Tickets on sale: ${event.title}`,
    description: `Tickets go on sale for ${event.title}\n\n` +
                 `Event: ${event.formatted_date}\n` +
                 `Venue: ${event.venue_name}\n\n` +
                 `Buy tickets: ${event.ticket_url}`,
    location: 'Online',
    url: event.ticket_url,
    alarms: [
      { type: 'display', trigger: 60*24 },  // 1 day before
      { type: 'display', trigger: 60 }       // 1 hour before
    ]
  });

  return calendar.toString();
}

function generateEventIcal(event) {
  const calendar = ical({ name: 'EventFinder' });
  calendar.method('REQUEST');

  calendar.createEvent({
    start: event.event_date,
    end: new Date(event.event_date.getTime() + 3*60*60*1000), // 3 hours
    summary: `${event.artist} at ${event.venue_name}`,
    description: event.description + `\n\nMore info: ${event.event_url}`,
    location: `${event.venue_name}, ${event.venue_address}`,
    url: event.event_url,
    alarms: [
      { type: 'display', trigger: 60*24 },   // 1 day before
      { type: 'display', trigger: 3*60 }      // 3 hours before
    ]
  });

  return calendar.toString();
}
```

## Slash Commands Implementation

Slash commands are markdown files in `src/commands/` that provide interactive prompts.

### `/add-site` command
Location: `src/commands/add-site.md`

```markdown
# Add Event Source

You are helping the user add a new event source to monitor.

## Steps:

1. **Get the URL**
   - Ask: "What's the URL of the event source you'd like to add?"
   - Validate it's a valid URL

2. **Fetch and analyze**
   - Fetch the URL
   - Check for RSS/Atom feed (look for <link rel="alternate" type="application/rss+xml">)
   - If RSS found: "Great! I found an RSS feed. This will be easy to monitor."
   - If no RSS: "No RSS feed found. I'll need to scrape this page."

3. **Determine scraping strategy** (if no RSS)
   - Analyze HTML structure
   - Identify event list container
   - Find selectors for: title, date, link, venue
   - Show user: "I found events using this pattern: [explain]"
   - Ask: "Does this look correct?"

4. **Get metadata**
   - Ask: "What should I call this source?" (suggest site name)
   - Ask: "What category?" (music, comedy, sports, etc.)

5. **Save to database**
   - Insert into sources table
   - Also save to data/sources.json
   - Confirm: "✅ Added [name]. I'll check this source daily."

6. **Test fetch**
   - Run a test fetch
   - Show 2-3 example events found
   - Ask: "Want me to run the full check now?"
```

### `/add-interest` command
Location: `src/commands/add-interest.md`

```markdown
# Add Interest

Help the user add a new interest for event filtering.

## Steps:

1. **Choose type**
   - Ask: "What type of interest?"
   - Options:
     - 🎤 Artist/Performer
     - 📍 Venue
     - 🎵 Genre/Category
     - 🔍 Keyword

2. **Get value**
   - Based on type, ask for the value
   - Examples:
     - Artist: "Which artist/band?" → "Fleet Foxes"
     - Venue: "Which venue?" → "The Fillmore"
     - Genre: "Which genre?" → "indie rock"
     - Keyword: "Which keyword?" → "psychedelic"

3. **Set priority**
   - Ask: "How important is this?"
   - High: Events will be weighted heavily
   - Medium: Standard weighting
   - Low: Nice to have

4. **Save**
   - Insert into interests table
   - Also save to data/interests.json
   - Confirm: "✅ Added interest: [value] (priority: [priority])"

5. **Show current interests**
   - List all interests grouped by type
   - Show count of events matched recently
```

## Scheduling

### Using node-cron

```javascript
const cron = require('node-cron');
const { runEventDiscovery } = require('./discovery');
const { sendDigest } = require('./digest');

// Run at configured time daily (e.g., '0 6 * * *' = 6am daily)
const digestTime = process.env.DIGEST_TIME || '09:00';
const [hour, minute] = digestTime.split(':');

cron.schedule(`${minute} ${hour} * * *`, async () => {
  console.log('Starting scheduled event discovery...');
  const newEvents = await runEventDiscovery();
  if (newEvents.length > 0) {
    await sendDigest(newEvents);
  }
});

console.log(`EventFinder scheduled to run daily at ${digestTime}`);
```

### Alternative: Manual cron (Unix)

```bash
# Add to crontab
0 6 * * * cd /path/to/eventfinder/build && claude-code --run-script=/run-now
```

## Error Handling

### Source Fetch Failures
- Retry up to 3 times with exponential backoff
- Log error to sources.last_error
- Continue to next source
- Include in daily log email (summary of failures)

### Parsing Failures
- Log the HTML that failed to parse
- Use LLM fallback for unstructured content
- If total failure, skip event (don't crash)

### Email Failures
- Log error to sent_digests table
- Retry once after 5 minutes
- If still fails, save digest to file for manual review

## Testing Strategy

### Unit Tests
- Interest scoring algorithm
- Event hash generation
- Date parsing logic
- iCal generation

### Integration Tests
- RSS feed parsing with real feeds
- HTML scraping with saved fixtures
- Database operations
- Email sending (to test account)

### Manual Tests
- `/add-site` with various site types
- `/test-digest` to preview formatting
- Full workflow end-to-end

## Security Considerations

### Web Scraping
- Respect robots.txt
- Use delays between requests (2+ seconds)
- Identify with proper User-Agent
- Don't overload servers

### Credentials
- Email password in .env (never committed)
- Consider encrypting .env at rest
- Use app-specific passwords (Gmail, etc.)

### Database
- SQLite file permissions: 600 (owner only)
- No SQL injection (use parameterized queries)

## Performance Optimizations

### Database Indexes
- Index on events.event_hash (unique lookups)
- Index on events.event_date (date range queries)
- Index on interests.value (matching)

### Caching
- Cache successful fetches for 1 hour
- If source check within cache window, use cached data

### Parallel Fetching
- Fetch sources in parallel (with concurrency limit: 5)
- Reduces total discovery time

## Deployment

### Local Deployment
```bash
npm run build
cd build
# Add to crontab or keep terminal open with:
node scheduler.js  # Runs continuously with node-cron
```

### Server Deployment
- Deploy to Linux VPS/server
- Use systemd to run as service
- Logs to /var/log/eventfinder/
- Database at /var/lib/eventfinder/

### Docker (Optional)
```dockerfile
FROM node:18
WORKDIR /app
COPY build/ ./
RUN npm install --production
CMD ["node", "scheduler.js"]
```

## Monitoring

### Logs
- Daily summary: sources checked, events found, digest sent
- Errors logged with stack traces
- Keep last 30 days of logs

### Health Checks
- Daily self-test: can connect to DB, can send email
- Alert if digest fails 2 days in a row

### Metrics
- Events found per day
- Sources checked vs failed
- Average interest score
- Email delivery rate
