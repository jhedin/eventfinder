# Search Query Template

Use this template structure for constructing event search queries.

## Template Variables

- `{{location}}` - City, venue, or region
- `{{date_start}}` - Start of date range (ISO 8601 format)
- `{{date_end}}` - End of date range (ISO 8601 format)
- `{{event_type}}` - Category or type of event
- `{{keywords}}` - Specific search terms (artist, team, topic)
- `{{price_min}}` - Minimum price (or 0 for free)
- `{{price_max}}` - Maximum price
- `{{radius}}` - Search radius from location (in miles/km)

## Query Structure

```
Search for {{event_type}} events
Location: {{location}} (within {{radius}} miles)
Date range: {{date_start}} to {{date_end}}
Keywords: {{keywords}}
Price range: ${{price_min}} - ${{price_max}}
```

## Example Usage

```
Search for music events
Location: Austin, TX (within 25 miles)
Date range: 2025-10-01 to 2025-10-31
Keywords: indie, rock
Price range: $0 - $50
```

## Notes

- All variables are optional except `{{location}}` or `{{event_type}}`
- Date defaults to next 3 months if not specified
- Price defaults to all price ranges if not specified
- Radius defaults to city limits if not specified
