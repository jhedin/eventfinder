# EventFinder: MVP Implementation Workplan

**Based on**: planning/DECISIONS.md final approach
**Goal**: Manual workflow, Playwright MCP, LLM-based matching, Mailgun email

## Security Model

**Agent never sees credentials**:
- `.env` file (gitignored) contains SMTP passwords, API keys
- `src/mcp.json` configured with **no credentials**
- Custom SMTP MCP server reads `.env` from project root
- Agent calls `send_digest_email` tool, server handles credentials
- Works with Claude Code, Claude API, and future local LLMs

**MCP Servers**:
- `sqlite` - Database (no credentials needed)
- `playwright` - Web fetching (no credentials needed)
- `smtp-email` - Email sending (reads .env, agent can't access)

---

## Phase 0: Foundation ✅ COMPLETE

- ✅ Project structure (src/, setup/, scripts/)
- ✅ Build system (npm run build)
- ✅ Setup assistant LLM script
- ✅ Configuration templates (.env.template, .gitignore)
- ✅ Documentation (README, CLAUDE.md, WORKFLOW.md)
- ✅ Planning documents (DECISIONS.md, technical-design.md, data-formats.md)
- ✅ Database schema (data/schema.sql)
- ✅ Slash commands defined (src/commands/*.md)

**Status**: Ready for implementation

---

## Phase 1: Database & Configuration (3-5 days)

**Goal**: Set up data layer and user configuration files

### 1.1: Database Initialization

**Tasks:**
- Set up SQLite MCP server in `src/mcp.json`
- Create Node.js initialization script: `scripts/init-db.js`
- Run `data/schema.sql` to create tables
- Test database operations via MCP

**Deliverables:**
- `scripts/init-db.js` - Database initialization
- `setup/src/guides/sqlite-mcp.md` - MCP setup guide
- `data/eventfinder.db` - Created (gitignored)

**Acceptance:**
- [ ] SQLite MCP server configured
- [ ] Database tables created successfully
- [ ] Can query database via MCP tools

### 1.2: User Preferences File

**Tasks:**
- Create template: `data/user-preferences.md`
- Include sections: interests, location, timezone, exclusions
- Add examples and instructions
- User will manually edit this file

**Deliverables:**
- `data/user-preferences.md` - User preferences template

**Example content:**
```markdown
# My Event Preferences

## Location
Calgary, AB, Canada
Timezone: America/Edmonton

## Interests

### Music
- Jazz (especially vocal jazz, big band)
- Indie rock
- The National (band)
- Local musicians

### Arts & Culture
- Gallery openings
- Film festivals
- Poetry readings

### Workshops
- Pottery classes
- Printmaking
- Woodworking

## Exclusions
- Sports events
- Nightclubs
- Events after 11pm
```

**Acceptance:**
- [ ] Template is clear and easy to edit
- [ ] Includes all necessary sections
- [ ] Examples help users understand format

### 1.3: Sources Management

**Tasks:**
- ~~Create `data/sources.json`~~ **DECISION**: Store in database only
- Sources added manually to database via SQL or setup script
- Create Node.js helper: `scripts/add-source.js`

**Deliverables:**
- `scripts/add-source.js` - CLI tool to add sources to database

**Example usage:**
```bash
node scripts/add-source.js \
  --url "https://www.jazzyyc.com/events/" \
  --name "Jazz YYC Events" \
  --description "Calgary's jazz venue and concert series"
```

**Acceptance:**
- [ ] Can add sources to database via script
- [ ] Sources include: url, name, description
- [ ] `description` field helps with relevance matching

**Phase 1 Milestone**: Database ready, user can edit preferences, sources can be added

---

## Phase 2: Event Discovery (1 week)

**Goal**: Fetch websites, extract events, store in database

### 2.1: Playwright MCP Integration

**Tasks:**
- Configure Playwright MCP in `src/mcp.json`
- Test fetching websites → markdown conversion
- Handle errors (timeouts, 404s, etc.)
- Add 5-second timeout per source

**Deliverables:**
- Playwright MCP configured in `src/mcp.json`
- `setup/src/guides/playwright-mcp.md` - Setup guide

**Acceptance:**
- [ ] Playwright MCP fetches pages successfully
- [ ] Converts HTML to markdown
- [ ] Handles common errors gracefully
- [ ] 5-second timeout enforced

### 2.2: Event Extraction (LLM)

**Tasks:**
- Create template: `src/templates/extract-events-from-markdown.md`
- LLM prompt to extract events from markdown → JSON
- Use format from `planning/data-formats.md`
- Handle truncation (100KB markdown limit)

**Deliverables:**
- `src/templates/extract-events-from-markdown.md` - LLM extraction prompt

**Prompt structure:**
```markdown
# Extract Events from Markdown

You are analyzing a website's event listing page (converted to markdown).
Extract all events into structured JSON format.

## Input
<markdown content here>

## Output Format
[
  {
    "title": "string",
    "venue": "string",
    "description": "string (optional)",
    "price": "string (optional)",
    ...
    "instances": [...]
  }
]

## Instructions
- Extract ALL events from the page
- Parse dates carefully (handle relative dates like "Tomorrow")
- If markdown is truncated, extract what you can
- Return empty array [] if no events found
```

**Acceptance:**
- [ ] Extracts events from markdown successfully
- [ ] Returns valid JSON matching schema
- [ ] Handles truncated markdown gracefully
- [ ] Tested with 5-10 real event sites

### 2.3: Duplicate Detection

**Tasks:**
- Implement hash generation (title + venue normalization)
- Implement LLM fuzzy matching (see `planning/implementation-strategies.md`)
- Query similar events before inserting
- Ask LLM if new event matches any existing

**Deliverables:**
- `src/templates/fuzzy-match-events.md` - LLM fuzzy matching prompt
- Hash generation logic in `/discover-events` command

**Acceptance:**
- [ ] Exact duplicates detected via hash
- [ ] Fuzzy duplicates detected via LLM
- [ ] No duplicate events in database after multiple runs

### 2.4: Relevance Matching (LLM)

**Tasks:**
- Create template: `src/templates/match-event-to-preferences.md`
- LLM reads `data/user-preferences.md` + event JSON
- Returns binary match decision with reasoning
- Use format from `planning/data-formats.md`

**Deliverables:**
- `src/templates/match-event-to-preferences.md` - LLM matching prompt

**Prompt structure:**
```markdown
# Match Event to User Preferences

## User Preferences
<contents of data/user-preferences.md>

## Event
<event JSON>

## Task
Does this event match the user's interests?

## Output Format
{
  "matches": true/false,
  "reason": "Brief explanation"
}
```

**Acceptance:**
- [ ] Correctly matches relevant events
- [ ] Correctly excludes irrelevant events
- [ ] Provides useful reasoning
- [ ] Tested with 10+ diverse events

### 2.5: `/discover-events` Command

**Tasks:**
- Implement main workflow in `src/commands/discover-events.md`
- Read user preferences
- Fetch sources from database
- For each source:
  - Playwright MCP → markdown
  - LLM extract → events JSON
  - Check for duplicates (hash + fuzzy)
  - LLM match → relevance decision
  - Store in database with sent_events status
- Display summary

**Deliverables:**
- `src/commands/discover-events.md` - Complete workflow

**Workflow:**
1. Load `data/user-preferences.md`
2. Query sources from database (active=1)
3. For each source:
   - Fetch via Playwright MCP → markdown (5s timeout)
   - Truncate to 100KB if needed
   - LLM extract events → JSON
   - For each event:
     - Generate hash(title + venue)
     - Check exact match in DB
     - If not found, query similar events
     - LLM fuzzy match check
     - If not duplicate: LLM relevance match
     - If matches: insert into DB with status='pending'
     - If excluded: insert with status='excluded'
   - Update source.last_checked_at
   - On error: increment consecutive_failures
4. Display summary

**Acceptance:**
- [ ] Discovers events from all active sources
- [ ] No duplicates created
- [ ] Relevant events marked for sending
- [ ] Irrelevant events excluded
- [ ] Clear summary output
- [ ] Handles errors gracefully

**Phase 2 Milestone**: Can discover events, extract data, match to preferences, store in database

---

## Phase 3: Email Digest (1 week)

**Goal**: Generate and send email with calendar invites

### 3.1: SMTP MCP Server Setup

**Tasks:**
- Install dependencies in `mcp-servers/smtp-email/`
- Test SMTP connection with Mailgun
- Add MCP server to `src/mcp.json`
- Test `send_digest_email` tool

**Deliverables:**
- Working SMTP MCP server
- `setup/src/guides/mailgun-smtp.md` - Setup guide

**MCP Configuration** (already in `src/mcp.json`):
```json
{
  "smtp-email": {
    "command": "node",
    "args": ["./mcp-servers/smtp-email/index.js"]
  }
}
```

**Acceptance:**
- [ ] MCP server starts without errors
- [ ] `test_smtp_connection` tool works
- [ ] Can call from Claude Code
- [ ] Reads .env correctly

### 3.2: Email Templates

**Tasks:**
- Create HTML template: `src/templates/email-digest.html`
- Create plain text template: `src/templates/email-digest.txt`
- Group events by category
- Include event cards with all details
- Show relevance reasoning

**Deliverables:**
- `src/templates/email-digest.html` - HTML email
- `src/templates/email-digest.txt` - Plain text fallback

**Email structure** (from `planning/data-formats.md`):
```
Subject: 8 New Events (Oct 15 - Nov 22)

# Music 🎵
[Event cards...]

# Arts & Culture 🎨
[Event cards...]

# Workshops 🛠️
[Event cards...]
```

**Acceptance:**
- [ ] HTML renders correctly in email clients
- [ ] Plain text is readable
- [ ] Events grouped by category
- [ ] All event details included
- [ ] Links work correctly

### 3.3: Email Sending via MCP

**Tasks:**
- Query unsent events from database
- Render HTML + plain text email from templates
- Prepare events array for MCP tool
- Call `send_digest_email` tool via smtp-email MCP
- Mark events as sent in database

**MCP Tool Usage**:
```javascript
// Agent calls this via smtp-email MCP
send_digest_email({
  to: "user@gmail.com",
  subject: "8 New Events (Oct 15 - Nov 22)",
  html: "<html>...</html>",
  text: "Plain text version...",
  events: [
    {
      title: "Jazz Night",
      venue: "Blue Note",
      instances: [{ date: "2025-10-15", time: "20:00:00", ... }]
    }
  ]
})
```

**What the MCP Server Does** (agent doesn't see this):
- Reads SMTP credentials from `.env`
- Generates iCal files automatically
- Sends email with attachments
- Returns success/failure

**Acceptance:**
- [ ] Email sends successfully via MCP tool
- [ ] HTML and plain text both included
- [ ] iCal files generated and attached correctly
- [ ] Calendar invites work when opened
- [ ] Events marked as sent in DB
- [ ] Agent never sees SMTP credentials

### 3.4: End-to-End Integration

**Tasks:**
- Update `/discover-events` to optionally send digest
- Query unsent events from database
- Render email templates (HTML + text)
- Call `send_digest_email` MCP tool
- Update sent_events table

**Deliverables:**
- Updated `src/commands/discover-events.md` with email workflow

**Usage:**
```bash
/discover-events          # Discover only
/discover-events --send   # Discover + send digest
```

**Acceptance:**
- [ ] Can discover without sending
- [ ] Can discover + send in one command
- [ ] Only sends new events (not previously sent)
- [ ] Digest includes all unsent matched events
- [ ] Database updated correctly

**Phase 3 Milestone**: Complete end-to-end workflow - discover, match, send email with calendar invites

---

## Phase 4: Polish & Utility Commands (3-5 days)

**Goal**: Quality-of-life improvements and testing tools

### 4.1: `/preview-digest` Command

**Tasks:**
- Show what would be sent without actually sending
- Query unsent matched events
- Generate email preview (markdown format in terminal)
- Show count and summary

**Deliverables:**
- `src/commands/preview-digest.md` - Preview command

**Acceptance:**
- [ ] Shows all unsent events
- [ ] Displays in readable format
- [ ] Shows email subject, event count
- [ ] Does not send email or mark as sent

### 4.2: `/check-events` Command

**Tasks:**
- List recent events from database
- Filter by: date range, source, matched/excluded
- Show relevance reasoning
- Useful for debugging

**Deliverables:**
- `src/commands/check-events.md` - Check command

**Acceptance:**
- [ ] Lists events with filters
- [ ] Shows relevance reasoning
- [ ] Pagination for large results
- [ ] Clear, readable output

### 4.3: Source Health Monitoring

**Tasks:**
- Track consecutive failures in database
- Auto-disable after 3 failures
- Log errors with details
- Create `/list-sources` command showing health

**Deliverables:**
- Updated `/discover-events` with error tracking
- `src/commands/list-sources.md` - List sources with health status

**Acceptance:**
- [ ] Failed sources tracked in DB
- [ ] Auto-disabled after 3 consecutive failures
- [ ] `/list-sources` shows health status
- [ ] User can manually re-enable sources

### 4.4: Documentation

**Tasks:**
- Update README with full usage guide
- Create tutorial: "Getting Started"
- Update setup guides
- Document all slash commands

**Deliverables:**
- Updated README.md
- `docs/getting-started.md` - Tutorial

**Acceptance:**
- [ ] New user can set up from README
- [ ] All commands documented
- [ ] Common issues covered
- [ ] Examples provided

**Phase 4 Milestone**: Polished, stable, manually-triggered event discovery system ready for daily use

---

## Success Metrics

### MVP Complete When:
- [ ] User can edit `data/user-preferences.md`
- [ ] User can add sources to database
- [ ] `/discover-events` finds events from all sources
- [ ] LLM correctly matches events to preferences
- [ ] Email digest sends with calendar invites
- [ ] Calendar invites work in 3+ email clients
- [ ] Zero duplicates in database
- [ ] Can run daily without manual intervention (except triggering)

### Quality Targets:
- [ ] 90%+ of relevant events caught
- [ ] < 10% false positives
- [ ] < 3 seconds per source (on average)
- [ ] Handles 10+ sources smoothly
- [ ] No crashes or data corruption

---

## Implementation Order

**Week 1: Data Layer**
- Day 1-2: Database setup, MCP configuration
- Day 3-4: User preferences template, source management
- Day 5: Testing, documentation

**Week 2: Event Discovery**
- Day 1-2: Playwright MCP, event extraction
- Day 3: Duplicate detection
- Day 4: Relevance matching
- Day 5: `/discover-events` command integration

**Week 3: Email Digest**
- Day 1-2: iCal generation
- Day 3: Email templates
- Day 4: Mailgun integration
- Day 5: End-to-end testing

**Week 4: Polish**
- Day 1-2: Utility commands
- Day 3: Error handling, source monitoring
- Day 4-5: Documentation, testing

**Total**: 4 weeks part-time (20-25 hours)

---

## Risk Mitigation

**R1: Playwright MCP too slow**
- Mitigation: Parallel fetching (Phase 5)
- Acceptable: 5s/source × 10 sources = 50s total

**R2: LLM extraction inconsistent**
- Mitigation: Iterative prompt refinement
- Test with diverse sites, collect edge cases

**R3: Too many false positives**
- Mitigation: User can refine preferences
- LLM provides reasoning for transparency

**R4: Email deliverability issues**
- Mitigation: Mailgun handles professionally
- Test with multiple email clients

**R5: Duplicate detection misses some**
- Mitigation: LLM fuzzy matching catches most
- Accept occasional duplicate (user can ignore)

---

## Deferred to Future Phases

**Phase 5: Automation** (not in MVP)
- Research Claude Code headless mode
- Research Android automation
- Implement chosen approach

**Phase 6: Advanced Features** (not in MVP)
- `/add-site` wizard
- Update detection
- Feedback loop / learning
- Multi-user support
- Web UI

---

## Next Steps

1. **Set up SQLite MCP server**
   - Add to `src/mcp.json`
   - Test with simple queries

2. **Create database**
   - Write `scripts/init-db.js`
   - Run `data/schema.sql`

3. **Create user preferences template**
   - Write `data/user-preferences.md`
   - Fill in with your actual preferences

4. **Add first sources**
   - Write `scripts/add-source.js`
   - Add 2-3 test sources

5. **Begin Phase 2** - Event discovery implementation

**Ready to start coding!** 🚀
