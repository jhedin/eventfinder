# Slash Commands Reference

This document defines all slash commands available in EventFinder, their purpose, workflows, and implementation details.

## Command Categories

### Primary Commands
- `/discover-events` - Main workflow: find events and send digest
- `/check-events` - Preview new events without sending
- `/preview-digest` - Generate email preview without sending

### Source Management
- `/add-source` - Add a single event source
- `/add-directory` - Extract and add multiple sources from directory
- `/list-sources` - Display all configured sources
- `/remove-source` - Remove a source from monitoring
- `/test-source` - Test a URL without adding it

### Configuration
- `/update-preferences` - Edit user interests and preferences

---

## Command Specifications

### /discover-events

**Purpose**: Run the main event discovery and email workflow

**Phase**: 1 (MVP Core)

**Dependencies**:
- Playwright MCP (web fetching)
- SQLite MCP (database queries)
- Nodemailer + Mailgun (email)
- ical-generator (calendar invites)

**Workflow**:
1. Load `data/user-preferences.md`
2. Load `data/sources.json`
3. For each source:
   - Fetch page via Playwright MCP → markdown
   - LLM extracts events → JSON array
   - Check SQLite for duplicates
4. LLM matches events to preferences
5. Generate HTML + text email with iCal attachments
6. Send via Mailgun SMTP
7. Update SQLite with sent events

**Output**:
- Sources checked count
- Events found/matched counts
- Email sent confirmation

**Error Handling**:
- Source fetch failures: Log error, continue to next source
- No events found: Send "no new events" summary
- Email send failure: Save digest to file, notify user

---

### /add-source

**Purpose**: Add a single event website to monitoring list

**Phase**: 3 (Source Management)

**Workflow**:
1. Prompt for URL (if not provided as argument)
2. Fetch page via Playwright MCP
3. LLM attempts event extraction
4. Show preview (event count + samples)
5. Confirm with user
6. Append to `data/sources.json` with metadata:
   ```json
   {
     "url": "https://example.com/events",
     "name": "Example Venue Events",
     "added": "2025-10-07T12:00:00Z",
     "active": true
   }
   ```

**Arguments**:
- Optional: URL as first argument

**Output**:
- Test results (events found count)
- Sample events (first 3)
- Confirmation prompt
- Success message with total source count

**Validation**:
- URL format check
- Duplicate URL check
- Minimum 1 event found to add

---

### /add-directory

**Purpose**: Extract venue links from directory page and bulk add

**Phase**: 3 (Source Management)

**Workflow**:
1. Prompt for directory URL
2. Fetch directory page via Playwright MCP
3. LLM extracts all venue/event URLs
4. Test each URL in parallel (up to 5 concurrent)
5. Show results table:
   - URL
   - Status (✓ working / ✗ error)
   - Event count (if working)
6. Prompt: Add all working? / Select specific? / Cancel
7. Bulk append to `data/sources.json`

**Arguments**:
- Optional: `--test-only` (don't add, just test)
- Optional: `--auto-add` (skip confirmation)
- Optional: `--min-events N` (only add if ≥N events)

**Output**:
- Total links found
- Working vs failed breakdown
- Sample events from working sources
- Confirmation prompt
- Success message with added count

**Performance**:
- Parallel testing (5 concurrent max)
- Timeout per source: 30 seconds
- Total timeout: 5 minutes

---

### /test-source

**Purpose**: Test URL for event extraction without adding

**Phase**: 3 (Source Management)

**Workflow**:
1. Prompt for URL
2. Fetch page via Playwright MCP
3. LLM extracts events
4. Analyze page structure
5. Display:
   - Events found (with samples)
   - Page metadata (platform, structure)
   - Extraction confidence level
   - Recommendation (suitable Y/N)
   - Suggested check frequency

**Arguments**:
- Required: URL (or prompt if missing)

**Output**:
```
✓ Successfully fetched (timing)
✓ Converted to markdown (word count)

Events: 8 found (High confidence)
[Sample events listed]

Page Analysis:
- Platform: Squarespace
- Structure: Chronological list
- Pagination: None
- Dynamic: Yes (JavaScript)

Recommendation: ✓ Suitable
Suggested frequency: Daily

Next: /add-source <url>
```

---

### /list-sources

**Purpose**: Display all configured sources with stats

**Phase**: 2 (Event Discovery)

**Workflow**:
1. Load `data/sources.json`
2. Query SQLite for per-source stats:
   - Total events ever
   - Events last 30 days
   - Last checked timestamp
   - Error status
3. Format and display

**Arguments**:
- Optional: `--active-only` (hide errored sources)
- Optional: `--with-errors` (show only errored)
- Optional: `--inactive` (show only inactive)

**Output**:
```
Event Sources (23 total)

✓ Lougheed House Events
  https://www.lougheedhouse.com/events
  Events: 6 (last 30 days)
  Last: 2 hours ago

✗ Gravity Calgary Music
  https://gravitycalgary.com/music
  Error: 404 Not Found (2 days)
  Last working: 5 days ago

Summary:
Active: 20 | Errors: 3
Events (30d): 156
```

**Database Query**:
```sql
SELECT
  source_url,
  COUNT(*) as total_events,
  MAX(checked_at) as last_checked
FROM events
WHERE source_url = ?
GROUP BY source_url
```

---

### /remove-source

**Purpose**: Remove source from monitoring

**Phase**: 3 (Source Management)

**Workflow**:
1. Load `data/sources.json`
2. Display numbered list
3. Prompt for selection (number/URL/name)
4. Show source details + confirm
5. Remove from `data/sources.json`
6. Optionally purge database records

**Arguments**:
- Optional: source identifier (number/URL/name)
- Optional: `--purge` (delete DB records too)
- Optional: `--no-confirm` (skip confirmation)

**Output**:
```
Select source: 3

Remove this source?
  Commonwealth Bar Events
  https://www.commonwealthbar.ca/events
  Events: 47 (all time)

Confirm? yes

✓ Removed from sources.json
Historical data preserved.
Remaining: 22 sources
```

**Data Handling**:
- Default: Keep DB records (historical)
- With `--purge`: Delete all event records for this source

---

### /update-preferences

**Purpose**: Edit user interests and preferences

**Phase**: 1 (MVP Core)

**Workflow**:
1. Load `data/user-preferences.md`
2. Display current preferences
3. Offer options:
   - Full edit (open in editor)
   - Quick add interest
   - Quick add exclusion
   - Update location
4. Save changes
5. Show diff/summary

**Arguments**:
- Optional: `--add-interest "text"`
- Optional: `--add-exclusion "text"`
- Optional: `--location "City, Region"`

**Output**:
```
Current Preferences:

Location: Calgary, AB
Interests:
- Live music (jazz, indie, folk)
- Comedy shows
- Craft workshops

Options:
1. Full edit
2. Add interest
3. Add exclusion
4. Update location

Choice: 2
New interest: electronic music

✓ Added to preferences
✓ Saved to data/user-preferences.md

Run /discover-events to apply
```

**File Format** (Natural Language):
```markdown
# My Event Preferences

## Location
Calgary, AB, Canada (Mountain Time)

## Interests
- Live music: jazz, indie, folk
- Comedy shows and stand-up
- Craft workshops (pottery, woodworking)

## Not Interested
- Sports events
- Children's events

## Additional Context
Prefer events under $50
Weekday evenings work best
```

---

### /preview-digest

**Purpose**: Generate email preview without sending

**Phase**: 2 (Event Discovery)

**Workflow**:
1. Run discovery (same as /discover-events)
2. Generate HTML + text email
3. Generate iCal attachments
4. Display preview (ASCII-rendered)
5. Offer options:
   - Send now
   - Save to file
   - Discard

**Arguments**:
- Optional: `--from DATE`
- Optional: `--to DATE`

**Output**:
```
✓ Found 8 matched events

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL PREVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject: 8 New Events

[ASCII-rendered HTML]

🎵 Jazz Night - Oct 15, 7PM
📍 The Palomino | 💵 $25
[Details...]

[More events...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Attachments: 8 event + 5 ticket reminders

1. Send now
2. Save (preview.html)
3. Discard

Choice:
```

---

### /check-events

**Purpose**: Show new events without sending email

**Phase**: 2 (Event Discovery)

**Workflow**:
1. Run discovery (same as /discover-events)
2. Match to preferences
3. Check against sent_digests table
4. Display only new events (not yet sent)
5. Show statistics

**Arguments**:
- Optional: `--new-only` (default)
- Optional: `--all` (include previously sent)
- Optional: `--source URL`
- Optional: `--from DATE` / `--to DATE`

**Output**:
```
✓ Checked 23 sources
✓ Found 45 total events
✓ Matched 8 to preferences

New Events (not yet sent):

🎵 Jazz Night - The Palomino
📅 Oct 15, 7PM | 💵 $25
Status: ✨ NEW

🎭 Comedy Show - Commonwealth
📅 Oct 18, 8:30PM | 💵 Free
Status: ✨ NEW

[6 more...]

Summary:
Total: 45 | Matched: 8
Already sent: 0 | New: 8

Next:
- /preview-digest (preview email)
- /discover-events (send)
```

---

## Implementation Priority

### Phase 1 (MVP Core)
1. `/discover-events` - Primary workflow
2. `/update-preferences` - Essential for personalization

### Phase 2 (Discovery Features)
3. `/check-events` - Preview before sending
4. `/preview-digest` - Email preview
5. `/list-sources` - View configured sources

### Phase 3 (Source Management)
6. `/add-source` - Add single source
7. `/test-source` - Test before adding
8. `/add-directory` - Bulk add from directory
9. `/remove-source` - Remove sources

---

## Technical Considerations

### LLM Prompts
Each command needs specific LLM prompts:
- Event extraction (structured JSON output)
- URL extraction from directories
- Relevance matching against preferences
- Page structure analysis

### Database Schema
Commands rely on these tables:
- `sources` - Configured event sources
- `events` - All discovered events
- `sent_digests` - Track what's been sent
- `source_checks` - Track fetch attempts/errors

### Error Handling Patterns
- Source fetch timeout: 30s per source
- Malformed event data: Skip, log warning
- Email send failure: Save to file, notify
- Database errors: Retry once, then fail gracefully

### User Experience
- Show progress for long operations
- Confirmation prompts for destructive actions
- Clear success/error messages
- Helpful next-step suggestions

### Testing Strategy
- Unit test: Each LLM extraction prompt
- Integration test: Full command workflows
- Mock: Playwright MCP, SMTP, SQLite
- Real test: 5-10 actual event sites
