# Add Flyer Source

Add a grocery store's flyer page to the monitoring list.

## Workflow

1. **Get URL** from argument or prompt
2. **Check duplicates**: `SELECT id, name FROM sources WHERE url = ?`
3. **Test the URL**: Fetch with `node scripts/fetch-page.js <url>`, extract sample deals using `src/templates/extract-flyers-from-markdown.md`
4. **Preview**: Show store name, flyer period, sample deals (first 5)
5. **Confirm** with user, let them adjust the name
6. **Insert**:
   ```bash
   node scripts/db-query.js "INSERT INTO sources (url, name, description, active, type) VALUES (?, ?, ?, 1, 'flyer') RETURNING id"
   ```

## Usage

```
/add-flyer-source https://www.realcanadiansuperstore.ca/print-flyer
/add-flyer-source
```

## Notes

- Inserts with `type = 'flyer'` — won't appear in event discovery
- For stores on Flipp, consider adding the Flipp merchant ID to `scripts/fetch-flipp-flyers.js` instead
