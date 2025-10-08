# List Sources Command

Display all configured event sources with their status and statistics.

## Workflow

1. **Load sources.json**
2. **Query SQLite database** for statistics per source:
   - Total events found (all time)
   - Events found in last 30 days
   - Last checked timestamp
3. **Display formatted list:**
   - Source name
   - URL
   - Status (active/error)
   - Event count
   - Last checked

## Usage

```
/list-sources
```

With filters:
```
/list-sources --active-only
/list-sources --with-errors
/list-sources --inactive
```

## Output

```
Event Sources (23 total)

✓ Lougheed House Events
  URL: https://www.lougheedhouse.com/events
  Events: 6 found (last 30 days)
  Last checked: 2 hours ago

✓ The Palomino Live Events
  URL: https://thepalomino.ca/live-events/
  Events: 12 found (last 30 days)
  Last checked: 2 hours ago

✗ Gravity Calgary Music
  URL: https://gravitycalgary.com/pages/music
  Error: 404 Not Found (last 2 days)
  Last working: 5 days ago

...

Active: 20
Errors: 3
Total events (30 days): 156
```
