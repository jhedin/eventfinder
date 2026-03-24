# EventFinder: Project Overview

## Vision

EventFinder is an intelligent, automated event discovery and notification system that monitors your favorite websites, RSS feeds, and event platforms, then delivers personalized daily digests of events matching your interests directly to your inbox—complete with calendar invites for both ticket sale dates and event dates.

## The Problem

**Current state:**
- Event discovery is fragmented across dozens of websites (venues, promoters, artist pages, Ticketmaster, etc.)
- No single platform aggregates all event sources
- Important events are missed because you don't check every site daily
- Ticket sale dates sneak up on you—by the time you remember, tickets are sold out
- Manually adding events to your calendar is tedious

**What users do now:**
- Manually visit 10-20+ websites daily
- Subscribe to multiple email lists (overwhelming, noisy)
- Set random reminders to check for tickets
- Miss events they would have loved to attend

## The Solution

**EventFinder automates the entire discovery-to-calendar flow:**

### 1. Configure Once
- Add websites/RSS feeds you care about (venues, artist pages, etc.)
- Define your interests (genres, artists, venues, keywords)
- Set your email preferences

### 2. Daily Automated Monitoring
EventFinder runs daily (via cron or scheduler) and:
- Fetches content from all configured sources
- Parses for event information (dates, venues, artists)
- Filters events matching your interests
- Identifies new events you haven't seen before
- Stores everything in a local SQLite database

### 3. Smart Digest Delivery
Every day, you receive a clean email digest containing:
- **New events matching your interests**
- **Event details**: artist, venue, date, time, ticket link
- **Two iCal attachments per event**:
  - 📅 **Ticket Sale Reminder**: Adds to your calendar when tickets go on sale
  - 🎫 **Event Date**: Adds the actual event to your calendar
- One-click add to your preferred calendar app

### 4. Interactive Management
Use slash commands to manage your configuration:
- `/add-site <url>` - Intelligently add a new source (auto-detects RSS vs HTML scraping)
- `/add-interest <keyword>` - Track new artists, genres, venues
- `/test-digest` - Preview what would be sent today
- `/run-now` - Manually trigger event discovery

## Key Features

### Intelligent Source Detection
When you add a site, EventFinder automatically determines:
- Is there an RSS/Atom feed? (preferred)
- What scraping strategy works best?
- How to extract event data (dates, titles, links)

### Interest Matching
Events are scored based on:
- Artist/performer names
- Venue names
- Genre/category tags
- Keywords in event description
- Date ranges (skip events too far out, too soon)

### Duplicate Detection
SQLite tracks:
- Events already discovered (by hash/unique ID)
- Events already sent in digests
- When events were first seen
- Source of each event

### Calendar Integration
- iCalendar (.ics) format compatible with all major calendar apps
- **Two events per show**:
  - Reminder: "Tickets on sale for [Event Name]"
  - Main event: "[Artist] at [Venue]"
- Proper timezone handling
- Rich event details (location, description, URL)

## Use Cases

### Music Fan
*"I want to know when my favorite bands announce shows in my city"*
- Add: Artist websites, venue RSS feeds, Bandsintown
- Interests: Artist names, "indie rock", venue names
- Result: Never miss a show announcement or ticket sale

### Comedy Enthusiast
*"I follow 5 comedy clubs and want to catch specific comedians"*
- Add: Comedy club event pages, comedian tour pages
- Interests: Comedian names, "stand-up comedy"
- Result: Automatic notifications when favorites are scheduled

### Sports Fan
*"I want to attend Lakers games but always forget to buy tickets"*
- Add: Lakers schedule page, Ticketmaster Lakers alerts
- Interests: "Los Angeles Lakers", "Crypto.com Arena"
- Result: Calendar reminders for every ticket sale

### Conference Goer
*"I attend tech conferences but they're announced across random sites"*
- Add: Conference organization sites, industry news feeds
- Interests: "JavaScript", "React", "San Francisco"
- Result: Don't miss CFPs or early-bird registration

## Technical Approach

### Built as an LLM Script Package
EventFinder leverages Claude Code to:
- **Parse unstructured HTML** for event data (LLMs excel at this)
- **Understand context** (is "Friday" this Friday or next?)
- **Match interests intelligently** (recognize that "The National" is a band)
- **Handle edge cases** in date parsing, timezone conversion, etc.

### Runs Locally
- No cloud dependencies (except for sending email)
- Your data stays on your machine
- SQLite for simple, portable storage
- Standard cron for scheduling

### Extensible via MCP
- Add custom event sources via MCP servers
- Integrate with Ticketmaster/Eventbrite APIs
- Connect to calendar APIs beyond email
- Build custom notification channels (SMS, Slack, etc.)

## Success Criteria

**A user should be able to:**
1. Set up EventFinder in under 10 minutes
2. Never manually check event websites again
3. Never miss an event from their favorite venues/artists
4. Never forget when tickets go on sale
5. Have all events automatically in their calendar

**EventFinder should:**
- Discover 95%+ of relevant events from configured sources
- Produce zero or near-zero false positives
- Run reliably every day without intervention
- Be easy to configure and maintain
- Respect website terms of service and rate limits

## Future Enhancements (Not in Initial Scope)

- Mobile app/push notifications
- Social sharing (friends attending same events)
- Price tracking and alerts (ticket price drops)
- Automatic ticket purchasing
- Multi-user/family support
- Event recommendations based on history
- Integration with streaming services (Spotify, etc.)

## Why This Matters

**Time saved**: 15-30 minutes daily × 365 days = 90-180 hours per year

**Events not missed**: Priceless

EventFinder transforms event discovery from a daily chore into a completely automated, personalized notification system. You focus on deciding which events to attend—EventFinder handles the rest.
