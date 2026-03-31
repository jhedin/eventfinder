# Add Source

Add a new event website to the EventFinder monitoring list.

## Usage

With URL:
```
/add-source https://example.com/events
```

Interactive (will prompt for URL):
```
/add-source
```

## Workflow

### Step 1: Get the URL

If no URL was provided, ask the user for one now.

### Step 2: Check for duplicates

```bash
node scripts/db-query.js "SELECT id, url, name, active FROM sources WHERE url = ?" '"<url>"'
```

If already exists: tell the user and stop.

### Step 3: Fetch and preview the page

```bash
node scripts/fetch-page.js "<url>" > /tmp/add-source-preview.html 2>&1 && echo "OK" || echo "FAILED"
```

Read the HTML and extract a sample of events (up to 5). Show the user:

```
Testing: https://example.com/events
✓ Fetched successfully

Sample events found:
- Oct 15: Jazz Night with The Quartet
- Oct 18: Comedy Show featuring Local Comics
- Oct 22: Art Exhibition Opening

Detected name: Example Venue Events
```

If the page fetches but looks like a JS-only shell (no events visible), note that Browserless.io will be used during actual runs to render JavaScript.

If the fetch fails entirely, report the error and ask the user if they still want to add it.

### Step 4: Confirm

Ask: "Add this source? (yes/no)"

If no: stop.

### Step 5: Add to database

Auto-detect a short venue name from the page title or domain if not obvious. Ask the user to confirm or provide a name.

```bash
node scripts/db-query.js "INSERT INTO sources (url, name, description, active) VALUES (?, ?, ?, 1) RETURNING id" '"<url>"' '"<name>"' '"<description_or_empty>"'
```

Then commit the updated DB to GitHub:

```bash
git config user.email "eventfinder-bot@users.noreply.github.com"
git config user.name "EventFinder Bot"
git add data/eventfinder.db
git commit -m "chore: add source <name> [skip ci]"
git pull origin main --no-rebase -X ours
git push origin HEAD:main
```

### Step 6: Confirm

```
✓ Added: <name>
   URL: <url>
   ID: <id>
   Total active sources: <count>

This site will be checked in the next discovery run.
```
