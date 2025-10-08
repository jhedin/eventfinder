# Add Directory Command

Extract all venue/event links from a directory page and add them as individual sources.

## Workflow

1. **Prompt for directory URL** if not provided
2. **Fetch the directory page:**
   - Use Playwright MCP to get the page
   - Convert to markdown
3. **Extract venue links:**
   - Use LLM to identify all venue/event calendar URLs
   - Filter out non-event links (about pages, contact, etc.)
4. **Test each link:**
   - Try to extract events from each URL
   - Mark as working/non-working
5. **Show results:**
   - Display all found links with their status
   - Show sample events from working sources
6. **Confirm bulk add:**
   - User can select which sources to add (all working, specific ones, etc.)
7. **Update sources.json:**
   - Add selected sources with metadata

## Usage

With URL:
```
/add-directory https://visitcalgary.com/music-venues
```

Interactive:
```
/add-directory
```
(Will prompt for URL)

## Output

```
Analyzing directory: https://visitcalgary.com/music-venues

Found 21 venue links:
✓ The Palomino (12 events found)
✓ Commonwealth Bar (8 events found)
✗ Gravity Calgary (404 error)
✓ King Eddy (15 events found)
...

Working sources: 15/21 (71%)

Add all working sources? (yes/no/select): yes

✓ Added 15 sources to sources.json
Total sources: 30
```

## Advanced Options

- `--test-only` - Just test links, don't add anything
- `--auto-add` - Automatically add all working sources without confirmation
- `--min-events N` - Only add sources with at least N events found
