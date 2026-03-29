# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

**No Python.** This is a Node.js project. Never use `python3`, `python`, or any Python script — not inline, not ad-hoc, not for "quick" data manipulation. Use `node -e` or add a file to `scripts/`. A hook will block Python commands.

**No ad-hoc scripts for workflow steps.** When running `/discover-events` or any other slash command, follow the instructions in `src/commands/` exactly. Do not write one-off scripts to replace workflow steps. If a session was interrupted, check DB state and resume from the correct step per the workflow's "Resuming" section.

## Project Overview

EventFinder is an intelligent, automated event discovery and notification system that monitors websites for events, matches them to your interests using LLM-based relevance scoring, and sends daily email digests with calendar invites.

**What it does**:
- Monitors configured websites (via Playwright MCP) for new events
- Uses LLM to extract event data from markdown-converted pages
- Matches events to natural language user preferences
- Sends daily email digest with 2 iCal attachments per event (ticket sale reminder + event date)
- Tracks everything in SQLite to avoid duplicate notifications

**Architecture**:
EventFinder is an LLM script package designed to be authored in `src/` and built into an executable LLM agent environment in `build/`.

The key distinction:
- This CLAUDE.md helps develop/maintain the package itself
- `src/context.md` defines the execution context for the LLM running the script (becomes `build/CLAUDE.md`)

**Planning Documentation**: See `planning/` directory for comprehensive design docs:
- `planning/overview.md` - Vision and use cases
- `planning/requirements.md` - Detailed feature requirements
- `planning/technical-design.md` - Architecture and implementation details
- `planning/questions.md` - All design decisions with rationale
- `planning/DECISIONS.md` - **Quick reference for all key decisions**
- `planning/workplan-mvp.md` - Phased implementation roadmap (MVP)

## Development Commands

### Initial Setup
```bash
npm install          # Install dependencies
npm run init         # Create .env from template
npm run setup        # Launch guided setup assistant (LLM)
node scripts/init-db.js  # Initialize SQLite database (run once after init)
```

### Build System
```bash
npm run build        # Build main script: src/ → build/
npm run setup:build  # Build setup assistant: setup/src/ → setup/build/
npm run clean        # Remove build artifacts
```

### Running Scripts
```bash
npm run setup               # Run guided setup assistant
cd build && claude-code     # Execute the main EventFinder script
node scripts/test-mailgun.js  # Test Mailgun SMTP connectivity
```

### Development Iteration Loop
```bash
# Edit source → rebuild → test
nano src/script.md           # or src/context.md, src/commands/*.md, etc.
npm run build
cd build && claude-code
```

## Architecture

### Source Structure (`src/`)
- `context.md` - LLM execution context (builds to `build/CLAUDE.md`)
- `script.md` - Main script instructions for the LLM to follow
- `mcp.json` - MCP server definitions (builds to `build/.mcp.json`)
- `context/` - Additional context files (domain knowledge, examples, constraints)
- `templates/` - Reusable prompt templates
- `commands/` - Slash command definitions (builds to `build/.claude/commands/`)

### Build Output (`build/`)
The build process transforms the source structure into an LLM-executable environment:
- Files are copied to appropriate locations (`.mcp.json`, `.claude/commands/`)
- `context.md` becomes the execution context (`CLAUDE.md`)
- All resources are positioned for optimal LLM consumption

### Setup Assistant (`setup/`)
A separate LLM script package that guides users through configuration:
- `setup/src/context.md` - Setup assistant's execution context
- `setup/src/script.md` - Interactive configuration workflow
- `setup/src/guides/` - Step-by-step API setup guides
- Builds to `setup/build/` and runs via `npm run setup`

### Configuration Files
- `.env.template` - Template for environment variables
- `.env` - User's API keys and configuration (gitignored, created by `npm run init`)
- `src/mcp.json` - MCP server definitions

**Important**: When adding a new MCP server to `src/mcp.json`, also create a corresponding setup guide in `setup/src/guides/` explaining how to obtain credentials, configure the server, and test the integration.

**Note**: The `.env.template` file contains placeholder variables from early planning (Ticketmaster, Eventbrite, Google OAuth). The actual deployed stack uses only Mailgun SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `EMAIL_TO`).

### Data Files (`data/`)
- `user-preferences.md` - Natural language description of user interests and location
- `sources.json` - List of website URLs to monitor for events
- `eventfinder.db` - SQLite database (events, sources metadata, sent digests)
- `schema.sql` - Database schema definition

### MCP Servers (`mcp-servers/`)
- `smtp-email/` - Custom MCP server for sending digest emails
  - Reads `.env` for SMTP credentials (agent never sees them)
  - Provides `send_digest_email` and `test_smtp_connection` tools
  - Generates iCal attachments (event date + ticket sale date) via `ical-generator`
  - Configured in `src/mcp.json` (builds to `build/.mcp.json`)
  - Has its own `package.json`; run `npm install` inside `mcp-servers/smtp-email/` if needed

### Design Philosophy
- **Separation of concerns**: Development context vs execution context
- **Version control**: Only `src/` and `setup/src/` are tracked, `build/` is generated
- **Authoring first**: Structure optimized for human editing, built for LLM execution
- **Modularity**: Context, scripts, templates, and commands are organized separately
- **Self-documenting**: The setup assistant is itself an LLM script that guides configuration
- **MCP-first**: Use MCP servers for infrastructure (SQLite, Playwright, SMTP)
- **Security-first**: Agent has capabilities (MCP tools), not credentials (.env)
- **LLM orchestration**: LLM extracts events from markdown, matches to preferences, generates emails

## Key Technical Decisions

For detailed rationale, see `planning/DECISIONS.md`. Quick summary:

**Infrastructure**:
- **Database**: SQLite via MCP server (runtime), Node.js scripts (schema setup)
- **Web Fetching**: Playwright MCP (converts to markdown), WebFetch (simple fetches)
- **Email**: Custom SMTP MCP server (Mailgun backend, 100 emails/day free)
- **Calendar**: ical-generator integrated in SMTP MCP server

**LLM Workflow**:
- **Event Extraction**: MCP fetches page → markdown → LLM extracts JSON (template: `src/templates/extract-events-from-markdown.md`)
- **Relevance Matching**: LLM reads `data/user-preferences.md` + event → decides relevance (pure LLM, no scoring algorithm — understands context like "The National" = band)
- **Digest**: LLM generates HTML + plain text email, calls `send_digest_email` tool with structured event data

**Database**:
- Schema: 4 tables (`sources`, `events`, `event_instances`, `sent_events`) + 3 views (`v_sources_stats`, `v_unsent_upcoming_events`, `v_last_digest`)
- Deduplication: `event_hash` = hash(title + venue)
- Default timezone: `America/Edmonton` (overridable per-instance)

**MVP Scope (Phase 1-3)**:
- Manual trigger (`/discover-events` command)
- Edit files directly (`user-preferences.md`, `sources.json`)
- Playwright MCP handles all websites (RSS is just structured HTML)
- Mailgun sandbox for safe email sending (no Gmail ban risk, 5k emails/month)
- Single user, daily workflow

**Deferred to Later**:
- Automation (Phase 5 - research needed)
- `/add-site` wizard (Phase 3)
- Update detection (Phase 4)
- Feedback loop / learning (Phase 6+)
- Multi-user support (Phase 6+)
