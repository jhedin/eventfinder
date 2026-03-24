# Eventbrite API Setup Guide

## Overview

The Eventbrite API provides access to local and regional events, particularly community events, meetups, workshops, and conferences.

**Difficulty**: Easy
**Cost**: Free

## Step-by-Step Instructions

### 1. Create an Eventbrite Account

1. Go to [Eventbrite](https://www.eventbrite.com/)
2. Click **"Sign Up"** in the top right
3. Register with:
   - Email address, or
   - Google account, or
   - Facebook account
4. Verify your email if needed

### 2. Create an App / Get API Key

1. Go to [Eventbrite App Management](https://www.eventbrite.com/platform/api-keys)
   - Or navigate: Settings → Developer Links → API Keys
2. Click **"Create New Key"** or **"Add App"**
3. Fill in the application details:
   - **Application Name**: `EventFinder`
   - **Description**: `Personal event discovery assistant`
   - **Application URL**: You can use `http://localhost` for personal use
4. Click **"Create Key"**

### 3. Get Your API Token

1. Your new app will appear in the list
2. You'll see your **Private Token** (also called OAuth token)
3. Click to reveal and copy this value
4. This is your **EVENTBRITE_API_TOKEN**

### What You'll Need

- **EVENTBRITE_API_TOKEN**: Looks like `ABCDEFGHIJ1234567890`

## API Usage

The Eventbrite API allows you to:
- Search for public events
- Get event details (date, time, location, pricing)
- Find events by category or organizer
- Access venue information

## Rate Limits

Free tier limits:
- **1,000 API calls per day** per token
- **50 requests per minute**

This is generally sufficient for personal use.

## API Coverage

Eventbrite specializes in:
- 💼 Professional workshops and seminars
- 🤝 Community meetups and networking
- 🎓 Educational events and classes
- 🎪 Local festivals and fairs
- 🏃 Fitness and wellness events
- 🍷 Food and drink tastings
- 💻 Tech meetups and hackathons

Coverage:
- Primarily strong in US, UK, Canada, Australia
- Global coverage but density varies by region

## Testing

You can test your API token:

```bash
curl "https://www.eventbriteapi.com/v3/events/search/?location.address=San%20Francisco" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Replace `YOUR_TOKEN` with your actual token.

Expected response: JSON with event listings.

## Troubleshooting

### "Invalid token" error
- Make sure you copied the Private Token (not Public token or other keys)
- Ensure there are no extra spaces before/after the token
- Check that your app is active

### "No events found"
- Eventbrite has fewer events than Ticketmaster in some areas
- Try searching in major cities
- Try different categories

### Rate limit exceeded
- Free tier allows 1,000 calls per day
- If exceeded, you'll get a 429 error
- Wait for the rate limit to reset

### API returns old events
- Make sure to include date filters in your queries
- Sort by date to get upcoming events first

## Important Notes

### Public vs Private Events
- The API only returns **public** events
- Private or invite-only events won't appear in search results

### Event Organizers
- Some events may require the organizer's permission to display
- Respect copyright and terms of service

## Documentation

Full API documentation: [Eventbrite API Docs](https://www.eventbrite.com/platform/api)

## Alternatives

If you need more local event coverage, consider also configuring:
- **Meetup API** (for meetups and groups)
- **Facebook Events API** (requires app review)
- Regional event platforms specific to your area
