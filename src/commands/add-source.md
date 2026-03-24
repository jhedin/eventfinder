# Add Source Command

Add a single event website or calendar to your monitoring list.

## Workflow

1. **Prompt for URL** if not provided
2. **Test the URL:**
   - Fetch the page using Playwright MCP
   - Convert to markdown
   - Attempt to extract events using LLM
3. **Show preview:**
   - Display number of events found
   - Show sample events (first 3)
4. **Confirm to add:**
   - Ask user if they want to add this source
5. **Add to sources.json:**
   - Append new source to the list
   - Include metadata: URL, name (auto-detected or user-provided), date added

## Usage

With URL:
```
/add-source https://example.com/events
```

Interactive:
```
/add-source
```
(Will prompt for URL)

## Output

```
Testing: https://example.com/events
✓ Found 12 events

Sample events:
- Oct 15: Jazz Night with The Quartet
- Oct 18: Comedy Show featuring Local Comics
- Oct 22: Art Exhibition Opening

Add this source? (yes/no): yes

✓ Added to sources.json
Source name: Example Venue Events
Total sources: 15
```
