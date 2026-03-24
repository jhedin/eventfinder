# Remove Source Command

Remove an event source from the monitoring list.

## Workflow

1. **Load sources.json**
2. **Display numbered list** of all sources
3. **Prompt for selection:**
   - By number, or
   - By URL, or
   - By name (fuzzy match)
4. **Show confirmation:**
   - Display source details
   - Ask to confirm removal
5. **Remove from sources.json:**
   - Update the file
   - Keep database records (historical data)

## Usage

Interactive:
```
/remove-source
```

By number (from list-sources):
```
/remove-source 5
```

By URL:
```
/remove-source https://example.com/events
```

By name:
```
/remove-source "Example Venue"
```

## Output

```
Select source to remove:
1. Lougheed House Events
2. The Palomino Live Events
3. Commonwealth Bar Events
...

Enter number, URL, or name: 3

Remove this source?
  Name: Commonwealth Bar Events
  URL: https://www.commonwealthbar.ca/events
  Events found: 47 (all time)

Confirm removal? (yes/no): yes

✓ Removed from sources.json
Historical data preserved in database.
Remaining sources: 22
```

## Options

- `--purge` - Also delete all database records for this source
- `--no-confirm` - Skip confirmation prompt
