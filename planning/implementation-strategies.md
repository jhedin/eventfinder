# Implementation Strategies

This document outlines specific strategies for handling complex scenarios during EventFinder implementation and execution.

## Context Window Management

### Problem
When bootstrapping (first run or adding new source), pages might have 50+ events, creating markdown that exceeds LLM context limits.

### Strategy: Markdown Truncation with Self-Correction

**Approach:**
1. Truncate Playwright markdown to first 100KB (configurable)
2. LLM extracts whatever events fit in context
3. Accept that first run might be incomplete
4. Subsequent runs catch new events added at top of page
5. Over time, all events get discovered

**Rationale:**
- Most event sites list newest/upcoming events first
- We care about upcoming events more than far-future ones
- System self-corrects naturally over multiple runs
- Simple implementation, no complex pagination logic

**Configuration:**
```bash
# In .env or config
MAX_MARKDOWN_LENGTH=100000  # 100KB default
```

**Implementation Notes:**
```javascript
// Pseudo-code
let markdown = await playwright_mcp.fetch(url);
if (markdown.length > MAX_MARKDOWN_LENGTH) {
  markdown = markdown.substring(0, MAX_MARKDOWN_LENGTH);
  log.warn(`Truncated markdown for ${url} (${markdown.length} chars)`);
}
// Continue with LLM extraction
```

**Edge Cases:**
- If page has 100+ events, might take several runs to catch all
- If events are chronologically ordered (oldest first), might miss newest
- Solution: If extraction returns 0 events after truncation, try full markdown once

**Alternative for Future:**
If truncation proves problematic, implement pagination detection:
1. LLM identifies "Next Page" / "Load More" buttons
2. Playwright clicks them
3. Process pages sequentially
4. Defer to Phase 4+

---

## Duplicate Detection with LLM Fuzzy Matching

### Problem
Event identity isn't always clear:
- Title variations: "Christmas Tea" vs "Christmas Afternoon Tea"
- Venue variations: "The Palomino" vs "Palomino Smokehouse"
- Date changes: Event rescheduled by a day
- Hash-based deduplication misses these as separate events

### Strategy: LLM-Assisted Fuzzy Matching

**Approach:**
Before inserting a new event into database:

1. **Generate initial hash** (for exact duplicate check):
   ```javascript
   event_hash = hash(normalize(title) + normalize(venue))
   ```

2. **Check for exact duplicate**:
   ```sql
   SELECT * FROM events WHERE event_hash = ?
   ```
   - If found: Skip (already have this exact event)
   - If not found: Continue to fuzzy check

3. **Query for similar events**:
   ```sql
   SELECT e.*, ei.instance_date
   FROM events e
   JOIN event_instances ei ON e.id = ei.event_id
   WHERE e.venue LIKE '%{venue_keyword}%'
     AND ei.instance_date BETWEEN date(?, '-3 days') AND date(?, '+3 days')
   LIMIT 10
   ```
   Where `venue_keyword` is main word from venue (e.g., "Palomino" from "The Palomino")

4. **LLM Fuzzy Match Decision**:
   ```
   Prompt:
   "New event from source:
   - Title: 'Christmas Afternoon Tea'
   - Venue: 'Lougheed House'
   - Date: 2025-11-30

   Similar events already in database:
   1. Title: 'Christmas Tea', Venue: 'Lougheed House', Date: 2025-11-30
   2. Title: 'Holiday Tea Service', Venue: 'Lougheed House', Date: 2025-12-01

   Is the new event the same as any existing event? Return JSON:
   {
     'is_duplicate': true/false,
     'matching_event_id': number or null,
     'reason': 'explanation'
   }
   "
   ```

5. **Act on decision**:
   - If `is_duplicate: true`: Skip insertion, log reason
   - If `is_duplicate: false`: Insert new event

**LLM Strengths:**
- Understands semantic similarity ("Christmas Tea" = "Christmas Afternoon Tea")
- Can reason about venue variations
- Understands date proximity (rescheduling)
- Provides explanation for decisions

**Performance Considerations:**
- Fuzzy check only runs if exact hash doesn't match
- Limited to 10 similar events per check (keeps prompt small)
- Date range ±3 days keeps search space small
- Venue keyword match reduces false candidates

**Hash Normalization Function:**
```javascript
function normalize(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')  // Remove special chars
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .normalize('NFD')              // Decompose accents
    .replace(/[\u0300-\u036f]/g, ''); // Remove accent marks
}

// Examples:
// "The Palomino" → "the palomino"
// "Café Deux" → "cafe deux"
// "Jazz  Night!" → "jazz night"
```

**Example Scenarios:**

**Scenario 1: Title variation (duplicate)**
```
New: "Christmas Afternoon Tea" at "Lougheed House" on Nov 30
DB:  "Christmas Tea" at "Lougheed House" on Nov 30

LLM Response:
{
  "is_duplicate": true,
  "matching_event_id": 42,
  "reason": "Same event - afternoon tea service at same venue on same date. Title variation includes 'Afternoon' but refers to same offering."
}
→ Skip insertion
```

**Scenario 2: Venue variation (duplicate)**
```
New: "Jazz Night" at "Palomino Smokehouse" on Oct 15
DB:  "Jazz Night" at "The Palomino" on Oct 15

LLM Response:
{
  "is_duplicate": true,
  "matching_event_id": 38,
  "reason": "Same event - 'The Palomino' and 'Palomino Smokehouse' are the same venue, just different name formats."
}
→ Skip insertion
```

**Scenario 3: Different events (not duplicate)**
```
New: "Holiday Tea Service" at "Lougheed House" on Dec 1
DB:  "Christmas Tea" at "Lougheed House" on Nov 30

LLM Response:
{
  "is_duplicate": false,
  "matching_event_id": null,
  "reason": "Different events - while both are tea services at same venue, they're on different dates (Nov 30 vs Dec 1) and may have different themes/menus."
}
→ Insert new event
```

**Scenario 4: Rescheduled event (duplicate)**
```
New: "Concert" at "The Palace" on Oct 16
DB:  "Concert" at "Palace Theatre" on Oct 15

LLM Response:
{
  "is_duplicate": true,
  "matching_event_id": 55,
  "reason": "Likely same event rescheduled - same venue (Palace Theatre), same artist, date shifted by one day. Venue name variation ('The Palace' vs 'Palace Theatre')."
}
→ Skip insertion
```

**Edge Cases:**

**Multiple matches found:**
- LLM picks most likely match
- If uncertain, marks as `is_duplicate: false` to avoid losing events
- Logs uncertainty for manual review

**No similar events in DB:**
- Skip fuzzy check entirely
- Insert directly (only exact hash was checked)

**LLM is uncertain:**
```json
{
  "is_duplicate": false,
  "matching_event_id": null,
  "reason": "Uncertain - events are similar but dates differ enough that these might be separate instances. Marking as unique to avoid missing an event."
}
```
- Default to "not duplicate" when uncertain
- Better to have potential duplicate than miss an event

**Performance Monitoring:**
- Log all fuzzy match decisions
- Track false positives (missed events) vs false negatives (duplicates sent)
- Tune venue keyword matching and date range based on results

---

## Database Query Optimization

### Problem
Querying for similar events needs to be fast even with thousands of events in database.

### Strategy: Indexed Queries

**Required Indexes** (already in schema.sql):
```sql
CREATE INDEX idx_events_venue ON events(venue);
CREATE INDEX idx_instances_date ON event_instances(instance_date);
```

**Optimized Similar Events Query:**
```sql
-- Fast query using indexes
SELECT
  e.id,
  e.title,
  e.venue,
  e.event_hash,
  ei.instance_date,
  ei.instance_time
FROM events e
JOIN event_instances ei ON e.id = ei.event_id
WHERE
  e.venue LIKE ?                                    -- Index on venue
  AND ei.instance_date BETWEEN ? AND ?              -- Index on instance_date
  AND e.id NOT IN (
    SELECT event_id FROM sent_events WHERE status = 'sent'
  )
LIMIT 10;
```

**Query Parameters:**
- `venue LIKE '%palomino%'` - Extracts key venue word
- `instance_date BETWEEN date(?, '-3 days') AND date(?, '+3 days')` - ±3 day window
- `LIMIT 10` - Prevents huge result sets

**Performance Expectations:**
- With indexes: <10ms even with 10k events
- Without indexes: Could be seconds with large database

---

## Error Recovery Strategies

### Scenario: Invalid Date Extracted

**Problem:**
```json
{
  "instances": [{"date": "2025-02-30"}]  // Feb 30 doesn't exist
}
```

**Strategy: Validation Layer**
```javascript
function validateEvent(event) {
  for (let instance of event.instances) {
    // Validate date
    const date = new Date(instance.date);
    if (isNaN(date.getTime())) {
      return {valid: false, error: `Invalid date: ${instance.date}`};
    }

    // Validate time if present
    if (instance.time && !/^\d{2}:\d{2}:\d{2}$/.test(instance.time)) {
      return {valid: false, error: `Invalid time format: ${instance.time}`};
    }
  }
  return {valid: true};
}

// Usage:
const validation = validateEvent(extractedEvent);
if (!validation.valid) {
  log.error(`Skipping invalid event: ${validation.error}`);
  continue; // Skip this event, continue with others
}
```

**Action on Invalid Event:**
- Log error with source URL and event data
- Skip event (don't insert to database)
- Continue processing other events
- Don't fail entire source check

### Scenario: Source Returns 0 Events

**Problem:** Is this an error or just an empty calendar?

**Strategy: Error Classification**
```javascript
if (extractedEvents.length === 0) {
  // Check if page had content
  if (markdown.length < 500) {
    // Very short page - probably error
    error_type = 'parse_error';
    error_message = 'Page too short, likely failed to load';
  } else if (markdown.includes('no events') || markdown.includes('coming soon')) {
    // Legitimate empty calendar
    error_type = 'no_events';
    error_message = 'Source has no current events';
    // Don't increment consecutive_failures
  } else {
    // Page has content but LLM found nothing
    error_type = 'extraction_failed';
    error_message = 'Could not extract events from page content';
  }
}
```

**Different Treatment:**
- `parse_error` / `extraction_failed`: Increment consecutive_failures
- `no_events`: Don't increment failures (legitimate state)

### Scenario: Partial Page Load

**Problem:** Playwright returns incomplete markdown (JavaScript didn't finish).

**Strategy: Content Verification**
```javascript
// Check for expected page elements
function verifyPageLoad(markdown, sourceUrl) {
  // Look for indicators of full load
  const hasFooter = markdown.toLowerCase().includes('footer') ||
                    markdown.toLowerCase().includes('copyright');
  const hasMinimumContent = markdown.length > 1000;

  if (!hasFooter && !hasMinimumContent) {
    return {
      loaded: false,
      reason: 'Page appears incomplete (no footer, short content)'
    };
  }

  return {loaded: true};
}
```

**Action on Incomplete Load:**
- Mark as error (increment failures)
- Don't process partial content (might extract garbage)
- Log for debugging

---

## Category Classification

### Problem
Email groups events by category, but LLM might classify inconsistently.

### Strategy: Predefined Category List

**Standard Categories:**
```javascript
const CATEGORIES = {
  'music': {
    icon: '🎵',
    keywords: ['concert', 'band', 'music', 'jazz', 'rock', 'performance']
  },
  'comedy': {
    icon: '🎭',
    keywords: ['comedy', 'stand-up', 'comedian', 'improv']
  },
  'workshop': {
    icon: '🎨',
    keywords: ['workshop', 'class', 'lesson', 'learn', 'craft']
  },
  'art': {
    icon: '🖼️',
    keywords: ['gallery', 'exhibition', 'art', 'museum', 'opening']
  },
  'food': {
    icon: '🍴',
    keywords: ['food', 'dinner', 'tasting', 'culinary', 'restaurant']
  },
  'sports': {
    icon: '⚽',
    keywords: ['game', 'match', 'sports', 'tournament']
  },
  'other': {
    icon: '📅',
    keywords: []
  }
};
```

**LLM Categorization Prompt:**
```
Given this event, assign ONE category from this list:
- music: Concerts, live music, bands, performances
- comedy: Stand-up, improv, comedy shows
- workshop: Classes, workshops, lessons, hands-on activities
- art: Galleries, exhibitions, museums, art shows
- food: Food events, tastings, dinners, culinary experiences
- sports: Sports games, matches, tournaments
- other: Anything that doesn't fit above categories

Event: {title} at {venue}
Description: {description}

Return JSON: {"category": "music"}
```

**Fallback Logic:**
If LLM returns invalid category or no category:
```javascript
function assignCategory(event, llmCategory) {
  // Validate LLM response
  if (CATEGORIES[llmCategory]) {
    return llmCategory;
  }

  // Fallback: keyword matching
  const text = `${event.title} ${event.description}`.toLowerCase();
  for (let [category, config] of Object.entries(CATEGORIES)) {
    if (config.keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }

  // Final fallback
  return 'other';
}
```

---

## Email Attachment Limits

### Problem
Many events = many iCal files. Email clients might reject too many attachments.

### Strategy: Combined iCal Files

**Instead of:**
- event1.ics, tickets1.ics
- event2.ics, tickets2.ics
- ... (16 files for 8 events)

**Use:**
- events-digest-2025-10-07.ics (all event reminders)
- tickets-digest-2025-10-07.ics (all ticket sale reminders)

**Single iCal File Format:**
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EventFinder//EN

BEGIN:VEVENT
UID:event1@eventfinder
SUMMARY:Event 1
...
END:VEVENT

BEGIN:VEVENT
UID:event2@eventfinder
SUMMARY:Event 2
...
END:VEVENT

END:VCALENDAR
```

**Benefits:**
- 2 attachments total (regardless of event count)
- Better email client compatibility
- Smaller email size
- Easier to import (one click)

**Naming:**
- `events-{YYYY-MM-DD}.ics` - All event reminders for this digest
- `tickets-{YYYY-MM-DD}.ics` - All ticket sale reminders for this digest

---

## Summary: Implementation Checklist

Before starting implementation, ensure:

- [ ] Hash normalization function defined
- [ ] Fuzzy match LLM prompt written
- [ ] Validation functions for dates/times
- [ ] Category classification list finalized
- [ ] Combined iCal generation approach confirmed
- [ ] Error classification logic defined
- [ ] Context window truncation value set
- [ ] Database indexes created (from schema.sql)
- [ ] Logging strategy for debugging

These strategies address the most likely pain points during development and execution.
