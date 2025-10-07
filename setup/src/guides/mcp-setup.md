# MCP Server Setup Guide

## Overview

MCP (Model Context Protocol) servers extend EventFinder's capabilities by connecting to external tools, databases, and APIs. They allow the LLM to access resources beyond what's built into the core script.

**Difficulty**: Medium to Advanced
**Cost**: Varies by service

## What are MCP Servers?

MCP servers are standalone services that provide tools the LLM can call. Think of them as plugins or extensions.

### Common Use Cases:

- **Database access**: Query your event database
- **Custom APIs**: Connect to proprietary event sources
- **File system**: Read/write event data locally
- **Web scraping**: Extract event data from websites
- **Third-party services**: Integrate with CRM, analytics, etc.

## MCP Configuration File

EventFinder's MCP servers are defined in `src/mcp.json`. When you build the project, this becomes `build/.mcp.json` which Claude Code reads.

### Configuration Format

```json
{
  "mcpServers": {
    "server-name": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

## Types of MCP Servers

### 1. HTTP MCP Servers

Connect to remote servers via HTTP/HTTPS.

```json
{
  "mcpServers": {
    "my-api": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${MY_API_TOKEN}",
        "X-Custom-Header": "value"
      }
    }
  }
}
```

**Environment variables** like `${MY_API_TOKEN}` are loaded from your `.env` file.

### 2. Command-line MCP Servers

Run local programs or scripts as MCP servers.

```json
{
  "mcpServers": {
    "local-scraper": {
      "type": "stdio",
      "command": "python",
      "args": ["/path/to/mcp_server.py"],
      "env": {
        "CONFIG_PATH": "/path/to/config.json"
      }
    }
  }
}
```

### 3. Pre-built MCP Servers

Many ready-to-use MCP servers exist:

- **@modelcontextprotocol/server-filesystem** - File system access
- **@modelcontextprotocol/server-github** - GitHub integration
- **@modelcontextprotocol/server-postgres** - PostgreSQL database
- **@modelcontextprotocol/server-sqlite** - SQLite database

Example using a pre-built server:

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-filesystem",
        "/path/to/event/data"
      ]
    }
  }
}
```

## Step-by-Step Setup

### For HTTP MCP Servers

1. **Obtain API credentials**
   - Sign up for the MCP service
   - Get your API key or token
   - Note the server URL

2. **Add to .env**
   ```
   MY_MCP_SERVER_TOKEN=your_token_here
   ```

3. **Update src/mcp.json**
   ```json
   {
     "mcpServers": {
       "my-server": {
         "type": "http",
         "url": "https://mcp.example.com",
         "headers": {
           "Authorization": "Bearer ${MY_MCP_SERVER_TOKEN}"
         }
       }
     }
   }
   ```

4. **Rebuild**
   ```bash
   npm run build
   ```

### For Command-line MCP Servers

1. **Install the server**
   ```bash
   npm install -g @modelcontextprotocol/server-filesystem
   # or install locally in your project
   ```

2. **Configure in src/mcp.json**
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "type": "stdio",
         "command": "npx",
         "args": [
           "@modelcontextprotocol/server-filesystem",
           "./event-data"
         ]
       }
     }
   }
   ```

3. **Rebuild**
   ```bash
   npm run build
   ```

## Testing MCP Configuration

After configuring and building:

1. **Run EventFinder**
   ```bash
   cd build && claude-code
   ```

2. **Check available tools**
   The LLM will have access to tools provided by your MCP servers

3. **Test a tool**
   Ask the LLM to use a tool from your MCP server

## Common MCP Servers for Events

### Database Servers

If you're storing events in a database:

**PostgreSQL**:
```json
{
  "postgres": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "@modelcontextprotocol/server-postgres",
      "postgresql://user:pass@localhost/events"
    ]
  }
}
```

**SQLite**:
```json
{
  "sqlite": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "@modelcontextprotocol/server-sqlite",
      "/path/to/events.db"
    ]
  }
}
```

### Web Scraping

For custom event sources:
```json
{
  "scraper": {
    "type": "stdio",
    "command": "python",
    "args": ["./scripts/event_scraper.py"]
  }
}
```

## Security Considerations

### Sensitive Credentials
- Always use environment variables for API keys
- Never hardcode credentials in mcp.json
- Keep .env out of version control (already gitignored)

### Server Trust
- Only connect to MCP servers you trust
- Verify HTTPS certificates for remote servers
- Be cautious with stdio servers that execute code

### Permissions
- Limit filesystem access to necessary directories only
- Use read-only database credentials when possible
- Follow the principle of least privilege

## Troubleshooting

### "MCP server not found"
- Check that the command/path is correct
- Ensure the server is installed
- Verify environment variables are set

### "Connection failed"
- Verify the URL is correct
- Check network connectivity
- Ensure API credentials are valid

### "Permission denied"
- Check file/directory permissions
- Verify the command is executable
- Ensure paths are accessible

### Tools not appearing
- Rebuild after changing mcp.json
- Check Claude Code output for errors
- Verify server is responding correctly

## Documentation

- [MCP Specification](https://modelcontextprotocol.io/)
- [Claude Code MCP Docs](https://docs.claude.com/en/docs/claude-code/mcp)
- [Pre-built MCP Servers](https://github.com/modelcontextprotocol/servers)

## Advanced: Creating Your Own MCP Server

If you need custom functionality, you can create your own MCP server:

1. Follow the [MCP Server Development Guide](https://modelcontextprotocol.io/docs/creating-servers)
2. Implement your custom tools
3. Deploy as HTTP server or CLI tool
4. Configure in EventFinder's mcp.json

Example tools you might create:
- Custom event database queries
- Integration with calendar systems
- Event recommendation algorithms
- Social media event discovery
- Venue availability checking
