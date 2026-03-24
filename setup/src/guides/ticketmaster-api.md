# Ticketmaster API Setup Guide

## Overview

The Ticketmaster Discovery API provides access to millions of events including concerts, sports, arts, theater, and family events worldwide.

**Difficulty**: Easy
**Cost**: Free (rate limits apply)

## Step-by-Step Instructions

### 1. Create a Ticketmaster Developer Account

1. Go to [Ticketmaster Developer Portal](https://developer.ticketmaster.com/)
2. Click **"Sign Up"** in the top right
3. Fill in the registration form:
   - Email address
   - Password
   - First and last name
   - Accept terms and conditions
4. Click **"Create Account"**
5. Check your email and verify your account

### 2. Create an App

1. Log in to the [Developer Portal](https://developer.ticketmaster.com/)
2. Click on your username → **"My Apps"**
3. Click **"Create New App"**
4. Fill in the form:
   - **App Name**: `EventFinder`
   - **Description**: `Personal event discovery assistant`
   - **Website**: You can use `http://localhost` for personal use
   - Select the APIs you want:
     - ✓ Discovery API (required)
     - ✓ Partner API (optional)
5. Click **"Save"**

### 3. Get Your API Key

1. You'll see your new app listed under "My Apps"
2. Click on it to view details
3. Your **Consumer Key** (also called API Key) will be displayed
4. Copy this value - this is your **TICKETMASTER_API_KEY**

### What You'll Need

- **TICKETMASTER_API_KEY**: Looks like `AbCdEfGhIjKlMnOpQrStUvWxYz123456`

## Rate Limits

The free tier includes:
- **5,000 API calls per day**
- **Rate limit**: 5 requests per second

This is typically more than enough for personal use.

## API Coverage

Ticketmaster provides event data for:
- 🎵 Music concerts and festivals
- ⚽ Sports events (major leagues worldwide)
- 🎭 Theater and Broadway shows
- 🎨 Arts and museum exhibitions
- 👨‍👩‍👧‍👦 Family and kids events
- 🎬 Film screenings
- 🎪 Miscellaneous events

Coverage includes:
- United States
- Canada
- Mexico
- United Kingdom
- Europe
- Australia
- New Zealand

## Testing

You can test your API key immediately:

```bash
curl "https://app.ticketmaster.com/discovery/v2/events.json?apikey=YOUR_API_KEY&city=Seattle"
```

Replace `YOUR_API_KEY` with your actual key.

Expected response: JSON with event listings.

## Troubleshooting

### "Invalid API key" error
- Make sure you copied the entire key with no extra spaces
- Check that your app is active in the developer portal

### No results returned
- This is normal - not all cities have events at all times
- Try a major city like "New York" or "Los Angeles"
- Check that your search parameters are valid

### Rate limit exceeded
- The free tier allows 5,000 calls per day
- If you exceed this, you'll get a 429 error
- Wait until the next day (resets at midnight UTC)

## Documentation

Full API documentation: [Ticketmaster Discovery API Docs](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)

## Upgrading

If you need higher rate limits, Ticketmaster offers commercial plans. For personal use, the free tier should be sufficient.
