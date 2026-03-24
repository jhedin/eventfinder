# EventFinder

[![GitHub](https://img.shields.io/badge/GitHub-jhedin%2Feventfinder-blue?logo=github)](https://github.com/jhedin/eventfinder)

An intelligent, automated event discovery and notification system that monitors websites for events, matches them to your interests using LLM-based relevance scoring, and sends daily email digests with calendar invites.

## Overview

EventFinder is structured to separate development concerns from execution concerns:
- **Development context** (root `CLAUDE.md`) - For working on this package
- **Execution context** (`src/context.md` → `build/CLAUDE.md`) - For the LLM running the script

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Configuration
```bash
npm run init
```

This creates a `.env` file from the template.

### 3. Configure API Keys (Recommended)

**Option A: Guided Setup (Recommended)**
```bash
npm run setup
```

This launches an LLM assistant that will guide you through:
- Obtaining API keys from Ticketmaster, Eventbrite, etc.
- Setting up Google OAuth2 for calendar integration
- Configuring MCP servers
- Testing your configuration

**Option B: Manual Setup**
Edit `.env` and add your API keys manually. See `.env.template` for available options.

### 4. Build the Package
```bash
npm run build
```

This compiles `src/` into `build/` with the proper file structure for LLM execution.

### 5. Run the Script
```bash
cd build
claude-code
```

The LLM will now operate with the execution context and script instructions.

## Development

### Project Structure

```
eventfinder/
├── CLAUDE.md              # Development context for this package
├── .env.template          # Environment variable template
├── .env                   # Your API keys (gitignored, created by npm run init)
├── package.json           # Build system and dependencies
├── scripts/
│   ├── init.js            # Initialize .env from template
│   ├── build.js           # Build main script
│   └── setup-build.js     # Build setup assistant
├── src/                   # Main EventFinder script source
│   ├── context.md         # Execution context (→ build/CLAUDE.md)
│   ├── script.md          # Main LLM script instructions
│   ├── mcp.json           # MCP server definitions (→ build/.mcp.json)
│   ├── context/           # Additional context files
│   │   ├── domain.md      # Domain knowledge about events
│   │   ├── examples.md    # Example queries and responses
│   │   └── constraints.md # System constraints and requirements
│   ├── templates/         # Reusable prompt templates
│   │   ├── search-query.md
│   │   └── result-format.md
│   └── commands/          # Slash commands (→ build/.claude/commands/)
│       └── search.md
├── setup/                 # Setup assistant LLM script
│   └── src/
│       ├── context.md     # Setup assistant context
│       ├── script.md      # Setup instructions
│       └── guides/        # API setup guides
│           ├── google-oauth.md
│           ├── ticketmaster-api.md
│           ├── eventbrite-api.md
│           └── mcp-setup.md
├── build/                 # Generated main script (gitignored)
│   └── [execution environment]
└── setup/build/           # Generated setup assistant (gitignored)
    └── [setup environment]
```

### Build System

The build process:
1. Creates necessary directory structure in `build/`
2. Copies `context.md` → `CLAUDE.md`
3. Copies `mcp.json` → `.mcp.json`
4. Copies `script.md` and all context files
5. Copies `commands/` → `.claude/commands/`

### Available Scripts

```bash
npm run init         # Create .env from template
npm run setup        # Launch guided setup assistant (LLM)
npm run clean        # Remove build artifacts
npm run build        # Build the main EventFinder script
npm run setup:build  # Build the setup assistant (run automatically by setup)
```

## Modifying the Script

### Update Execution Context
Edit `src/context.md` to change what the LLM knows about its role and available resources.

### Update Script Logic
Edit `src/script.md` to modify the step-by-step instructions the LLM follows.

### Add Context
Add new files to `src/context/` for domain knowledge, examples, or constraints.

### Add Templates
Create reusable prompt templates in `src/templates/`.

### Add MCP Servers
Edit `src/mcp.json` to configure external tools and APIs.

### Add Slash Commands
Add markdown files to `src/commands/` - they become slash commands in the built environment.

## Configuration

### Environment Variables

EventFinder supports the following API integrations (all optional):

- **Ticketmaster API** - Concert, sports, and major event data
- **Eventbrite API** - Local events, meetups, and workshops
- **Google Calendar API** - Calendar integration (requires OAuth2)
- **Custom MCP Servers** - Extend with your own tools and APIs

See `.env.template` for all available configuration options.

### Running the Setup Assistant

The guided setup assistant is itself an LLM script that helps you:

1. **Check configuration status** - See what's configured and what's missing
2. **Get API keys** - Step-by-step guides for each service
3. **Set up OAuth** - Detailed instructions for Google OAuth2
4. **Configure MCP** - Add custom MCP servers
5. **Test configuration** - Verify your setup works

The assistant interacts with your `.env` file and `src/mcp.json` to configure everything.

## Testing

After building, test by running Claude Code in the `build/` directory and providing sample queries:
- "Find me concerts in Seattle this weekend"
- "When is the next Lakers game?"
- "Free outdoor events in Denver next month"

## Troubleshooting

### "Please run npm run init first"
You need to create the `.env` file before running setup or build.

### API Keys Not Working
- Verify you copied the complete key with no extra spaces
- Check that the key is active in the provider's dashboard
- Ensure you're not exceeding rate limits

### Setup Assistant Won't Launch
- Make sure you've run `npm install`
- Check that `claude-code` is available in your PATH
- Try running `npm run setup:build` separately to see build errors

## License

MIT
