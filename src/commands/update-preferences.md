# Update Preferences Command

Edit your event preferences and interests.

## Workflow

1. **Load current preferences** from `data/user-preferences.md`
2. **Display current preferences:**
   - Show formatted content
   - Highlight key sections (location, interests, exclusions)
3. **Offer edit options:**
   - Open in editor
   - Quick add interests
   - Quick add exclusions
   - Update location
4. **Save changes** to `data/user-preferences.md`
5. **Show summary** of what changed

## Usage

Interactive edit:
```
/update-preferences
```

Quick add interest:
```
/update-preferences --add-interest "indie rock concerts"
```

Update location:
```
/update-preferences --location "Calgary, AB"
```

## Output

```
Current Preferences:

Location: Calgary, AB
Interests:
- Live music (jazz, indie, folk)
- Comedy shows
- Art exhibitions and gallery openings
- Craft workshops (pottery, woodworking)

Exclusions:
- Sports events
- Children's events

Options:
1. Edit in full (opens editor)
2. Add interest
3. Add exclusion
4. Update location
5. View only
6. Cancel

Select option: 2

Enter new interest: electronic music festivals

✓ Added "electronic music festivals" to interests
✓ Updated data/user-preferences.md

Tip: Run /discover-events to find events matching your new preferences
```

## File Format

The preferences file uses natural language:

```markdown
# My Event Preferences

## Location
I live in Calgary, AB, Canada (Mountain Time - America/Edmonton).

## Interests
I'm interested in:
- Live music, especially jazz, indie rock, and folk
- Comedy shows and stand-up
- Art exhibitions and gallery openings
- Craft workshops like pottery, candle making, woodworking

## Not Interested
I'm not interested in:
- Sports events
- Children's events
- Large festivals (prefer intimate venues)

## Additional Context
I prefer events under $50 and weekday evenings work best for me.
```
