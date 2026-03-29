# Add Flyer Source Command

Add a grocery store's flyer page to your monitoring list.

## Workflow

1. **Prompt for URL** if not provided
2. **Check for duplicates:**
   - Query `SELECT id, name FROM sources WHERE url = ?`
   - If found, report "This source is already being monitored" and stop
3. **Test the URL:**
   - Fetch the page using `node scripts/fetch-page.js <url>`
   - Attempt to extract deals using the flyer extraction template (`src/templates/extract-flyers-from-markdown.md`)
4. **Show preview:**
   - Display store name (auto-detected)
   - Show flyer validity period if found
   - Show number of deals found
   - Show sample deals (first 5)
5. **Confirm to add:**
   - Ask user if they want to add this source
   - Let them adjust the name if the auto-detected one is wrong
6. **Add to database:**
   ```bash
   node scripts/db-query.js "INSERT INTO sources (url, name, description, active, type) VALUES (?, ?, ?, 1, 'flyer') RETURNING id" '"<url>"' '"<name>"' '"<description>"'
   ```

## Usage

With URL:
```
/add-flyer-source https://www.realcanadiansuperstore.ca/print-flyer
```

Interactive:
```
/add-flyer-source
```
(Will prompt for URL)

## Output

```
Testing: https://www.realcanadiansuperstore.ca/print-flyer
Fetching page...
Extracting deals...

✓ Found 42 deals

Store: Real Canadian Superstore
Flyer valid: Mar 27 - Apr 2, 2026

Sample deals:
  🥩 Boneless Chicken Breast — $4.99/lb (reg $7.99)
  🥬 Strawberries 1lb — 2 for $5
  🧀 Marble Cheese 400g — $5.49 (reg $7.99)
  🥩 Atlantic Salmon Fillets — $9.99/lb (reg $13.99)
  🍞 Wonder Bread — $2.49

Add this source? (yes/no): yes

✓ Added to sources (type: flyer)
  Name: Real Canadian Superstore
  ID: 24
```

## Notes

- This inserts with `type = 'flyer'` so the source won't appear in event discovery
- The `/discover-flyers` command only queries sources where `type = 'flyer'`
- If the page is JS-heavy and returns little content, note this in the output and suggest trying the print-friendly or text version of the flyer
