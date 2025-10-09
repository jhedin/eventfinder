# EventFinder: Key Decisions Summary

**Date**: 2025-10-07
**Status**: All critical decisions finalized for MVP development

This document summarizes all key architectural and design decisions made during the planning phase.

---

## Q1: How does the LLM script run daily? ✅

**Decision**: Phased approach - Manual trigger (MVP), then automation research

### MVP (Phase 1-3)
- Manual trigger via `/discover-events` command
- Works well for Android/Termux environment
- No long-running processes needed

### Future (Phase 4+)
Research and implement automation:
1. **Preferred**: Claude Code headless mode with system cron
2. **Alternative**: Claude API integration for true automation
3. **Android-specific**: Tasker/Termux automation to trigger manually on schedule

**Rationale**:
- Manual is acceptable for MVP validation
- Android processes get killed frequently, so cron not ideal
- Automation complexity deferred until workflow is proven

---

## Q2: Web Fetching - MCP or Node.js? ✅

**Decision**: Hybrid approach using MCP-first

### Implementation
- **Claude Code WebFetch** for simple fetching
- **Playwright MCP** for JavaScript-heavy sites (React, etc.)
- **Node.js scripts** only for data transformation (parsing, hashing)

**Rationale**:
- Claude excels at using built-in web tools
- Playwright MCP handles modern web (Microsoft-maintained)
- Keeps LLM as orchestrator, not just calling scripts
- Flexible for different site types

---

## Q3: SQLite Integration? ✅

**Decision**: Hybrid - Node.js setup + MCP runtime

### Implementation
- **Node.js scripts** for schema initialization (`scripts/init-db.js`, `data/schema.sql`)
- **SQLite MCP server** for all runtime LLM database operations (INSERT, SELECT, UPDATE, DELETE)

**Rationale**:
- Schema management better in version-controlled scripts
- LLM shouldn't handle DDL (CREATE TABLE), only DML
- MCP provides clean, tool-based interface for queries
- Clear separation: Infrastructure (Node.js) vs Operations (LLM)

---

## Q4: Event Parsing/Extraction? ✅

**Decision**: MCP-first approach with markdown conversion

### Implementation
```
1. MCP fetches page → converts to markdown (strips images, scripts, data URLs)
2. LLM receives clean markdown
3. LLM extracts structured event data → JSON
4. Store in SQLite via MCP
```

**Rationale**:
- MCP servers handle HTML→markdown conversion
- Markdown is cleaner for LLM (no bloat, no image data URLs)
- Token-efficient: markdown much smaller than raw HTML
- No need for CSS selector configs
- Can build custom MCPs for complex sites if needed

**Files**:
- `src/templates/extract-events-from-markdown.md` - Extraction prompt template

---

## Q5: Interest Matching Granularity? ✅

**Decision**: LLM-based relevance matching with learning system

### Phase 1-2 (Single User)
- User preferences in markdown: `data/user-preferences.md`
- Natural language description:
  ```markdown
  I love indie rock and folk music, especially bands like Fleet Foxes,
  The National, Bon Iver. I'm interested in intimate venue shows at
  The Fillmore and smaller clubs. Not interested in huge festivals.
  ```
- LLM reads preferences + event → decides relevance

### Phase 6+ (Multi-User with Learning)
- Move to SQLite `users` table with `preferences_summary` field
- Track user actions:
  - Added event to calendar → positive signal
  - Added ticket reminder → strong positive
  - Marked attended → very strong positive
  - Rated/liked → explicit feedback
- LLM analyzes feedback → updates preference summary
- Self-improving recommendation system

**Rationale**:
- LLM understands context ("The National" = band, not holiday)
- Natural language more intuitive than keyword lists
- Enables powerful feedback loop
- Tokens acceptable cost for quality

**Files**:
- `data/user-preferences.md` - User's natural language preferences
- `src/templates/match-event-to-preferences.md` - Matching prompt template

---

## Q6: Email Formatting? ✅

**Decision**: Multipart (HTML + plain text)

### Implementation
- Nodemailer with multipart support
- HTML template for rich formatting
- Plain text fallback for compatibility

**Rationale**:
- Best of both worlds
- HTML looks great in modern clients
- Plain text ensures universal compatibility
- Minimal extra code with Nodemailer

**Files**:
- `src/templates/email-digest.html` - HTML email template
- `src/templates/email-digest.txt` - Plain text fallback

---

## Q7: Event Update Detection? ✅

**Decision**: Defer to Phase 4 (combination of tracking + re-sending)

### MVP (Phase 1-3)
- Send once, no update detection
- Simple workflow

### Future (Phase 4+)
- Track event changes in database (`event_history` table)
- Re-send when significant changes detected:
  - Date/time changed
  - Venue changed
  - Event cancelled
  - Ticket sale date changed
- Email subject: "⚠️ UPDATE: [Event Name] - [Change Description]"
- Store change history for audit trail

**Rationale**:
- MVP doesn't need this complexity
- Change detection valuable but not critical initially
- History tracking enables future analytics and reliability scoring

---

## Q8: Timezone Handling? ✅

**Decision**: Store with event, user context in preferences

### Implementation
- User specifies location/timezone in `data/user-preferences.md`:
  ```markdown
  ## Location
  I'm based in San Francisco, California (America/Los_Angeles timezone).
  I travel occasionally but most events I attend are local.
  ```
- Events store their timezone (IANA format: "America/Los_Angeles")
- Display times in event's local timezone with abbreviation ("8:00 PM PST")
- LLM can convert to user's timezone when relevant
- iCal attachments include proper timezone (clients handle conversion)

**Rationale**:
- User location is part of preference context
- LLM intelligently decides when timezone differences matter
- iCal handles timezone conversion automatically
- Future: Could detect user's current timezone from device

**Database**:
- `events.timezone` field (IANA format)

---

## Q9: APIs vs Scraping? ✅

**Decision**: Start with Playwright MCP, add API MCPs only as needed

### Phased Approach

**Phase 1 (MVP)**:
- Playwright MCP for websites (handles RSS as special case)
- Simple, universal

**Phase 2-3**:
- Continue with Playwright for JavaScript-heavy sites
- Handles React-based event platforms

**Phase 4+ (only if needed)**:
- Ticketmaster API MCP (if RSS/Playwright insufficient)
- Eventbrite API MCP (if needed)
- Custom MCPs for specific challenging sites

**Rationale**:
- RSS feeds universally supported
- Playwright MCP handles modern web
- These two cover 90%+ of use cases
- API MCPs add complexity/dependencies
- Only add when scraping fails for important sources

**Note**: Keep API setup guides for future use

---

## Q10: MVP (Minimum Viable Product)? ✅

**Decision**: Manual workflow with Playwright MCP

### Must Have for MVP (Phase 1-3)

**Core Functionality**:
- ✅ User preferences in markdown: `data/user-preferences.md`
  - Natural language interests
  - Location/timezone
- ✅ Website URLs manually added (edit `data/sources.json`)
- ✅ Playwright MCP fetches and converts to markdown
- ✅ `/discover-events` - Manual trigger
- ✅ LLM extracts events from markdown
- ✅ LLM-based relevance matching
- ✅ Store in SQLite (via MCP)
- ✅ Detect duplicates
- ✅ Generate multipart email digest
- ✅ Send with 2 iCal attachments per event:
  - Ticket sale reminder
  - Event date
- ✅ SMTP via Mailgun

**Explicitly NOT in MVP**:
- ❌ Automated scheduling (Phase 5)
- ❌ `/add-site` wizard (Phase 3)
- ❌ `/add-interest` command (just edit preferences.md)
- ❌ Update detection (Phase 4)
- ❌ Feedback loop / learning (Phase 6+)
- ❌ API integrations (only if needed)
- ❌ Multi-user support (Phase 6+)
- ❌ Web UI (future)

### MVP User Flow
1. Edit `data/user-preferences.md` - describe interests
2. Edit `data/sources.json` - list website URLs
3. Run `/discover-events`
4. Receive email with matched events + calendar invites
5. Repeat daily (manually)

**Rationale**:
- Website scraping is general case (RSS is structured HTML)
- Playwright MCP handles both
- Focus on core value: discover → match → notify
- Automation comes after workflow proven

---

## Q11: Email Sending? ✅

**Decision**: Mailgun free tier (5,000 emails/month, sandbox domain)

### Implementation
- **Mailgun SMTP** with sandbox domain
- Send FROM: `sandbox*.mailgun.org` (auto-created)
- Send TO: Up to 5 authorized recipients
- No custom domain needed
- iCal attachments work perfectly

### Key Benefits
- 5,000 emails/month (vs 100/day with SendGrid)
- No custom domain verification required
- Sandbox domain works for personal use
- 5 authorized recipients perfect for single user
- No credit card required

**Rationale**:
- User has Gmail (primary) - too risky for automation
- Getting banned from Google = catastrophic
- Mailgun sandbox perfect for single-user daily digest
- Built for automation, zero ban risk
- Can still receive at Gmail safely
- Simple setup with pre-authorized recipients

**Setup**:
- `setup/src/guides/mailgun-smtp.md` - Mailgun setup guide
- Nodemailer configured with Mailgun SMTP

---

## Technology Stack Summary

### Core Technologies
- **LLM**: Claude Code (interactive) / Claude API (future automation)
- **Database**: SQLite via MCP server
- **Web Fetching**: Playwright MCP, WebFetch tool
- **Email**: Nodemailer + Mailgun SMTP
- **Calendar**: ical-generator

### MCP Servers
- **SQLite MCP** - Database operations
- **Playwright MCP** - Website fetching and markdown conversion
- *Future*: Custom MCPs for specific sites if needed
- *Future*: API MCPs (Ticketmaster, Eventbrite) only if needed

### Node.js Scripts (Infrastructure)
- `scripts/init-db.js` - Database initialization
- `scripts/build.js` - Build main script
- `scripts/setup-build.js` - Build setup assistant
- `scripts/init.js` - Initialize .env file

### File Structure
```
data/
  user-preferences.md        # Natural language interests + location
  sources.json               # List of website URLs to monitor
  eventfinder.db            # SQLite database
  schema.sql                # Database schema

src/
  context.md                # LLM execution context
  script.md                 # Main script logic
  mcp.json                  # MCP server configurations
  templates/
    extract-events-from-markdown.md
    match-event-to-preferences.md
    email-digest.html
    email-digest.txt
  commands/
    discover-events.md      # Main workflow command
```

---

## Development Phases

### Phase 0: Foundation ✅ COMPLETE
- Project structure
- Build system
- Setup assistant
- Planning documents

### Phase 1: Database & Preferences (1-2 weeks)
- SQLite schema
- MCP server setup
- User preferences file
- Source management (manual)

### Phase 2: Event Discovery (1 week)
- Playwright MCP integration
- Event extraction from markdown
- LLM-based relevance matching
- Store in database

### Phase 3: Email Digest (1 week)
- iCal generation
- Email templates
- Mailgun integration
- End-to-end workflow

### Phase 4: Polish & Refinement (1 week)
- Update detection
- Error handling
- Documentation
- Testing

### Phase 5: Automation Research (1-2 weeks)
- Research Claude Code headless
- Research Claude API
- Research Android automation
- Implement chosen approach

### Phase 6+: Advanced Features
- Feedback loop / learning
- Multi-user support
- API integrations (if needed)
- Web UI (far future)

---

## Critical Success Factors

### For MVP Success
1. User can describe interests in natural language
2. LLM accurately matches events to preferences
3. Email digest arrives with working calendar invites
4. Duplicates are properly detected
5. Setup takes < 30 minutes

### For Long-term Success
1. Automation works reliably on Android
2. Feedback loop improves recommendations
3. Handles 90%+ of event sources without manual config
4. Zero maintenance once configured

---

## Risk Mitigation

### Technical Risks
- **Playwright MCP complexity**: Start with simple sites, iterate
- **Token usage for matching**: Acceptable for quality, monitor costs
- **Email deliverability**: Mailgun sandbox handles this professionally

### User Experience Risks
- **Setup complexity**: Guided setup assistant addresses this
- **Too many irrelevant events**: LLM matching + feedback loop addresses this
- **Missing important events**: User can adjust preferences over time

### Operational Risks
- **Gmail ban**: Eliminated by using Mailgun
- **Service dependencies**: All have free tiers or alternatives
- **Android process killing**: Manual trigger works around this for MVP

---

## Next Steps

1. ✅ All questions decided
2. ⏳ Update technical-design.md with decisions
3. ⏳ Update workplan.md to reflect scoping
4. ⏳ Create user-preferences.md template
5. ⏳ Begin Phase 1 implementation

---

## Quick Reference

| Question | Decision | Phase |
|----------|----------|-------|
| Scheduling | Manual → Automation research | 1-3, then 5 |
| Web Fetching | Playwright MCP + WebFetch | 1-3 |
| Database | SQLite MCP + Node.js setup | 1 |
| Parsing | MCP→markdown, LLM→JSON | 2 |
| Matching | LLM-based with preferences.md | 2 |
| Email Format | Multipart HTML+text | 3 |
| Updates | Defer to Phase 4 | 4 |
| Timezones | Store IANA, display local | 2 |
| APIs | Only if needed (Phase 4+) | 4+ |
| MVP | Manual workflow, basic features | 1-3 |
| Email Sending | Mailgun sandbox (5k/mo) | 3 |

---

**Document Status**: Finalized
**Ready for**: Implementation Phase 1
