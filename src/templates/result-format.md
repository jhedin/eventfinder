# Result Format Template

Standard format for presenting event search results to users.

## Template Structure

```markdown
## Event Results

Found {{result_count}} {{event_type}} in {{location}} {{date_description}}:

### {{event_name}}
- **Date**: {{formatted_date}} at {{time}} {{timezone}}
- **Location**: {{venue_name}}, {{address}}
- **Category**: {{category}}
- **Description**: {{description}}
- **Price**: {{price_info}}
- **Link**: {{event_url}}

{{relevance_explanation}}

---

[Repeat for each event...]

---

Would you like me to:
- {{action_option_1}}
- {{action_option_2}}
- {{action_option_3}}
```

## Template Variables

### Header Section
- `{{result_count}}` - Number of events found
- `{{event_type}}` - Type of events (concerts, games, etc.)
- `{{location}}` - Search location
- `{{date_description}}` - Human-readable date range ("this weekend", "in November", etc.)

### Event Details
- `{{event_name}}` - Name of the event
- `{{formatted_date}}` - Day of week, Month Day, Year (e.g., "Saturday, Oct 12, 2025")
- `{{time}}` - Event start time (12-hour format)
- `{{timezone}}` - Timezone abbreviation (PST, EST, etc.)
- `{{venue_name}}` - Name of venue
- `{{address}}` - Full address or key location details
- `{{category}}` - Event category/subcategory
- `{{description}}` - Brief event description (1-2 sentences)
- `{{price_info}}` - Price range or "Free"
- `{{event_url}}` - Link to event details or tickets

### Footer Section
- `{{action_option_N}}` - Suggested next actions
- `{{relevance_explanation}}` - Why this event matches the query

## Special Cases

### No Results Found
```markdown
## Event Results

I couldn't find any {{event_type}} in {{location}} {{date_description}}.

**Suggestions:**
- Try broadening your date range
- Check nearby cities: {{nearby_cities}}
- Adjust your search criteria
- Search for related event types: {{related_types}}

Would you like me to search with different criteria?
```

### Too Many Results
```markdown
## Event Results

I found {{result_count}} events matching your criteria. Here are the top {{shown_count}} most relevant:

[Show filtered results...]

**Note**: There are {{additional_count}} more events. Would you like me to:
- Show more results
- Add filters to narrow down (price, venue, date)
- Search more specifically
```

## Example Output

```markdown
## Event Results

Found 3 concerts in Seattle this weekend:

### Indie Rock Night at The Crocodile
- **Date**: Saturday, Oct 12, 2025 at 8:00 PM PDT
- **Location**: The Crocodile, 2200 2nd Ave, Seattle, WA
- **Category**: Music - Rock
- **Description**: Local indie bands featuring headliner The Mountain Goats. All ages welcome.
- **Price**: $25-30
- **Link**: https://example.com/event1

Match: Popular rock venue with touring indie act, perfect for weekend plans.

---

Would you like me to:
- Show more details about any of these events
- Set reminders for specific concerts
- Search for similar events on other dates
```
