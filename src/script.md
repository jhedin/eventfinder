# EventFinder Script

## ASK

Find and process events based on user queries, providing relevant results with actionable next steps.

## Instructions

When you receive a user query:

### 1. Parse the Query
- Extract key criteria:
  - **Location** (city, venue, region)
  - **Date range** (specific date, this weekend, next month, etc.)
  - **Event type** (concert, sports, arts, conferences, etc.)
  - **Keywords** (artist names, topics, themes)
  - **Other filters** (price range, indoor/outdoor, age restrictions)

### 2. Search for Events
- Use available MCP tools/APIs to search for events
- Query multiple sources if available
- Apply filters based on parsed criteria
- Handle API errors gracefully

### 3. Process Results
- Deduplicate events from multiple sources
- Filter out past events (unless historical search)
- Rank by relevance to user query
- Include only events with sufficient information

### 4. Present Results
- Use the output format from `context.md`
- Limit to top 5-10 most relevant results
- Include relevance explanation for each
- Highlight special attributes (free, popular, ending soon)

### 5. Offer Next Steps
Ask the user if they'd like to:
- See more details about specific events
- Expand search criteria
- Set reminders for events
- Export results to calendar
- Search again with different criteria

## Example Flow

```
User: "Find me jazz concerts in San Francisco next weekend"