# EventFinder Setup Script

## ASK

Guide the user through configuring EventFinder, including obtaining API keys, setting up OAuth tokens, and configuring MCP servers.

## Instructions

### 1. Welcome and Overview

Start by welcoming the user and explaining the setup process:
- What will be configured
- Why each service is useful
- That all configurations are optional
- That they can run setup again later to add more services

### 2. Check Current Configuration

Read the `.env` file (located at `../../.env` relative to setup/build/):
- If `.env` doesn't exist, inform the user to run `npm run init` first
- Parse the file to identify configured vs unconfigured services
- Look for placeholder values like `your_api_key_here`

### 3. Present Status

Show a clear status of all configuration items:
```
Configuration Status:
✓ EXAMPLE_API_KEY - Configured
✗ GOOGLE_CLIENT_ID - Not configured
✗ TICKETMASTER_API_KEY - Not configured
...
```

### 4. Interactive Configuration

For each unconfigured service, in order of priority:

#### Priority Order:
1. **Ticketmaster API** (easiest, most useful for events)
2. **Eventbrite API** (easy, good for local events)
3. **Google OAuth2** (more complex, for calendar integration)
4. **Custom MCP servers** (advanced)

#### For Each Service:

**Step A: Ask if they want to configure it**
```
Would you like to configure [Service Name]?
- Purpose: [What it's used for]
- Difficulty: [Easy/Medium/Complex]
- Link: [Signup URL]

Type 'yes' to configure, 'skip' to skip for now, or 'info' for more details.
```

**Step B: If user says yes, provide detailed instructions**
- Read from the appropriate guide file (`guides/[service]-api.md`)
- Present step-by-step instructions
- Include all necessary URLs
- Explain what to look for on each page

**Step C: Wait for credentials**
```
Once you have your [credential name], paste it here and I'll update your .env file.
(Type 'back' to skip this service)
```

**Step D: Validate format (if possible)**
- Check if the value looks valid (length, format, no placeholder text)
- Warn if it looks suspicious
- Don't actually test API calls (save that for the main app)

**Step E: Write to .env**
- Read the current .env file
- Replace the placeholder with the actual value
- Write back to the file
- Confirm success

**Step F: Move to next service**
- Show updated status
- Continue to next unconfigured service

### 5. MCP Server Configuration

After API keys, ask about MCP servers:
```
Would you like to configure custom MCP servers?
MCP servers extend EventFinder's capabilities with additional tools and data sources.

Common examples:
- Database connections
- Custom APIs
- File system access
- Specialized search tools

Type 'yes' to configure, 'no' to skip.
```

If yes:
- Read the current `src/mcp.json` file
- Guide through adding/editing MCP server definitions
- Reference `guides/mcp-setup.md` for instructions
- Update `src/mcp.json` with new configurations

### 6. Final Summary

Present a summary of what was configured:
```
✅ Setup Complete!

Configured:
✓ Ticketmaster API
✓ Eventbrite API

Skipped:
- Google OAuth2
- Custom MCP servers

Your EventFinder is ready to use!

Next steps:
1. Run 'npm run build' to build the main script
2. Run 'cd build && claude-code' to start finding events
3. Run 'npm run setup' again anytime to add more services
```

### 7. Offer Additional Help

Ask if they need help with:
- Testing their configuration
- Understanding what each service provides
- Troubleshooting any issues
- Running the main EventFinder script

## Important Guidelines

### Be Patient and Clear
- Don't rush through multiple configurations at once
- Explain technical terms
- Provide context for why each step is needed

### Handle Errors Gracefully
- If .env file can't be read/written, explain the issue
- Suggest fixes (permissions, file location)
- Offer to retry

### Security Reminders
- Remind users that .env is gitignored
- Never expose actual credentials in output
- Explain that credentials are stored locally only

### Support Iteration
- Users can exit and return later
- Configuration is incremental
- No need to complete everything at once

## File Paths

Remember that when this script runs from `setup/build/`, paths are:
- User's .env file: `../../.env`
- Source mcp.json: `../../src/mcp.json`
- Guide files: `./guides/` (copied to setup/build/guides/)
