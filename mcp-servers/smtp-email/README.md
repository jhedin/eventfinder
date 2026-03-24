# EventFinder SMTP Email MCP Server

**Purpose**: Send digest emails with iCal attachments, keeping SMTP credentials secure from the LLM agent.

## Security Model

- **Agent**: Never sees SMTP credentials
- **MCP Server**: Reads `.env` from project root
- **Tools**: Agent calls `send_digest_email`, server handles credentials

## Installation

```bash
cd mcp-servers/smtp-email
npm install
```

## Configuration

Add to `src/mcp.json` (agent's MCP config):

```json
{
  "mcpServers": {
    "smtp-email": {
      "command": "node",
      "args": ["./mcp-servers/smtp-email/index.js"]
    }
  }
}
```

This MCP server reads credentials from `.env` in project root:

```bash
# .env (not accessible to agent)
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@sandboxXXX.mailgun.org
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=postmaster@sandboxXXX.mailgun.org
EMAIL_TO=your-email@gmail.com
```

## Tools Provided

### `send_digest_email`

Send digest email with HTML, plain text, and iCal attachments.

**Parameters**:
- `to` (string): Recipient email (optional, defaults to EMAIL_TO from .env)
- `subject` (string): Email subject
- `html` (string): HTML email body
- `text` (string): Plain text email body
- `events` (array): Events with instances for iCal generation

**Example**:
```javascript
{
  "to": "user@example.com",
  "subject": "8 New Events (Oct 15 - Nov 22)",
  "html": "<h1>Music 🎵</h1>...",
  "text": "# Music\n...",
  "events": [
    {
      "title": "Jazz Night",
      "venue": "Blue Note",
      "description": "Live jazz performance",
      "event_url": "https://example.com/event",
      "ticket_url": "https://tickets.com/",
      "instances": [
        {
          "date": "2025-10-15",
          "time": "20:00:00",
          "end_date": "2025-10-15",
          "ticket_sale_date": "2025-10-01",
          "ticket_sale_time": "09:00:00"
        }
      ]
    }
  ]
}
```

**Returns**:
```json
{
  "success": true,
  "messageId": "<abc@mailgun.org>",
  "events_count": 8,
  "attachments": ["events-2025-10-09.ics", "tickets-2025-10-09.ics"]
}
```

### `test_smtp_connection`

Test SMTP configuration without sending email.

**Example**:
```javascript
{}
```

**Returns**:
```json
{
  "success": true,
  "message": "SMTP connection verified successfully",
  "config": {
    "host": "smtp.mailgun.org",
    "port": "587",
    "from": "postmaster@sandboxXXX.mailgun.org"
  }
}
```

## iCal Generation

### Event Reminders
- File: `events-YYYY-MM-DD.ics`
- Alarms: 1 day before, 3 hours before
- Includes: Title, venue, description, URL

### Ticket Sale Reminders
- File: `tickets-YYYY-MM-DD.ics`
- Alarm: Day of (morning)
- Only created if `ticket_sale_date` is set

## Usage in Slash Commands

```markdown
# In src/commands/discover-events.md

After matching events to preferences, send the digest:

Use smtp-email MCP tool `send_digest_email`:

{
  "to": "user@gmail.com",
  "subject": "8 New Events",
  "html": "<html>...</html>",
  "text": "Plain text version",
  "events": [...]
}
```

## Testing

```bash
# Test SMTP connection
echo '{"method":"tools/call","params":{"name":"test_smtp_connection","arguments":{}}}' | node index.js

# Send test email (requires proper JSON)
node test-send.js
```

## Security Benefits

✅ **Agent never sees**:
- SMTP host
- SMTP port
- SMTP username
- SMTP password
- Email credentials

✅ **Agent only calls**:
- `send_digest_email(to, subject, html, text, events)`
- Returns success/failure

✅ **Works with**:
- Claude Code (cloud)
- Claude API (cloud)
- Local LLMs (future)

## Troubleshooting

**"Missing required environment variable"**:
- Check `.env` exists in project root (2 levels up from this directory)
- Verify all required variables are set

**"SMTP connection failed"**:
- Verify SMTP credentials in `.env`
- Run `test_smtp_connection` tool
- Check Mailgun sandbox is set up correctly

**"Agent can't find smtp-email MCP"**:
- Verify `src/mcp.json` includes this server
- Rebuild with `npm run build`
- Check `build/.mcp.json` contains the server config

## Development

To modify this MCP server:

1. Edit `index.js`
2. Test with `node index.js`
3. Rebuild project: `npm run build`
4. Agent automatically uses updated version

## Future Enhancements

- [ ] Support CC/BCC
- [ ] Email templates
- [ ] Batch sending
- [ ] Retry logic
- [ ] Rate limiting
- [ ] Email validation
- [ ] Attachment size limits
