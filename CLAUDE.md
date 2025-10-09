# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `planning/workplan.md` - Phased implementation roadmap

## Development Commands

### Initial Setup
```bash
npm install          # Install dependencies
npm run init         # Create .env from template
npm run setup        # Launch guided setup assistant (LLM)
```

### Build System
```bash
npm run build        # Build main script: src/ → build/
npm run setup:build  # Build setup assistant: setup/src/ → setup/build/
npm run clean        # Remove build artifacts
```

### Running Scripts
```bash
npm run setup        # Run guided setup assistant
cd build && claude-code  # Execute the main EventFinder script
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

**Important**: When adding a new MCP server to `src/mcp.json`, also create a corresponding setup guide in `setup/src/guides/` explaining how to:
- Register for the service
- Obtain API keys/credentials
- Configure the MCP server
- Test the integration

### Data Files (`data/`)
- `user-preferences.md` - Natural language description of user interests and location
- `sources.json` - List of website URLs to monitor for events
- `eventfinder.db` - SQLite database (events, sources metadata, sent digests)
- `schema.sql` - Database schema definition

### Design Philosophy
- **Separation of concerns**: Development context vs execution context
- **Version control**: Only `src/` and `setup/src/` are tracked, `build/` is generated
- **Authoring first**: Structure optimized for human editing, built for LLM execution
- **Modularity**: Context, scripts, templates, and commands are organized separately
- **Self-documenting**: The setup assistant is itself an LLM script that guides configuration
- **MCP-first**: Use MCP servers for infrastructure (SQLite, Playwright), Node.js only for setup
- **LLM orchestration**: LLM extracts events from markdown, matches to preferences, generates emails

## Key Technical Decisions

For detailed rationale, see `planning/DECISIONS.md`. Quick summary:

**Infrastructure**:
- **Database**: SQLite via MCP server (runtime), Node.js scripts (schema setup)
- **Web Fetching**: Playwright MCP (converts to markdown), WebFetch (simple fetches)
- **Email**: SendGrid SMTP (free tier, 100 emails/day) via Nodemailer
- **Calendar**: ical-generator for iCal attachments

**LLM Workflow**:
- **Event Extraction**: MCP fetches page → markdown → LLM extracts JSON
- **Relevance Matching**: LLM reads `data/user-preferences.md` + event → decides relevance
- **No scoring algorithm**: Pure LLM-based matching (understands context like "The National" = band)

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
