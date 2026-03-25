# Test Source Command

Test if a URL has extractable events without adding it to your sources.

## Workflow

1. **Prompt for URL** if not provided
2. **Fetch and analyze:**
   - Use Playwright MCP to fetch page
   - Convert to markdown
   - Attempt event extraction with LLM
3. **Display results:**
   - Number of events found
   - Sample events with details
   - Page structure analysis
   - Extraction confidence
4. **Provide recommendations:**
   - Whether this source is suitable
   - Any issues detected
   - Suggested frequency for checking

## Usage

```
/test-source https://example.com/events
```

Interactive:
```
/test-source
```

## Output

```
Testing: https://example.com/events

✓ Successfully fetched page (2.3s)
✓ Converted to markdown (1,245 words)

Event Extraction Results:
Found: 8 events
Confidence: High

Sample Events:
1. Oct 15, 7:00 PM - "Jazz Night with The Quartet"
   Venue: Main Stage
   Price: $25

2. Oct 18, 8:30 PM - "Comedy Show"
   Venue: Comedy Club
   Price: Free

3. Oct 22, 6:00 PM - "Art Exhibition Opening"
   Venue: Gallery
   Price: Free

Page Analysis:
- Platform: Squarespace
- Structure: Chronological list
- Pagination: None detected
- Dynamic content: Yes (JavaScript)

Recommendation: ✓ Suitable for monitoring
- Clear event structure
- Consistent data fields
- Regular updates expected
- Suggested check frequency: Daily

Add this source? Run: /add-source https://example.com/events
```
