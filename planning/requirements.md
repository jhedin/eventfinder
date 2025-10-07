# EventFinder: Requirements

## Functional Requirements

### FR1: Source Management

#### FR1.1: Add Event Sources
**As a user, I want to add event sources so that EventFinder monitors them for new events.**

**Acceptance Criteria:**
- User can run `/add-site <url>` slash command
- System automatically detects if source has RSS/Atom feed
- If no feed detected, system determines appropriate scraping strategy
- Source configuration is saved persistently
- User is prompted for required metadata (name, category, etc.)

**Examples:**
- `/add-site https://www.fillmore.com/events` → Detects calendar page, sets up scraper
- `/add-site https://venue.com/rss` → Detects RSS feed, uses feed parser

#### FR1.2: List Event Sources
**As a user, I want to view all configured sources.**

**Acceptance Criteria:**
- Command to list all sources with their status
- Shows: name, URL, type (RSS/scraper), last checked, events found
- Can filter by active/inactive

#### FR1.3: Remove Event Sources
**As a user, I want to remove sources I'm no longer interested in.**

**Acceptance Criteria:**
- Command to remove a source by ID or URL
- Confirmation prompt before deletion
- Option to keep historical events from that source

#### FR1.4: Test Event Sources
**As a user, I want to test if a source is working correctly.**

**Acceptance Criteria:**
- Command to manually fetch from a source
- Shows events found (without saving to DB)
- Indicates any errors or issues

### FR2: Interest Management

#### FR2.1: Add Interests
**As a user, I want to define my interests so events are filtered to match them.**

**Acceptance Criteria:**
- User can run `/add-interest` slash command with interactive prompts
- Supports multiple interest types:
  - **Artists/Performers**: Band names, comedians, speakers
  - **Venues**: Specific venues to always track
  - **Genres/Categories**: Music genres, event types
  - **Keywords**: Flexible text matching
  - **Date ranges**: Min/max days in future
- Interests are saved persistently

**Examples:**
- `/add-interest` → Prompts: Type? Keyword? Priority (high/medium/low)?
- Add "The National" as high-priority artist
- Add "comedy" as medium-priority genre
- Add "The Fillmore" as high-priority venue

#### FR2.2: List Interests
**As a user, I want to view all my configured interests.**

**Acceptance Criteria:**
- Shows all interests grouped by type
- Indicates priority level
- Shows how many events matched each interest recently

#### FR2.3: Remove Interests
**As a user, I want to remove interests I'm no longer interested in.**

**Acceptance Criteria:**
- Command to remove interest by ID or keyword
- Confirmation prompt

### FR3: Event Discovery

#### FR3.1: Scheduled Event Checks
**As a system, I need to check all sources for new events daily.**

**Acceptance Criteria:**
- Runs automatically once per day (configurable time)
- For each active source:
  - Fetches content (RSS or scrapes HTML)
  - Parses for event data (title, date, venue, URL)
  - Uses LLM to extract structured data from unstructured content
  - Handles errors gracefully (logs, continues to next source)
- Respects rate limits (delays between requests)
- Logs all activity

#### FR3.2: Event Parsing
**As a system, I need to extract event details from various formats.**

**Acceptance Criteria:**
- Extracts minimum fields: title, date, URL
- Extracts optional fields: venue, time, description, image, ticket URL
- Handles various date formats (natural language, ISO, etc.)
- Detects timezone or assumes local
- Uses LLM for ambiguous/unstructured content

**Examples:**
- "Friday, March 15 at 8pm" → Parse relative to current date
- "3/15/2025 20:00 PST" → Parse absolute date with timezone
- "Next Friday" → Resolve to actual date

#### FR3.3: Interest Matching
**As a system, I need to filter events to match user interests.**

**Acceptance Criteria:**
- Each event is scored based on interest matches:
  - Artist match: +100 points
  - Venue match: +80 points
  - Genre/category match: +50 points
  - Keyword match: +30 points
  - High priority multiplier: 2x
  - Medium priority: 1x
  - Low priority: 0.5x
- Events above threshold (e.g., 50 points) are included
- Events below threshold are discarded
- Scoring algorithm is configurable

#### FR3.4: Duplicate Detection
**As a system, I need to avoid sending the same event multiple times.**

**Acceptance Criteria:**
- Each event gets a unique identifier (hash of title + date + venue)
- Before adding to digest, check if already sent
- Track: first_seen_date, last_seen_date, sent_in_digest_date
- If event details change (date/time update), may re-send with note

### FR4: Email Digest

#### FR4.1: Generate Daily Digest
**As a user, I want to receive a daily email with new events.**

**Acceptance Criteria:**
- Email is sent once per day (configurable time, after event check)
- Subject: "EventFinder Daily Digest - [Date] - [N] new events"
- Body includes:
  - Summary of new events found
  - For each event:
    - Event name
    - Artist/performer
    - Date and time
    - Venue
    - Description excerpt
    - Link to event page
    - Link to tickets (if available)
  - Clean HTML formatting
- If no new events: "No new events today matching your interests"

#### FR4.2: iCal Attachments
**As a user, I want calendar invites attached so I can add events with one click.**

**Acceptance Criteria:**
- Each event includes 2 iCal (.ics) attachments:
  - **Attachment 1**: "Tickets on sale" reminder
    - Title: "🎫 Tickets on sale: [Event Name]"
    - Date: Ticket sale date/time (if known) OR 1 week before event
    - Description: Link to ticket purchase page
    - Reminder: 1 day before, 1 hour before
  - **Attachment 2**: "Event" calendar entry
    - Title: "[Artist] at [Venue]"
    - Date: Event date/time
    - Location: Venue name and address
    - Description: Full event details + links
    - Reminder: 1 day before, 3 hours before
- Attachments are properly formatted as VEVENT with METHOD:REQUEST
- Compatible with Gmail, Outlook, Apple Calendar, Google Calendar

#### FR4.3: Email Configuration
**As a user, I want to configure email settings.**

**Acceptance Criteria:**
- Configure via `.env`:
  - SMTP host, port, username, password
  - From address
  - To address
  - Digest time (default: 9am local)
- Supports common providers: Gmail, Outlook, SendGrid, etc.
- Test command to send test email

### FR5: Manual Operations

#### FR5.1: Run Event Check Manually
**As a user, I want to trigger event discovery without waiting for scheduled run.**

**Acceptance Criteria:**
- `/run-now` command
- Runs full event discovery workflow
- Shows progress and results
- Does not send digest (unless requested)

#### FR5.2: Preview Digest
**As a user, I want to see what would be included in today's digest.**

**Acceptance Criteria:**
- `/test-digest` command
- Shows events that would be included
- Does not mark events as sent
- Optionally sends test email to verify formatting

#### FR5.3: View Event History
**As a user, I want to see events discovered in the past.**

**Acceptance Criteria:**
- Command to query event database
- Filter by: date range, source, interest matched, sent status
- Shows: event details, when first seen, whether sent

### FR6: Data Management

#### FR6.1: Database Initialization
**As a system, I need to create and maintain an SQLite database.**

**Acceptance Criteria:**
- On first run, creates database with schema
- Tables: sources, interests, events, sent_digests
- Automatic schema migrations on version updates

#### FR6.2: Data Export
**As a user, I want to export my configuration and data.**

**Acceptance Criteria:**
- Command to export sources to JSON
- Command to export interests to JSON
- Command to export event history to CSV
- Useful for backup or migration

#### FR6.3: Data Import
**As a user, I want to import configuration from a backup.**

**Acceptance Criteria:**
- Command to import sources from JSON
- Command to import interests from JSON
- Validates data before importing

## Non-Functional Requirements

### NFR1: Performance
- Event check completes within 5 minutes for 50 sources
- Database queries return within 100ms
- Email digest sends within 10 seconds

### NFR2: Reliability
- Handles individual source failures gracefully (logs error, continues)
- Retries failed requests up to 3 times with exponential backoff
- Database transactions ensure data consistency
- Logs all errors with timestamps and context

### NFR3: Usability
- Setup completes in under 10 minutes for new user
- Slash commands have clear help text
- Error messages are actionable
- Guided setup assistant helps with initial configuration

### NFR4: Privacy
- All data stored locally (SQLite database)
- Email credentials encrypted at rest (if possible)
- No data sent to third parties (except configured email provider)
- User controls all data

### NFR5: Maintainability
- Code is modular and well-documented
- Configuration is separate from code
- Scraping logic is isolated per source (easy to fix when sites change)
- LLM prompts are in markdown files (easy to iterate)

### NFR6: Compatibility
- Works on macOS, Linux, Windows (via WSL)
- Requires Node.js 18+
- Requires Claude Code
- Compatible with common email providers

### NFR7: Extensibility
- Easy to add new event sources
- Easy to add new notification channels (beyond email)
- MCP servers can extend functionality
- Plugin architecture for custom scrapers

## User Stories

### US1: Music Fan
**Sarah wants to attend concerts by her favorite indie bands in Seattle.**

1. Runs `/add-site https://neumos.com/events`
2. Runs `/add-interest` → adds "indie rock", "Fleet Foxes", "The Crocodile"
3. Waits for daily digest
4. Receives email: "Fleet Foxes announced at Neumos, Oct 15"
5. Clicks iCal attachment, event added to calendar
6. Receives reminder 1 week before tickets go on sale
7. Buys tickets on sale day
8. Attends concert

### US2: Comedy Enthusiast
**Mark follows 3 comedy clubs and wants to see specific comedians.**

1. Runs `/add-site` for: Cobb's Comedy Club, Punch Line SF, The Masonic
2. Runs `/add-interest` for: "John Mulaney", "Ali Wong", "stand-up"
3. Receives digest: "John Mulaney, Cobb's, Dec 5"
4. Adds to calendar via iCal
5. Gets reminder when tickets go on sale
6. Purchases tickets

### US3: Conference Goer
**Jessica attends tech conferences but they're announced on various sites.**

1. Runs `/add-site` for: React Conf RSS, JSConf site, HN events
2. Runs `/add-interest` for: "React", "JavaScript", "web development"
3. Receives digest: "React Summit 2025, Amsterdam, May 15-16"
4. Adds to calendar
5. Books flights and hotel
6. Submits CFP before deadline

## Out of Scope (V1)

- Mobile app
- Social features (sharing with friends)
- Ticket purchasing within app
- Price tracking
- Event recommendations beyond keyword matching
- Natural language queries ("Show me concerts this weekend")
- Multi-user/family accounts
- Integration with Spotify/Apple Music for artist discovery
- Automatic detection when tickets sell out
- Waitlist monitoring
