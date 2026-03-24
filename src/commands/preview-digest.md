# Preview Digest Command

Generate and display a preview of the email digest without sending it.

## Workflow

1. **Run event discovery** (same as /discover-events but without sending)
2. **Generate email content:**
   - HTML version
   - Plain text version
   - iCal attachments
3. **Display preview:**
   - Show HTML rendered as text
   - List all events included
   - Show calendar invite details
4. **Offer options:**
   - Send now
   - Save to file
   - Discard

## Usage

```
/preview-digest
```

With date range:
```
/preview-digest --from 2025-10-15 --to 2025-10-30
```

## Output

```
Generating email preview...

✓ Checked 23 sources
✓ Found 45 total events
✓ Matched 8 events to your preferences

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL PREVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject: 8 New Events Matching Your Interests

[HTML Preview - rendered as text]

Your Event Digest for October 15-30

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎵 Jazz Night with The Quartet
📅 Oct 15, 7:00 PM
📍 The Palomino, Calgary
💵 $25
🎟️ https://thepalomino.ca/events/jazz-night

A classic jazz evening featuring local quartet...

[View Event] [Add to Calendar]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[7 more events...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Calendar Invites:
- 8 event reminders (.ics)
- 5 ticket sale reminders (.ics)

Options:
1. Send this digest now
2. Save to file (preview.html)
3. Discard

Select option:
```
