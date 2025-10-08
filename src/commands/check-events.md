# Check Events Command

Display what new events were found without generating or sending an email.

## Workflow

1. **Run event discovery:**
   - Check all sources
   - Extract events
   - Match to preferences
2. **Query database:**
   - Compare with previously sent events
   - Identify new vs already notified
3. **Display results:**
   - List new matched events
   - Show statistics
   - Indicate which events are truly new

## Usage

```
/check-events
```

With filters:
```
/check-events --new-only
/check-events --source "The Palomino"
/check-events --from 2025-10-15
```

## Output

```
Checking for new events...

✓ Checked 23 sources
✓ Found 45 total events
✓ Matched 8 events to your preferences

New Events (not yet sent):

🎵 Jazz Night with The Quartet
📅 Oct 15, 7:00 PM | 📍 The Palomino
💵 $25 | Source: https://thepalomino.ca/live-events/
Status: ✨ NEW

🎭 Comedy Show featuring Local Comics
📅 Oct 18, 8:30 PM | 📍 Commonwealth Bar
💵 Free | Source: https://www.commonwealthbar.ca/events
Status: ✨ NEW

🎨 Ceramic Workshop
📅 Oct 20, 2:00 PM | 📍 Workshop Studios
💵 $85 | Source: https://workshopstudios.ca/ceramics/
Status: ✨ NEW

[5 more new events...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
Total events found: 45
Matched to preferences: 8
Already sent: 0
New to send: 8

Next steps:
- Run /preview-digest to see email preview
- Run /discover-events to send digest
```

## Options

- `--new-only` - Show only events not yet sent
- `--all` - Show all events including previously sent
- `--source URL` - Filter by specific source
- `--from DATE` - Events starting from date
- `--to DATE` - Events until date
