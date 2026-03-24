# EventFinder Workflow Guide

This document explains the complete workflow for setting up, developing, and running EventFinder.

## User Workflow (First Time Setup)

### 1. Install and Initialize
```bash
git clone <repo>
cd eventfinder
npm install
npm run init
```

**Result**: `.env` file created from template

### 2. Configure (Two Options)

#### Option A: Guided Setup (Recommended)
```bash
npm run setup
```

This launches an LLM assistant that:
- Checks your current configuration
- Guides you through getting API keys
- Helps set up OAuth tokens (like Google Calendar)
- Configures MCP servers
- Updates your `.env` and `src/mcp.json` files

**Behind the scenes**:
1. `npm run setup:build` builds the setup assistant from `setup/src/` → `setup/build/`
2. Launches Claude Code in `setup/build/` directory
3. The setup LLM reads your `.env` and guides you interactively

#### Option B: Manual Configuration
```bash
# Edit .env directly
nano .env

# Add your API keys
TICKETMASTER_API_KEY=abc123...
EVENTBRITE_API_TOKEN=xyz789...
# etc.
```

### 3. Build and Run
```bash
npm run build
cd build
claude-code
```

**Behind the scenes**:
1. `npm run build` copies files from `src/` → `build/`
2. `src/context.md` becomes `build/CLAUDE.md` (execution context)
3. `src/mcp.json` becomes `build/.mcp.json` (MCP config)
4. Commands, templates, and context files are copied to proper locations
5. Running Claude Code in `build/` executes the EventFinder agent

## Developer Workflow (Package Development)

### Modifying the Main EventFinder Script

**Update execution context**:
```bash
nano src/context.md      # What the LLM knows about its role
npm run build
cd build && claude-code
```

**Update script logic**:
```bash
nano src/script.md       # Step-by-step instructions for the LLM
npm run build
cd build && claude-code
```

**Add domain knowledge**:
```bash
nano src/context/domain.md       # Add event types, categories, etc.
npm run build
cd build && claude-code
```

**Add prompt templates**:
```bash
nano src/templates/new-template.md
npm run build
cd build && claude-code
```

**Add slash commands**:
```bash
nano src/commands/new-command.md
npm run build
# Now /new-command will be available in build/
```

### Modifying the Setup Assistant

**Update setup logic**:
```bash
nano setup/src/script.md       # Change setup workflow
npm run setup                  # Builds and runs automatically
```

**Update API guides**:
```bash
nano setup/src/guides/ticketmaster-api.md
npm run setup
```

**Add new service guides**:
```bash
nano setup/src/guides/new-service.md
# Update setup/src/script.md to reference it
npm run setup
```

## File Transformation Map

### Main Script Build (`npm run build`)
```
src/context.md              → build/CLAUDE.md
src/script.md               → build/script.md
src/mcp.json                → build/.mcp.json
src/context/*.md            → build/context/*.md
src/templates/*.md          → build/templates/*.md
src/commands/*.md           → build/.claude/commands/*.md
```

### Setup Assistant Build (`npm run setup:build`)
```
setup/src/context.md        → setup/build/CLAUDE.md
setup/src/script.md         → setup/build/script.md
setup/src/guides/*.md       → setup/build/guides/*.md
```

## Key Concepts

### Separation of Contexts

**Development Context** (`CLAUDE.md` at root)
- For developers working on the EventFinder package
- Describes architecture, build system, how to modify scripts
- You're reading this in the development context

**Execution Context** (`src/context.md` → `build/CLAUDE.md`)
- For the LLM running the EventFinder script
- Describes the LLM's role as an event finder
- Contains domain knowledge, examples, constraints

**Setup Context** (`setup/src/context.md` → `setup/build/CLAUDE.md`)
- For the LLM running the setup assistant
- Describes how to guide users through configuration
- Contains API setup guides

### Why This Structure?

**For Users**:
- Simple workflow: `init` → `setup` → `build` → run
- Guided configuration via LLM assistant
- No need to read complex documentation

**For Developers**:
- Clear separation: development vs execution
- Easy to modify: edit source, rebuild, test
- Version controlled: only source files tracked
- Modular: context, scripts, templates, commands separate

**For LLMs**:
- Optimized contexts: each LLM gets exactly what it needs
- No confusion: development docs don't leak into execution
- Self-documenting: setup assistant helps with configuration

## Common Tasks

### Re-run Setup to Add More Services
```bash
npm run setup
# The assistant will check what's configured and offer to add more
```

### Test a Change to the Main Script
```bash
nano src/script.md
npm run build
cd build && claude-code
# Test your changes
```

### Update API Configuration
```bash
nano .env              # Edit directly
# or
npm run setup          # Use guided assistant
```

### Add a New MCP Server
```bash
nano src/mcp.json      # Add server definition
npm run build
# or use the setup assistant
npm run setup
# Choose "Configure MCP servers"
```

### Share Your Configuration Template
```bash
# .env is gitignored, but you can update the template
nano .env.template
git add .env.template
git commit -m "Add new API option to template"
```

## Debugging

### Setup Assistant Not Working
```bash
# Build and check for errors
npm run setup:build

# Manually run in setup/build/
cd setup/build
claude-code
```

### Main Script Not Working
```bash
# Check build output
npm run build

# Verify files in build/
ls -la build/
ls -la build/.claude/commands/

# Check CLAUDE.md is correct
cat build/CLAUDE.md
```

### Environment Variables Not Loading
```bash
# Verify .env exists and has values
cat .env | grep -v "^#" | grep -v "^$"

# Check .mcp.json uses correct variable names
cat src/mcp.json
cat build/.mcp.json
```

## Best Practices

### Version Control
- Commit: `src/`, `setup/src/`, `.env.template`, `scripts/`
- Ignore: `build/`, `setup/build/`, `.env`, `node_modules/`

### Configuration
- Use `.env` for secrets (API keys, tokens)
- Use `src/mcp.json` for MCP server definitions
- Reference env vars in mcp.json: `${VARIABLE_NAME}`

### Development
- Edit source files, never build files
- Test changes: edit → build → run
- Keep context files focused and concise
- Use templates for reusable prompts

### User Experience
- Recommend guided setup for new users
- Provide manual setup option for advanced users
- Keep setup guides up-to-date with API changes
- Test the setup flow regularly
