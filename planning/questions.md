# EventFinder: Open Questions & Decisions

## Critical Decisions Needed

### Q1: How does the LLM script actually run daily? ✅ DECIDED

**Context**: Claude Code is typically interactive. We need automated daily execution.

**Options:**
1. **node-cron within the script** - Script stays running, cron triggers internally
   - ✅ Pros: Self-contained, cross-platform
   - ❌ Cons: Process must stay running, needs process manager

2. **System cron + headless Claude Code** - Cron calls `claude-code` with automation flags
   - ✅ Pros: Uses system scheduler, well-understood
   - ❌ Cons: Not sure if Claude Code supports headless/scripted mode

3. **Separate Node.js scheduler** - Build separate runner that invokes LLM via API (Claude API)
   - ✅ Pros: Full control, true automation
   - ❌ Cons: Requires Claude API access, different from interactive mode

4. **Manual trigger** - User runs `/discover-events` daily (or when they want)
   - ✅ Pros: Simple, no automation needed, works on Android/Termux
   - ❌ Cons: Not fully automated

**Decision**: **Phased approach**
- **Phase 1-3 (V1)**: Manual trigger via `/discover-events` command
- **Phase 4+**: Research automation options:
  1. Claude Code headless mode (Option 2) - preferred if available
  2. Claude API integration (Option 3) - if headless unavailable
  3. Android automation (Tasker/Termux) to trigger manually on schedule

**Rationale**:
- Manual works well for MVP and Android/Termux environment
- Process can be killed frequently on Android, so long-running cron not ideal
- Allows testing full workflow before adding automation complexity
- Eventually: System cron + headless Claude Code is the goal

**Actions**:
- ✅ Phase 1-3: Build manual `/discover-events` command
- ⏳ Phase 4: Research automation (headless Claude Code, API, Android automation)
- ⏳ Phase 5+: Implement chosen automation approach

---

### Q2: Should we use MCP servers for web fetching, or native Node.js? ✅ DECIDED

**Context**: Web fetching is core functionality (RSS parsing, HTML scraping).

**Options:**
1. **Native Node.js libraries** (axios, cheerio, rss-parser)
   - ✅ Pros: Direct control, fast, well-documented
   - ❌ Cons: Requires bundling with build, not pure LLM script

2. **MCP server for web operations** (like @modelcontextprotocol/server-fetch, Playwright MCP)
   - ✅ Pros: Keeps script "pure", leverages MCP ecosystem, handles JavaScript-rendered sites
   - ❌ Cons: Dependency on external MCP server

3. **Hybrid** - Use Claude Code's built-in WebFetch + MCP servers when needed
   - ✅ Pros: Balance of simplicity and power, flexible
   - ❌ Cons: Multiple approaches

**Decision**: **Hybrid approach (Option 3)**
- **Claude Code's WebFetch tool** for simple RSS/HTML fetching
- **Playwright MCP server** for JavaScript-heavy sites (React, etc.)
- **Node.js helper scripts** only for complex parsing/transformation

**Rationale**:
- Claude is excellent at using built-in web tools
- Microsoft's Playwright MCP can handle modern React-based event sites
- Keeps LLM as orchestrator rather than just calling scripts
- More flexible for different site types

**Implementation**:
- Phase 1: WebFetch for RSS feeds
- Phase 3: Add Playwright MCP for scraping JavaScript-rendered sites
- Node.js scripts only for data transformation (RSS parsing, hash generation)

**Actions**:
- ✅ Use Claude Code WebFetch tool for basic fetching
- ⏳ Configure Playwright MCP server in Phase 3
- ⏳ Create guide: `setup/src/guides/playwright-mcp.md`

---

### Q3: How does the LLM interact with SQLite? ✅ DECIDED

**Context**: Need to read/write database for sources, interests, events.

**Options:**
1. **Node.js script called via Bash** - LLM runs `node db-query.js SELECT ...`
   - ✅ Pros: Full SQL capabilities
   - ❌ Cons: Lots of shell-out overhead

2. **MCP server for SQLite** (like @modelcontextprotocol/server-sqlite)
   - ✅ Pros: Native MCP integration, tools for queries, clean interface
   - ❌ Cons: Requires MCP server setup

3. **JSON files + Node.js script** - Store data in JSON, use Node.js for querying
   - ✅ Pros: Simple, file-based
   - ❌ Cons: No relational queries, poor performance at scale

**Decision**: **Hybrid - Node.js setup + MCP runtime (Option 2)**
- **Node.js scripts** for schema initialization and migrations
- **SQLite MCP server** for all runtime LLM database operations

**Rationale**:
- Schema management better in version-controlled SQL/scripts
- LLM shouldn't handle DDL (CREATE TABLE), only DML (INSERT/SELECT/UPDATE)
- MCP provides clean, tool-based interface for queries
- Separation: Infrastructure (Node.js) vs Operations (LLM via MCP)

**Implementation**:
```
Setup (once):
  node scripts/init-db.js → Creates tables, indexes

Runtime (LLM):
  SQLite MCP tools → INSERT, SELECT, UPDATE, DELETE
```

**Actions**:
- ✅ Create `scripts/init-db.js` - Database initialization
- ✅ Create `data/schema.sql` - Table definitions
- ✅ Configure SQLite MCP server in `.mcp.json`
- ✅ LLM uses MCP tools for all queries

---

### Q4: Where does the event parsing/extraction happen? ✅ DECIDED

**Context**: Extracting structured event data from messy HTML is complex.

**Options:**
1. **LLM does all parsing** - Pass HTML to LLM, ask for JSON
   - ✅ Pros: Flexible, handles edge cases
   - ❌ Cons: Slow, expensive (tokens), inconsistent

2. **Deterministic scraper + LLM fallback** - Use selectors when possible, LLM for ambiguous cases
   - ✅ Pros: Fast for structured content, flexible for unstructured
   - ❌ Cons: More complex logic

3. **Pre-configured scrapers per source** - User/LLM defines selectors per site
   - ✅ Pros: Fast, predictable
   - ❌ Cons: Breaks when site changes, requires maintenance

**Decision**: **MCP-first approach (blend of Options 1 & 2)**
- **MCP servers convert to markdown** - Playwright MCP, WebFetch, etc. handle HTML→markdown
- **LLM extracts from markdown** - Cleaner, structured, no image data tags
- **Custom MCPs for special cases** - Build MCP servers for specific site patterns if needed

**Rationale**:
- MCP servers are good at HTML→markdown conversion
- Markdown is cleaner for LLM parsing (no bloat, no image data URLs)
- Token-efficient: markdown is much smaller than raw HTML
- Flexible: can build custom MCP servers for complex sites
- No need for selector configs - LLM extracts from clean markdown

**Implementation**:
```
1. MCP fetches page → converts to markdown (strips images, scripts, etc.)
2. LLM receives clean markdown
3. LLM extracts structured event data → JSON
4. Store in SQLite via MCP
```

**Actions**:
- ✅ Use Playwright MCP with markdown conversion
- ✅ Create prompt template: `src/templates/extract-events-from-markdown.md`
- ⏳ Build custom MCPs for frequently-scraped sites (if needed)
- ✅ Ensure MCP strips image data tags to save tokens

---

### Q5: How granular should interest matching be? ✅ DECIDED

**Context**: Deciding which events to include in digest.

**Options:**
1. **Simple keyword matching** - Just check if artist/venue/keyword appears
   - ✅ Pros: Fast, predictable
   - ❌ Cons: Lots of false positives (e.g., "The National" band vs "National Day")

2. **Scored matching with threshold** - Score based on multiple factors, include if above threshold
   - ✅ Pros: Tunable, reduces noise
   - ❌ Cons: Requires calibration, may miss edge cases

3. **LLM-based relevance** - Ask LLM "Is this event relevant to user interests?"
   - ✅ Pros: Most accurate, handles nuance, learns over time
   - ❌ Cons: More tokens per event

**Decision**: **LLM-based relevance matching (Option 3)** with learning system

**Rationale**:
- LLM can understand context ("The National" = band, not holiday)
- Natural language preferences more intuitive than keyword lists
- Enables feedback loop for continuous improvement
- Tokens are acceptable cost for quality

**Implementation**:

**Phase 1-2 (Single User)**:
- User preferences stored in markdown file: `data/user-preferences.md`
- Format: Natural language description of interests
- Example:
  ```markdown
  I love indie rock and folk music, especially bands like Fleet Foxes,
  The National, Bon Iver. I'm interested in intimate venue shows at
  The Fillmore and smaller clubs. Not interested in huge festivals or
  stadium shows.
  ```
- LLM reads preferences + event → decides relevance

**Phase 6+ (Multi-User with Learning)**:
- Move to SQLite: `users` table with `preferences_summary` field
- Track user actions:
  - Added event to calendar → positive signal
  - Added ticket reminder → strong positive signal
  - Marked as attended → very strong positive
  - Rated/liked event → explicit feedback
- LLM periodically analyzes feedback → updates preference summary
- Self-improving recommendation system

**Actions**:
- ✅ Phase 1: Create `data/user-preferences.md`
- ✅ Create template: `src/templates/match-event-to-preferences.md`
- ⏳ Phase 6: Add feedback tracking and learning system

---

### Q6: Email formatting - HTML vs plain text? ✅ DECIDED

**Context**: Digest emails need to be readable and include iCal attachments.

**Options:**
1. **HTML only** - Rich formatting, images, buttons
   - ✅ Pros: Beautiful, modern
   - ❌ Cons: Some email clients strip HTML

2. **Plain text only** - Simple, universally compatible
   - ✅ Pros: Works everywhere
   - ❌ Cons: Ugly, limited formatting

3. **Multipart (HTML + plain text fallback)** - Best of both
   - ✅ Pros: Compatible and pretty
   - ❌ Cons: Minimal extra code

**Decision**: **Multipart emails (Option 3)**

**Rationale**:
- Nodemailer supports multipart easily
- HTML looks great in modern clients
- Plain text ensures universal compatibility
- No significant downsides

**Actions**:
- ✅ Create HTML template: `src/templates/email-digest.html`
- ✅ Create plain text template: `src/templates/email-digest.txt`
- ✅ Configure Nodemailer with multipart support

---

### Q7: What happens when an event's details change? ✅ DECIDED

**Context**: Event date/time might be updated after first discovery.

**Scenarios:**
- Event date changes
- Venue changes
- Event cancelled
- Tickets go on sale earlier/later

**Options:**
1. **Ignore updates** - Once sent, never re-send
   - ✅ Pros: Simple
   - ❌ Cons: User misses important changes

2. **Re-send on significant changes** - If date/venue changes, send update email
   - ✅ Pros: User stays informed
   - ❌ Cons: Need to define "significant", risk of spam

3. **Track changes in DB** - Store event history, show changes in digest
   - ✅ Pros: Full audit trail
   - ❌ Cons: Complex

**Decision**: **Combination of Options 2 & 3 (defer to Phase 4)**

**MVP (Phase 1-3)**:
- Send once, no update detection
- Keep it simple

**Future (Phase 4+)**:
- Track event changes in database (history table)
- Re-send digest when significant changes detected:
  - Date/time changed
  - Venue changed
  - Event cancelled
  - Ticket sale date changed
- Email subject: "⚠️ UPDATE: [Event Name] - [Change Description]"
- Store change history for audit trail

**Rationale**:
- MVP doesn't need this complexity
- Change detection is valuable but not critical for initial use
- Tracking history enables future features (analytics, reliability scoring)

**Actions**:
- ✅ Phase 1-3: Simple send-once model
- ⏳ Phase 4: Add `event_history` table
- ⏳ Phase 4: Implement change detection logic
- ⏳ Phase 4: Create update email template

---

### Q8: How do we handle timezones? ✅ DECIDED

**Context**: Events may be in different timezones than user.

**Options:**
1. **Assume all events are in user's timezone**
   - ✅ Pros: Simple
   - ❌ Cons: Wrong for events in other cities

2. **Detect timezone from venue/city**
   - ✅ Pros: Accurate
   - ❌ Cons: Requires timezone database

3. **Store timezone with event, convert for display**
   - ✅ Pros: Most accurate
   - ❌ Cons: Requires timezone library

**Decision**: **Option 3 with user location context**

**Implementation**:
- User specifies location/timezone in `data/user-preferences.md`:
  ```markdown
  ## Location
  I'm based in San Francisco, California (America/Los_Angeles timezone).
  I travel occasionally but most events I attend are local.
  ```

- Events store their timezone (detected from venue/city or page metadata)
- Display times in event's local timezone by default
- LLM can convert to user's timezone when relevant
- iCal attachments include proper timezone info (clients handle conversion)

**Rationale**:
- User location is part of preference context
- LLM can intelligently decide when to mention timezone differences
- iCal handles timezone conversion automatically
- Future: Could detect user's current timezone from device

**Actions**:
- ✅ Add timezone field to events table (IANA format)
- ✅ Include location/timezone in user-preferences.md template
- ✅ LLM extracts timezone from event pages when available
- ✅ Display times with timezone abbreviation (e.g., "8:00 PM PST")
- ⏳ Phase 4+: Add timezone conversion preferences

---

### Q9: Should we integrate with public event APIs or just scrape? ✅ DECIDED

**Context**: Ticketmaster, Eventbrite, Bandsintown have APIs.

**Options:**
1. **APIs only** - Official data, reliable
   - ✅ Pros: Clean, structured, legal
   - ❌ Cons: Requires API keys, limited to big platforms

2. **Scraping only** - Works for any site
   - ✅ Pros: Universal
   - ❌ Cons: Legally gray, fragile

3. **Both** - APIs where available, scraping for small venues
   - ✅ Pros: Best coverage
   - ❌ Cons: Complex

**Decision**: **Start with RSS + Playwright, add API MCPs only as needed**

**Rationale**:
- RSS feeds are universally supported, easy to parse
- Playwright MCP handles modern JavaScript sites
- These two cover 90%+ of use cases
- API MCPs add complexity/dependencies
- Only add API MCPs when RSS/scraping fails for important sources

**Phased Approach**:

**Phase 1 (MVP)**:
- RSS feeds via WebFetch or Playwright MCP
- Simple, works for most venues

**Phase 2-3**:
- Playwright MCP for JavaScript-heavy sites
- Handles React-based event platforms

**Phase 4+ (only if needed)**:
- Ticketmaster API MCP (if user needs major venue data that lacks RSS)
- Eventbrite API MCP (if needed)
- Custom MCPs for specific challenging sites

**Actions**:
- ✅ Phase 1: Implement RSS feed support
- ✅ Phase 2-3: Configure Playwright MCP
- ⏳ Future: Add API MCPs only when RSS/Playwright insufficient
- ✅ Keep API setup guides for future use

---

### Q10: What's the MVP (Minimum Viable Product)? ✅ DECIDED

**Context**: Need to scope V1 to ship quickly.

**Decision**: **Manual workflow with Playwright MCP for website scraping**

### Must Have for MVP (Phase 1-3):

**Core Functionality:**
- ✅ User preferences in markdown: `data/user-preferences.md`
  - Natural language description of interests
  - Location/timezone
- ✅ Add website URLs manually (stored in `data/sources.json` or similar)
  - No `/add-site` wizard yet, just edit the list
- ✅ Playwright MCP to fetch and convert websites to markdown
  - RSS is just a special case - same tool handles both
- ✅ `/discover-events` - Manual trigger to fetch and process all sources
- ✅ LLM extracts events from markdown
- ✅ LLM-based relevance matching (preferences + event → decision)
- ✅ Store events in SQLite (via MCP)
- ✅ Detect duplicates (don't re-send)
- ✅ Generate email digest (multipart HTML + text)
- ✅ Send with 2 iCal attachments per event:
  - Ticket sale reminder
  - Event date
- ✅ SMTP email sending (Gmail or similar)

**Explicitly NOT in MVP (defer to later):**
- ❌ Automated scheduling (Phase 5)
- ❌ `/add-site` wizard (Phase 3)
- ❌ `/add-interest` command (Phase 1 - just edit preferences.md)
- ❌ Update detection (Phase 4)
- ❌ Feedback loop / learning (Phase 6+)
- ❌ API integrations (only if needed later)
- ❌ Multi-user support (Phase 6+)
- ❌ Web UI (future)

### MVP User Flow:

1. Edit `data/user-preferences.md` - describe interests
2. Edit `data/sources.json` - list website URLs
3. Run `/discover-events`
4. Receive email with matched events + calendar invites
5. Repeat daily (manually)

**Rationale**:
- Website scraping is the general case (RSS is just structured HTML)
- Playwright MCP handles both regular sites and RSS feeds
- No need to distinguish between them
- Focus on core value: discover → match → notify
- Automation comes after workflow is proven

**Actions**:
- ✅ Update workplan.md to reflect this scope
- ✅ Remove RSS-specific phases
- ✅ Focus Phase 1 on Playwright MCP + website scraping

---

## Technical Uncertainties

### T1: Can Claude Code execute long-running processes?
- Need to test if node-cron can run within a Claude Code session
- Alternative: Separate scheduler that calls Claude Code

### T2: Token limits for large HTML pages
- What if venue page has 100+ events?
- May need to chunk or pre-process before passing to LLM

### T3: Rate limiting for scraping
- How to respect robots.txt?
- Need configurable delays between requests

### T4: Email deliverability
- Will Gmail/Outlook accept automated emails?
- May need SPF/DKIM records, or use SendGrid

### T5: SQLite MCP server performance
- Can it handle 1000s of events?
- Need to test query performance

---

## User Experience Questions

### UX1: What if no events match interests?
- Send "No new events" email, or skip email entirely?
- **Recommendation**: Skip email if zero events (reduces inbox noise)

### UX2: How to handle overwhelming number of matches?
- What if 50 events match?
- **Recommendation**: Include top 20 in email, provide link to "View all" (future: web interface)

### UX3: Should digest emails be grouped by date or by source?
- Group by: "This Weekend", "Next Week", etc.
- Or group by: "The Fillmore Events", "Bandsintown Events"
- **Recommendation**: Group by date (more useful for planning)

### UX4: How do users provide feedback?
- "This event doesn't match my interests" → Update scoring?
- **Recommendation**: V1 has no feedback loop, adjust interests manually

### UX5: What about events the user already knows about?
- If they manually added to calendar, still include in digest?
- **Recommendation**: No way to detect this in V1, acceptable duplicate

---

## Integration Questions

### I1: Can we integrate with Spotify for artist discovery?
- Use Spotify API to find artists user follows
- **Recommendation**: Defer to V2+, requires OAuth

### I2: Can we check Google Calendar to avoid duplicates?
- Query user's calendar before sending
- **Recommendation**: Defer to V2+, complex OAuth flow

### I3: Should we support multiple email recipients?
- Family/friends get same digest
- **Recommendation**: Defer to V2, V1 is single-user

---

## Open Research Topics

### R1: Best practices for ethical web scraping
- Review robots.txt standards
- Respect rate limits
- User-agent identification

### R2: iCal attachment compatibility testing
- Test on: Gmail, Outlook, Apple Mail, Yahoo
- Ensure "Add to Calendar" button appears

### R3: Natural language date parsing libraries
- How to parse "Next Friday 8pm" → ISO datetime
- Libraries: chrono-node, date-fns

### R4: Event deduplication across sources
- Same event listed on multiple sites
- Fuzzy matching on title + date + venue

---

### Q11: How should we send emails? ✅ DECIDED

**Context**: Need to send digest emails, but can't risk Gmail ban.

**Options:**
1. **Direct SMTP (Gmail, Outlook, etc.)** - Use personal email account
   - ✅ Pros: Free, simple setup, works with existing account
   - ❌ Cons: Ban risk for automation, especially Gmail

2. **Transactional email service (SendGrid, Mailgun, Brevo)** - Dedicated service
   - ✅ Pros: Built for automation, no ban risk, free tiers, great deliverability
   - ❌ Cons: Requires signup

3. **Fastmail** - Privacy-focused email provider
   - ✅ Pros: Automation-friendly, app passwords, reliable
   - ❌ Cons: Paid ($3/month minimum)

4. **Self-hosted SMTP server** - Run your own mail server
   - ✅ Pros: Full control
   - ❌ Cons: Complex, poor deliverability

**Decision**: **SendGrid Free Tier (Option 2)** for MVP, with Fastmail as backup

**Rationale**:
- User has Gmail (primary account) - too risky to use for automation
- Getting banned from Google = catastrophic (Gmail, Drive, Photos, Android, etc.)
- SendGrid Free Tier: 100 emails/day - perfect for single-user daily digest
- Built for automation, zero ban risk
- Can still receive at Gmail, just send from SendGrid
- Easy migration to Fastmail if SendGrid becomes limiting

**Implementation**:
- **Phase 1**: SendGrid free tier
  - Send digest FROM: `eventfinder@sendgrid.net` (or verified domain)
  - Send TO: `your-gmail@gmail.com`
  - You receive in Gmail inbox (safe)
  - iCal attachments work perfectly
- **Future**: If 100 emails/day insufficient, upgrade to Fastmail ($3/month)

**Actions**:
- ✅ Add SendGrid to setup assistant
- ✅ Create guide: `setup/src/guides/sendgrid-smtp.md`
- ✅ Configure Nodemailer with SendGrid SMTP
- ✅ Keep Fastmail as documented alternative

---

## Decisions Log

### ✅ D1: Use SQLite for storage
**Decision**: SQLite with better-sqlite3 npm package
**Rationale**: Portable, fast, no server needed
**Date**: Current

### ✅ D2: Use Nodemailer for email
**Decision**: Nodemailer with SMTP
**Rationale**: Most flexible, works with any provider
**Date**: Current

### ✅ D3: Use ical-generator for calendar invites
**Decision**: ical-generator npm package
**Rationale**: Well-maintained, simple API
**Date**: Current

### ⏳ D4: Scheduling approach (pending)
**Options**: Manual vs automated
**Status**: Start with manual (`/run-now`), automate later

### ⏳ D5: Scraping vs APIs (pending)
**Options**: Start with RSS/scraping, add APIs via MCP later
**Status**: Need to test feasibility

---

## Questions for User

1. **Preferred email time?** - What time should digest arrive? (Default: 9am)

2. **How many events is too many?** - Cap digest at 10, 20, 50 events?

3. **Frequency?** - Daily digest, or weekly roundup?

4. **Ticket sale reminders?** - Always create "tickets on sale" calendar event, even if date unknown?

5. **Scope of sources?** - Start with a specific city/region, or allow any geography?

6. **MVP features?** - Is manual trigger acceptable for V1, or must it be automated?

7. **Scraping ethics?** - Okay to scrape small venue websites, or APIs only?

8. **Error handling?** - How to notify user of failures? (Email, log file, silent?)

9. **Data retention?** - Keep all historical events, or purge old ones?

10. **Open source?** - Will this be shared publicly, or private tool?
