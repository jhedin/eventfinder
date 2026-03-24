# Google OAuth2 Setup Guide

## Overview

Google OAuth2 allows EventFinder to integrate with Google Calendar, letting you add events directly to your calendar.

**Difficulty**: Medium (requires multiple steps)
**Cost**: Free

## Step-by-Step Instructions

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click **"Select a project"** at the top → **"New Project"**
4. Enter project name: `EventFinder`
5. Click **"Create"**

### 2. Enable the Google Calendar API

1. In your new project, go to **"APIs & Services"** → **"Library"**
2. Search for `Google Calendar API`
3. Click on it and press **"Enable"**

### 3. Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. If prompted, configure the OAuth consent screen first:
   - Choose **"External"** user type
   - Fill in app name: `EventFinder`
   - Add your email as developer contact
   - Skip optional fields, click **"Save and Continue"**
   - Skip scopes, click **"Save and Continue"**
   - Add yourself as a test user
   - Click **"Save and Continue"**
4. Back at Create OAuth client ID:
   - Application type: **"Desktop app"**
   - Name: `EventFinder Desktop`
   - Click **"Create"**

### 4. Download Credentials

1. You'll see a modal with your Client ID and Client Secret
2. Copy both values - you'll need:
   - **GOOGLE_CLIENT_ID**: The client ID string
   - **GOOGLE_CLIENT_SECRET**: The client secret string

### 5. Generate Refresh Token

This is the most complex part. You have two options:

#### Option A: Use OAuth Playground (Easier)

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check **"Use your own OAuth credentials"**
4. Enter your Client ID and Client Secret
5. In the left panel, find and select:
   - **Google Calendar API v3**
   - Check: `https://www.googleapis.com/auth/calendar`
6. Click **"Authorize APIs"**
7. Sign in with your Google account
8. Click **"Allow"**
9. Click **"Exchange authorization code for tokens"**
10. Copy the **Refresh token** value

#### Option B: Command Line (Advanced)

If you prefer using the command line, detailed instructions are available in [Google's OAuth2 documentation](https://developers.google.com/identity/protocols/oauth2).

### 6. What You'll Need

After completing these steps, you should have:

- **GOOGLE_CLIENT_ID**: Looks like `123456789-abc.apps.googleusercontent.com`
- **GOOGLE_CLIENT_SECRET**: Looks like `GOCSPX-abc123xyz`
- **GOOGLE_REFRESH_TOKEN**: Looks like `1//abc123xyz...`

## Troubleshooting

### "Access blocked" error
- Make sure you added yourself as a test user in the OAuth consent screen
- Your app is in testing mode by default (this is fine for personal use)

### Can't find Calendar API
- Make sure you're in the correct Google Cloud project
- Check that the API was successfully enabled

### Refresh token not generated
- Make sure you checked "Use your own OAuth credentials" in the playground
- Ensure you selected the correct Calendar API scope
- Try using "offline access" option if available

## Testing

Once configured, EventFinder will be able to:
- Read your calendar events
- Add new events you discover
- Update event details
- Set reminders

You can revoke access anytime through your [Google Account permissions page](https://myaccount.google.com/permissions).
