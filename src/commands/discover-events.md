# Discover Events Command

Run the main event discovery workflow to find new events and send the daily digest email.

## Workflow

1. **Load user preferences** from `data/user-preferences.md`
2. **Load event sources** from `data/sources.json`
3. **For each source:**
   - Fetch the page using Playwright MCP (convert to markdown)
   - Extract events using LLM (structured JSON output)
   - Check against SQLite database to avoid duplicates
4. **Match events to preferences:**
   - Use LLM to determine relevance based on user preferences
   - Only keep events that match user interests
5. **Generate email digest:**
   - Create HTML and plain text versions
   - Generate 2 iCal attachments per event:
     - Ticket sale reminder (if available)
     - Event date reminder
6. **Send email** via SendGrid SMTP
7. **Update database** with sent events to prevent duplicates

## Usage

Simply run:
```
/discover-events
```

## Output

The command will show:
- Number of sources checked
- Total events found
- Events matched to preferences
- Email sent confirmation
