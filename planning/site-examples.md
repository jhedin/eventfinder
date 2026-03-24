# Event Site Examples

This document captures examples of event websites we need to support, analyzing their structure, data, and extraction challenges.

## 1. Lougheed House - https://www.lougheedhouse.com/events

**Platform**: Squarespace

**Event Structure**:
- Simple chronological list (6 events visible)
- No pagination or filtering
- Grid-based layout with images

**Event Types**:
- Long-running exhibitions: "A House of Story" (Sept 11 - Nov 16)
- Multi-day special events: "Superstitions & Secrets" (Oct 16-24)
- Single-day events: Halloween Afternoon Tea (Oct 25), Murder Mystery Dinner (Oct 25)
- Recurring events: Christmas Afternoon Tea (Nov 30, Dec 7, Dec 21)

**Data Fields Available**:
- ✅ Title
- ✅ Date(s) - various formats (single day, date ranges, multiple specific dates)
- ✅ Time
- ✅ Price
- ✅ Description (brief)
- ✅ "Learn More" links (to detail pages)
- ✅ Images

**Extraction Challenges**:
- Date format variations (single, range, list of dates)
- Recurring vs one-time vs long-running events need different handling
- Squarespace JavaScript rendering
- Need to follow "Learn More" links for full details?

**Key Dates Extracted**:
1. "A House of Story": Sept 11 - Nov 16 (exhibition)
2. "Superstitions & Secrets": Oct 16-24 (multi-day)
3. Halloween Afternoon Tea: Oct 25 (single day)
4. Murder Mystery Dinner: Oct 25 (single day)
5. "Our Women in Khaki": Nov 8 (single day)
6. Christmas Afternoon Tea: Nov 30, Dec 7, Dec 21 (recurring)

**Ticket Prices**: Present but specific values not captured in initial fetch

---

## 2. Visit Calgary Music Venues - https://www.visitcalgary.com/things-to-do/stories-from-calgary/best-live-music-venues-in-calgary

**Type**: Venue directory (not event listing)
**Platform**: Tourism guide

**Purpose**: Guide to Calgary music venues, categorized by type

**Event Data**: ❌ None - this is venue information only

**Individual Venue Event Pages**:

### Restaurants & Bars with Music:
1. The Palomino Smokehouse - https://thepalomino.ca/
2. Commonwealth Bar & Stage - https://www.commonwealthbar.ca/
3. Gravity Espresso & Wine Bar - https://www.cafegravity.com/music
4. Ironwood Stage & Grill - http://ironwoodstage.ca/
5. King Eddy - https://kingeddy.ca/
6. Mikey's Juke Joint & Eatery - https://mikeysjukejoint.com/
7. Prairie Dog Brewing - https://prairiedog.bbq.beer/events-activities/live-music/
8. Ranchman's Cookhouse & Dancehall - https://www.ranchmans.ca
9. Whiskey Rose - https://whiskeyrosesaloon.com/
10. The Blues Can - https://www.thebluescan.com/

### Concert Venues:
11. The Palace Theatre - https://www.thepalacetheatre.ca/
12. Bella Concert Hall - https://www.mtroyal.ca/mrevents/Find-a-Venue/bella-concert-hall.htm
13. Grey Eagle Event Centre - https://www.greyeagleresortandcasino.ca/events/
14. Jack Singer Concert Hall - https://artscommons.ca/rentals/venues/jack-singer-concert-hall/
15. MacEwan Hall - https://www.machallconcerts.com/
16. Scotiabank Saddledome - http://www.scotiabanksaddledome.com/
17. Southern Alberta Jubilee Auditorium - https://www.jubileeauditorium.com/calgary

### Intimate Venues:
18. Studio Bell - http://www.studiobell.ca/
19. Festival Hall - https://www.calgaryfolkfest.com/festival-hall
20. Knox United Church - http://kxcalgary.com/
21. Lantern Community Church - http://lanternchurch.com/

**Implications for EventFinder**:
- This directory provides **21 individual venue websites** to potentially monitor
- Each venue likely has its own event listing format
- Good test of EventFinder's ability to handle diverse website structures

---

## 3. Avenue Calgary Craft Workshops - https://www.avenuecalgary.com/things-to-do/where-to-take-a-craft-workshop-in-calgary/

**Type**: Venue/business directory (not event listing)
**Platform**: City lifestyle magazine

**Purpose**: Guide to craft workshop venues in Calgary

**Workshop Types**: Candle making, woodworking, glass work, beadwork, moccasin making, tufting, knitting, ceramics, terrarium building, wreath making

**Event Data**: ❌ None - business descriptions only

**Individual Workshop/Class Pages**:
1. The Apothecary - https://the-apothecary.ca/classes-and-workshops
2. Black Forest Wood Company - https://blackforestwood.com/pages/workshops-full-list
3. Field Kit Studio - https://www.fieldkit.studio/workshop
4. Milk Jar Candle Co. - https://milkjar.ca/workshop-calendar
5. Moonstone Creation - https://moonstonecreation.ca/learn-with-us/
6. Passion for Glass Gallery & Studio - https://www.passionforglass.ca/workshops
7. Plant Plant - https://plantplantshop.ca/workshops/
8. Stash - https://www.stashlounge.com/collections/classes
9. Tuft Love Studios - https://www.tuftlovestudios.ca/services
10. Workshop Studios - https://workshopstudios.ca/ceramics/

**Implications for EventFinder**:
- This directory provides **10 individual workshop businesses** to potentially monitor
- Many craft workshops likely have recurring classes rather than one-time events
- Class schedules may follow different patterns than traditional events

---

## 4. Eventbrite Calgary - https://www.eventbrite.com/d/canada--calgary/all-events/

**Type**: Event aggregator/marketplace
**Platform**: Eventbrite (major ticketing platform)

**Event Organization**:
- Chronological listing
- 20-25 events per page
- 49 total pages
- Pagination with Previous/Next

**Data Fields Available**:
- ✅ Title
- ✅ Date and time
- ✅ Location/venue (with geolocation)
- ✅ Price
- ✅ Image
- ✅ Category tags (Business, Music, Sports, etc.)
- ✅ Event format (Conference, Festival, etc.)
- ✅ Organizer
- ✅ Summary/description
- ✅ Ticket URL (direct to purchase)

**Filtering/Sorting**:
- ✅ Category filters
- ✅ Event format filters
- ✅ Price filter (Free events)
- ✅ Date filters (Today, Tomorrow, This weekend, etc.)

**Sample Events**:
1. "The Journey Within" - Meditation event, Oct 14, 2025
2. "Rusko - Calgary" - Music/EDM event, Oct 18, 2025
3. "Yaqeen Canada Tour" - Religious event, Oct 11, 2025

**Extraction Challenges**:
- ⚠️ Heavily JavaScript-rendered (client-side rendering)
- ⚠️ Complex dynamic loading
- ⚠️ No schema.org or JSON-LD structured data visible
- ⚠️ 49 pages = ~1000+ events (pagination handling needed)

**Advantages**:
- ✅ Comprehensive event data
- ✅ Consistent structure across all events
- ✅ Already aggregated from multiple sources
- ✅ Direct ticket purchase links
- ✅ Rich filtering/categorization

**API Alternative**:
- Eventbrite has an official API (mentioned in .env.template)
- API would be cleaner than scraping
- Requires API key (free tier available)

**Recommendation**: Consider Eventbrite API instead of scraping for MVP

---

## Open Questions (to add to planning/questions.md)

### Q12: Recurring Event Handling
How should we handle recurring events (e.g., "Christmas Tea on Nov 30, Dec 7, Dec 21")?

**Options**:
1. Store as single event with multiple dates, send one notification with all dates
2. Store as separate event instances, send notification per occurrence
3. Hybrid: Store together but allow separate calendar invites per date

**Considerations**:
- User preference: Do they want to know "this event happens multiple times" or treat each separately?
- Calendar invites: Likely want separate invites for each date
- Relevance matching: Once per event type or per occurrence?

**Recommendation**: TBD after more examples

### Q13: Long-Running Events (Exhibitions)
How should we handle long-running events like exhibitions that span weeks/months?

**Options**:
1. Single notification at start date
2. Single notification with reminder option
3. Treat start date as "event date", end date as metadata
4. Multiple notifications (start, midpoint, ending soon)

**Considerations**:
- User attention: One notification for 2-month exhibition seems sufficient
- Calendar invite: Should span full duration or just opening day?
- Ticket sales: Often no specific date needed

**Recommendation**: TBD after more examples

### Q14: Event Detail Pages
Should we fetch "Learn More" / detail pages for complete event information?

**Options**:
1. Always fetch detail pages if available
2. Only fetch if listing page lacks required fields
3. Let user configure per-source (some sites have full data on listing, others need details)
4. Never fetch details, listing page should be sufficient

**Considerations**:
- Performance: Extra HTTP requests per event
- Data completeness: Detail pages often have full descriptions, ticket links, etc.
- Rate limiting: More requests = higher chance of blocking

**Recommendation**: TBD after analyzing more sites

### Q15: Date Format Variations
How do we handle the variety of date formats across sites?

**Formats seen**:
- Single day: "Oct 25"
- Date range: "Sept 11 - Nov 16"
- Multiple specific dates: "Nov 30, Dec 7, Dec 21"
- Day of week + date: "Friday, October 25"

**Approach**:
- LLM-based extraction (can understand natural language dates)
- Structured prompt asking for ISO dates
- Timezone handling per user location

**Recommendation**: LLM extraction with structured output format (ISO 8601)

### Q16: Ticket Price Extraction
What level of detail do we need for ticket pricing?

**Options**:
1. Exact price: "$25.00"
2. Price range: "$15-25"
3. Price category: "Free", "Paid", "$"
4. Full pricing structure: "Adults $25, Seniors $20, Children $15"

**Considerations**:
- User filtering: Might want "free events only" or "under $50"
- Email display: Show pricing in digest
- Complexity: Full pricing structure is hard to extract consistently

**Recommendation**: TBD - likely price range or category for MVP
