# Example Queries and Responses

## Example 1: Simple Location + Type Query

**User Query**: "Find me concerts in Seattle this weekend"

**Parsed Criteria**:
- Location: Seattle, WA
- Date range: This weekend (Saturday-Sunday)
- Event type: Concerts

**Expected Response**:
```markdown
## Event Results

Found 3 concerts in Seattle this weekend:

### Indie Rock Night at The Crocodile
- **Date**: Saturday, Oct 12, 2025 at 8:00 PM PDT
- **Location**: The Crocodile, 2200 2nd Ave, Seattle, WA
- **Category**: Music - Rock
- **Price**: $25-30
- **Link**: https://example.com/event1

Match: Local rock concert matching your weekend criteria.

### Jazz Quartet at Dimitriou's Jazz Alley
- **Date**: Sunday, Oct 13, 2025 at 7:30 PM PDT
- **Location**: Dimitriou's Jazz Alley, 2033 6th Ave, Seattle, WA
- **Category**: Music - Jazz
- **Price**: $35
- **Link**: https://example.com/event2

Match: Weekend jazz performance in downtown Seattle.

[Additional events...]

Would you like me to:
- Show more details about any of these events?
- Expand the search to include nearby cities?
- Filter by price range or venue?
```

## Example 2: Specific Artist Query

**User Query**: "When is Coldplay coming to New York?"

**Parsed Criteria**:
- Keywords: Coldplay
- Location: New York (city or metro area)
- Date range: Future dates

**Expected Response**:
```markdown
## Event Results

Found 2 upcoming Coldplay concerts in the New York area:

### Coldplay: Music of the Spheres Tour
- **Date**: Friday, November 15, 2025 at 7:00 PM EST
- **Location**: Madison Square Garden, New York, NY
- **Category**: Music - Pop/Rock
- **Price**: $85-250
- **Link**: https://example.com/coldplay-msg

Match: Exact artist match at premier NYC venue.

### Coldplay: Music of the Spheres Tour
- **Date**: Saturday, November 16, 2025 at 7:00 PM EST
- **Location**: Madison Square Garden, New York, NY
- **Category**: Music - Pop/Rock
- **Price**: $85-250 (Limited availability)
- **Link**: https://example.com/coldplay-msg-2

Match: Second show, similar details.

Would you like me to:
- Set a reminder for these events?
- Check for additional tour dates in nearby cities?
- Compare ticket prices across vendors?
```

## Example 3: Broad Search with Constraints

**User Query**: "Free outdoor events in Denver next month"

**Parsed Criteria**:
- Location: Denver, CO
- Date range: Next month (November 2025)
- Price: Free
- Setting: Outdoor

**Expected Response**:
Shows filtered results matching all criteria with explanations of why each event qualifies.

## Example 4: Ambiguous Query

**User Query**: "Shows next week"

**Response**:
```markdown
I'd be happy to help you find shows next week! To give you the best results, could you clarify:

1. **What type of shows?** (concerts, theater, comedy, sports, etc.)
2. **Where are you located?** (city or region)
3. **Any preferences?** (price range, specific artists/teams, venue type)

For example: "Comedy shows in Boston next week under $30"
```
