# EventFinder: Implementation Work Plan

## Phased Development Approach

This workplan breaks EventFinder development into 4 phases, each building on the previous with working end-to-end functionality.

---

## Phase 0: Foundation & Setup ✅ (COMPLETE)

**Goal**: Project scaffolding and development environment

**Completed:**
- ✅ Project structure (src/, setup/, scripts/)
- ✅ Build system (npm run build)
- ✅ Setup assistant LLM script
- ✅ Configuration templates (.env.template, .gitignore)
- ✅ Documentation (README, CLAUDE.md, WORKFLOW.md)
- ✅ Planning documents (this file!)

**Status**: Ready for implementation

---

## Phase 1: Manual Event Discovery (MVP)

**Goal**: Core functionality with manual trigger - user can discover and view events

**Duration**: 1-2 weeks

### 1.1: Database Setup

**Tasks:**
- Create SQLite schema (sources, interests, events, sent_digests)
- Set up SQLite MCP server integration
- Test MCP server: create tables, insert, query
- Create database initialization script

**Deliverables:**
- `data/schema.sql` - Database schema
- `data/eventfinder.db` - Empty database (gitignored)
- `.mcp.json` - Configured SQLite MCP server
- Guide in `setup/src/guides/sqlite-mcp.md`

**Acceptance:**
- [ ] Database creates successfully on first run
- [ ] Can insert and query via MCP tools
- [ ] Tables have correct indexes

### 1.2: Interest Management

**Tasks:**
- Update `src/script.md` with interest management logic
- Create `/add-interest` command
- Create `/list-interests` command
- Create `/remove-interest` command
- Store interests in database
- Sync to `data/interests.json` (for backup)

**Deliverables:**
- `src/commands/add-interest.md`
- `src/commands/list-interests.md`
- `src/commands/remove-interest.md`
- Updated `src/context.md` with interest types

**Acceptance:**
- [ ] Can add artist, venue, genre, keyword interests
- [ ] Can set priority (high/medium/low)
- [ ] Can list all interests grouped by type
- [ ] Can remove interests
- [ ] Data persists in DB

### 1.3: Source Management (RSS Only)

**Tasks:**
- Create `/add-source-rss` command (simplified: RSS feeds only for V1)
- Implement RSS feed validation (check if URL returns valid feed)
- Store source in database
- Create `/list-sources` command
- Create `/remove-source` command

**Deliverables:**
- `src/commands/add-source-rss.md`
- `src/commands/list-sources.md`
- `src/commands/remove-source.md`

**Acceptance:**
- [ ] Can add RSS feed URL
- [ ] Validates feed is parseable
- [ ] Stores source metadata (name, URL, category)
- [ ] Can list and remove sources
- [ ] Data persists in DB

### 1.4: Event Discovery (Manual Trigger)

**Tasks:**
- Create `/discover-events` command
- For each RSS source:
  - Fetch feed using WebFetch or curl via Bash
  - Parse feed (use Node.js rss-parser via script)
  - Extract event data (title, date, link, description)
  - Generate event hash (SHA256 of key fields)
  - Check if event exists in DB
  - If new: insert with first_seen_at
  - If exists: update last_seen_at
- Display summary: "Found X new events from Y sources"

**Deliverables:**
- `src/commands/discover-events.md`
- Node.js helper script: `scripts/parse-rss.js`
- Node.js helper script: `scripts/generate-hash.js`

**Acceptance:**
- [ ] Can fetch and parse RSS feeds
- [ ] Extracts event data fields
- [ ] Detects duplicate events (doesn't re-add)
- [ ] Stores events in database
- [ ] Shows summary of discovered events

### 1.5: Interest Matching

**Tasks:**
- Implement scoring algorithm (see technical-design.md)
- For each new event, calculate interest match score
- Store score and matched_interests in DB
- Create `/preview-matches` command to show scored events

**Deliverables:**
- Node.js helper: `scripts/score-event.js`
- `src/commands/preview-matches.md`

**Acceptance:**
- [ ] Events are scored based on artist, venue, genre, keyword matches
- [ ] Priority multiplier works (high=2x, medium=1x, low=0.5x)
- [ ] Can view events above threshold
- [ ] Can view events with scores

**Phase 1 Milestone**: User can add interests, add RSS feeds, discover events, and see which events match their interests.

---

## Phase 2: Email Digest

**Goal**: Generate and send email digests with calendar invites

**Duration**: 1 week

### 2.1: iCal Generation

**Tasks:**
- Install ical-generator npm package
- Create helper: `scripts/generate-ical.js`
- Implement ticket sale reminder iCal
- Implement event date iCal
- Test calendar compatibility (Gmail, Outlook, Apple Calendar)

**Deliverables:**
- `scripts/generate-ical.js`
- Test iCal files in `test/fixtures/`

**Acceptance:**
- [ ] Generates valid .ics files
- [ ] Ticket reminder includes sale date/time
- [ ] Event calendar includes event date/time
- [ ] Both include proper alarms/reminders
- [ ] Compatible with major calendar apps

### 2.2: Email Template

**Tasks:**
- Design HTML email template
- Create plain text fallback template
- Implement template rendering (Handlebars or template literals)
- Include: event cards, metadata, links, matched interests

**Deliverables:**
- `src/templates/email-digest.html`
- `src/templates/email-digest.txt`
- Node.js helper: `scripts/render-email.js`

**Acceptance:**
- [ ] HTML email is readable and attractive
- [ ] Plain text fallback is clear
- [ ] Includes all event details
- [ ] Shows which interests matched
- [ ] Links work correctly

### 2.3: Email Sending

**Tasks:**
- Install nodemailer npm package
- Configure SMTP in .env
- Create `/send-digest` command
- Query DB for unsent events above threshold
- Generate iCal attachments
- Render email template
- Send via Nodemailer
- Mark events as sent (sent_in_digest_id)
- Log to sent_digests table

**Deliverables:**
- `src/commands/send-digest.md`
- `scripts/send-email.js`
- Email setup guide: `setup/src/guides/email-smtp.md`

**Acceptance:**
- [ ] Email sends successfully
- [ ] iCal attachments are included
- [ ] Calendar invites work (can click to add)
- [ ] Events are marked as sent
- [ ] Doesn't re-send same events

### 2.4: Test & Preview Commands

**Tasks:**
- Create `/test-digest` - Shows what would be sent without sending
- Create `/send-test-email` - Sends test email (no event data)
- Add email validation (check SMTP settings)

**Deliverables:**
- `src/commands/test-digest.md`
- `src/commands/send-test-email.md`

**Acceptance:**
- [ ] Can preview digest without sending
- [ ] Can send test email to verify SMTP
- [ ] Error messages are clear

**Phase 2 Milestone**: Complete end-to-end workflow - discover events, match interests, send email digest with calendar invites.

---

## Phase 3: HTML Scraping & Advanced Sources

**Goal**: Support websites without RSS feeds

**Duration**: 1-2 weeks

### 3.1: Scraper Configuration

**Tasks:**
- Define scraper config JSON schema
- Create scraper template for common patterns
- Add scraper_config field to sources table
- Create Node.js scraper: `scripts/scrape-html.js`
- Use Cheerio for CSS selector-based extraction

**Deliverables:**
- `src/context/scraper-config-schema.md`
- `scripts/scrape-html.js`
- Example configs in `data/scraper-examples/`

**Acceptance:**
- [ ] Can define selectors for title, date, link, venue
- [ ] Scraper extracts events from HTML
- [ ] Handles pagination (if simple)
- [ ] Respects rate limiting (delays)

### 3.2: LLM-Assisted Scraping

**Tasks:**
- When selectors fail, fall back to LLM extraction
- Create template: `src/templates/extract-events-from-html.md`
- Pass HTML snippet to LLM, ask for JSON
- Validate and store extracted events

**Deliverables:**
- `src/templates/extract-events-from-html.md`
- Integration in `/discover-events` command

**Acceptance:**
- [ ] LLM can extract events from unstructured HTML
- [ ] Returns valid JSON with event fields
- [ ] Handles edge cases (relative dates, etc.)
- [ ] Falls back gracefully on parse errors

### 3.3: `/add-site` Wizard

**Tasks:**
- Create intelligent `/add-site` command
- Fetches URL
- Checks for RSS feed (parse HTML for <link rel="alternate">)
- If no RSS:
  - Analyze HTML structure
  - Use LLM to identify event container and fields
  - Generate scraper config
  - Test extraction, show results
  - Ask user to confirm
- Save source with config

**Deliverables:**
- `src/commands/add-site.md`
- Logic for RSS detection
- Logic for scraper generation

**Acceptance:**
- [ ] Automatically detects RSS feeds
- [ ] For HTML, generates working scraper config
- [ ] Shows sample extracted events
- [ ] Saves source on confirmation
- [ ] Graceful failure with clear errors

**Phase 3 Milestone**: Can add any website (RSS or HTML), with intelligent scraper generation.

---

## Phase 4: Polish & Refinement

**Goal**: Quality-of-life improvements and stability (automation deferred to Phase 5)

**Duration**: 1 week

### 4.1: Event History & Search

**Tasks:**
- Create `/search-events` command
- Filter by: date range, source, artist, venue, sent status
- Display results with metadata

**Deliverables:**
- `src/commands/search-events.md`

**Acceptance:**
- [ ] Can search by various criteria
- [ ] Shows relevant events
- [ ] Pagination for large results

### 4.2: Event Updates

**Tasks:**
- Detect when event details change (date, venue, time)
- Compare new fetch with existing DB record
- If significant change: mark as updated
- Optionally re-send digest with "⚠️ UPDATE:" prefix

**Deliverables:**
- Update detection logic in `/discover-events`
- Config option: `RESEND_ON_UPDATE=true/false`

**Acceptance:**
- [ ] Detects date changes
- [ ] Detects venue changes
- [ ] Detects cancellations
- [ ] Can re-send updated events
- [ ] Clearly marks updates in digest

### 4.3: Error Handling & Monitoring

**Tasks:**
- Implement retry logic for failed fetches
- Log errors to file (`logs/eventfinder.log`)
- Send error summary in digest (if failures occurred)
- Create `/check-health` command (tests DB, email, sources)

**Deliverables:**
- Logging system
- `src/commands/check-health.md`
- Error handling throughout

**Acceptance:**
- [ ] Retries failed requests (up to 3x)
- [ ] Logs all errors with timestamps
- [ ] Health check verifies all systems
- [ ] User is notified of persistent failures

### 4.5: Documentation & Polish

**Tasks:**
- Update README with full usage guide
- Create tutorial: "Your First Event Digest"
- Add troubleshooting guide
- Add FAQ
- Clean up code comments
- Run linter/formatter

**Deliverables:**
- Comprehensive README
- `docs/tutorial.md`
- `docs/troubleshooting.md`
- `docs/faq.md`

**Acceptance:**
- [ ] New user can set up from README alone
- [ ] Common issues are documented
- [ ] Code is clean and commented

**Phase 4 Milestone**: Polished, stable, manually-triggered event discovery system ready for daily use.

---

## Phase 5: Automation Research & Implementation

**Goal**: Explore automation options and implement scheduled execution

**Duration**: 1-2 weeks

### 5.1: Automation Research

**Tasks:**
- Research Claude Code headless/non-interactive execution modes
- Test: Can Claude Code run scripts without user interaction?
- Test: Can Claude Code be invoked from cron/system scheduler?
- Research Claude API for programmatic LLM execution
- Research Android automation (Tasker, Termux:Boot, cron alternatives)
- Document findings and recommend approach

**Deliverables:**
- `docs/automation-research.md` - Research findings
- Decision on automation approach

**Acceptance:**
- [ ] Tested Claude Code headless capabilities
- [ ] Tested Claude API integration (if needed)
- [ ] Tested Android automation options
- [ ] Clear recommendation documented

### 5.2: Implement Chosen Automation

**Based on research, implement one of:**

**Option A: Claude Code Headless Mode**
- Create wrapper script that invokes Claude Code non-interactively
- Set up system cron (or Android equivalent)
- Run `/discover-events` on schedule

**Option B: Claude API Integration**
- Create Node.js script using Claude API
- Replicate LLM logic from script.md as API calls
- Set up scheduler to run Node.js script

**Option C: Android Automation**
- Set up Termux:Boot to start on device boot
- Use Tasker or similar to trigger EventFinder at specific time
- Or: Simple reminder notification to run manually

**Deliverables:**
- Implementation based on chosen option
- Setup guide for chosen approach
- Testing over 7-day period

**Acceptance:**
- [ ] Runs automatically at configured time
- [ ] Logs activity
- [ ] Handles errors gracefully
- [ ] Works reliably for 7 consecutive days

**Phase 5 Milestone**: Fully automated event discovery running daily without manual intervention.

---

## Future Phases (Post-V1)

### Phase 6: Advanced Features
- [ ] Web UI for managing sources/interests
- [ ] Mobile notifications (via Pushover, etc.)
- [ ] Social features (share events with friends)
- [ ] Price tracking and alerts
- [ ] Multi-user support
- [ ] Natural language queries

### Phase 7: Integrations
- [ ] Spotify API for artist discovery
- [ ] Google Calendar API (read calendar to avoid duplicates)
- [ ] Ticketmaster API MCP server
- [ ] Eventbrite API MCP server
- [ ] Facebook Events API

### Phase 7: Intelligence
- [ ] Machine learning for relevance scoring
- [ ] Collaborative filtering (similar users' events)
- [ ] Trend detection (rising artists/genres)
- [ ] Automatic interest discovery (based on attendance)

---

## Testing Plan

### Unit Tests
Each phase should include tests for:
- Database operations (CRUD)
- Scoring algorithm
- Date parsing
- Hash generation
- Email rendering

**Tool**: Jest or Mocha

### Integration Tests
- End-to-end: Add source → discover → match → digest
- RSS parsing with real feeds
- HTML scraping with fixtures
- Email sending to test account

**Tool**: Jest with mocks for external services

### Manual Testing
- Test slash commands interactively
- Test email formatting in multiple clients
- Test calendar invites in Gmail, Outlook, Apple Calendar
- Test with various RSS feeds and HTML sites

**Frequency**: After each phase

---

## Progress Tracking

### Current Status: Phase 0 Complete ✅

**Next Steps:**
1. Set up SQLite MCP server
2. Implement `/add-interest` command
3. Test interest storage and retrieval

### Velocity Estimate
- Phase 1: ~10-15 hours (1-2 weeks part-time)
- Phase 2: ~8-10 hours (1 week)
- Phase 3: ~10-15 hours (1-2 weeks)
- Phase 4: ~8-10 hours (1 week)

**Total**: ~35-50 hours (4-6 weeks part-time)

---

## Success Metrics

### Phase 1
- [ ] Can add 5+ interests
- [ ] Can add 3+ RSS sources
- [ ] Discovers 10+ events
- [ ] Matches events to interests correctly

### Phase 2
- [ ] Sends first email digest
- [ ] Calendar invites work in 3+ email clients
- [ ] Zero false positives in digest

### Phase 3
- [ ] Successfully scrapes 3+ HTML-only sites
- [ ] `/add-site` wizard works 80% of the time

### Phase 4
- [ ] Runs automatically for 7 days without intervention
- [ ] Zero missed digests
- [ ] All errors logged and handled

### Overall Success
- [ ] User checks event websites 0 times per week (down from 10+)
- [ ] User attends 2+ events they would have missed
- [ ] 100% of favorite artists' shows are caught

---

## Risk Management

### Technical Risks

**R1**: Claude Code doesn't support automation
- **Mitigation**: Fall back to external cron + headless mode
- **Impact**: Medium - adds complexity

**R2**: Web scraping is too fragile
- **Mitigation**: Focus on RSS first, use APIs where possible
- **Impact**: High - core functionality

**R3**: Email deliverability issues
- **Mitigation**: Use established SMTP provider (SendGrid), test thoroughly
- **Impact**: High - core functionality

**R4**: LLM parsing is inconsistent
- **Mitigation**: Use structured extraction prompts, validate output
- **Impact**: Medium - affects accuracy

### Scope Risks

**S1**: Scope creep (adding too many features)
- **Mitigation**: Stick to phased plan, defer non-MVP features
- **Impact**: High - delays launch

**S2**: Over-engineering
- **Mitigation**: Start simple, iterate based on real usage
- **Impact**: Medium - wastes time

### User Risks

**U1**: User abandons if setup is too complex
- **Mitigation**: Guided setup assistant, clear docs
- **Impact**: High - adoption failure

**U2**: Too many false positives → user ignores digests
- **Mitigation**: Tunable scoring, user can adjust threshold
- **Impact**: High - product failure

---

## Dependencies

### External Dependencies
- Claude Code (installed and working)
- Node.js 18+ (for helper scripts)
- SQLite MCP server (configured)
- SMTP email account (Gmail, SendGrid, etc.)

### Knowledge Dependencies
- RSS/Atom feed formats
- HTML/CSS selectors (for scraping)
- iCalendar specification
- Email MIME format (multipart)

### Resource Dependencies
- 2-6 weeks of development time
- Event sources for testing (3-5 RSS feeds)
- Test email account
- Access to multiple calendar apps (testing)

---

## Prompt Engineering Workplan

A significant portion of EventFinder's intelligence comes from well-crafted prompts. Here's a dedicated plan for prompt development:

### Prompt 1: Event Extraction from HTML
**File**: `src/templates/extract-events-from-html.md`

**Purpose**: Parse unstructured HTML to find events

**Iteration plan**:
1. Start with explicit fields and format
2. Test with 5 different venue websites
3. Refine based on edge cases (relative dates, missing fields)
4. Add examples of good/bad extractions

### Prompt 2: RSS Enrichment
**File**: `src/templates/enrich-rss-event.md`

**Purpose**: Extract additional details from RSS item description

**Iteration plan**:
1. Identify common patterns in RSS descriptions
2. Extract structured data (venue, time, price)
3. Test with 10 different RSS feeds

### Prompt 3: Scraper Configuration Generation
**File**: `src/templates/generate-scraper-config.md`

**Purpose**: Analyze HTML and create selector-based scraper config

**Iteration plan**:
1. Provide example HTML and desired config
2. Test with common event page patterns
3. Validate generated selectors

### Prompt 4: Interest Matching Explanation
**File**: `src/templates/explain-match.md`

**Purpose**: Explain why an event matched (for debugging/transparency)

**Iteration plan**:
1. Generate natural language explanations
2. Test clarity with users
3. Refine for conciseness

**Testing approach**: Create test suite with diverse HTML fixtures, expected outputs, and scoring system.

---

## Notes for Future Development

### Performance Optimizations (defer to post-V1)
- Parallel source fetching (Promise.all)
- Cache RSS feeds (only re-fetch if stale)
- Incremental DB updates (only check recent events)
- Background processing (don't block digest send)

### Maintenance Considerations
- Scraper configs will break when sites redesign → need monitoring
- RSS feeds may become unavailable → need health checks
- Rate limiting may change → need configurable delays
- API limits may be reached → need quota tracking

### Community Features (long-term)
- Share scraper configs (community library)
- Share interests (trending artists/venues)
- Collaborative filtering (users with similar tastes)
- Public event feed (aggregated from all sources)

---

## Getting Started (Next Actions)

1. **Set up SQLite MCP server**
   - Follow guide in Claude Code MCP docs
   - Configure in `.mcp.json`
   - Test with simple queries

2. **Create database schema**
   - Write `data/schema.sql`
   - Run via SQLite MCP server
   - Verify tables created

3. **Implement `/add-interest` command**
   - Create `src/commands/add-interest.md`
   - Test adding various interest types
   - Verify data persists in DB

4. **Build from there, following Phase 1 plan**

**Ready to start coding!** 🚀
