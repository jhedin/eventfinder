# EventFinder → OpenClaw Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate EventFinder from a manually-run Claude Code CLI script into a fully autonomous daily agent running on OpenClaw + AWS Lambda + EventBridge with zero ongoing manual effort.

**Architecture:** OpenClaw agent deployed via [serverless-openclaw](https://github.com/serithemage/serverless-openclaw) on AWS Lambda, triggered daily by EventBridge. The agent runs two skills: `discover-events` (scrapes `sources.json` URLs via OpenClaw Browser tool) and `read-inbox` (parses venue newsletters from a dedicated Gmail inbox). Events are deduplicated against SQLite, matched to user preferences via OpenRouter LLM, and a digest is sent via Gmail. SQLite is persisted to S3 (download to `/tmp` on start, upload on finish) — no VPC or NAT Gateway required.

**Tech Stack:** OpenClaw (Node.js, MIT), serverless-openclaw (SAM/CDK), OpenRouter free tier (DeepSeek/Llama), Gmail + App Password, SQLite + better-sqlite3, AWS Lambda + EventBridge + S3, ical-generator (preserved from existing code)

---

## Scope Check

This plan has two loosely independent subsystems:
1. **Infrastructure bootstrap** (Tasks 1–2): serverless-openclaw deployment, S3, EventBridge
2. **Skill authoring** (Tasks 3–6): OpenClaw Skills porting discover-events and read-inbox

You can validate Skills locally (Task 3–5) before deploying to Lambda (Task 6).

---

## File Structure

### New files to create

```
skills/
  discover-events/
    SKILL.md                    ← OpenClaw skill (ported from src/commands/discover-events.md)
    templates/
      extract-events.md         ← copied from src/templates/extract-events-from-markdown.md
  read-inbox/
    SKILL.md                    ← OpenClaw skill for parsing Gmail newsletters

lib/
  db.js                         ← SQLite helpers: init, download from S3, upload to S3
  ical.js                       ← iCal generation (preserved from mcp-servers/smtp-email/index.js)
  gmail.js                      ← Gmail send helper (nodemailer + App Password)
  hash.js                       ← event_hash generation (sha256 of normalized title+venue)

agent-entrypoint.js             ← Lambda handler: loadDb → runSkill → saveDb

infra/
  template.yaml                 ← SAM template (EventBridge schedule + Lambda)
  .env.example                  ← env var template for Lambda

data/
  schema.sql                    ← UPDATE: add 'pending' to sent_events CHECK constraint
  user-preferences.md           ← UNCHANGED
  sources.json                  ← UPDATE: add `type` field ("web" or "email")
```

> **Schema change required:** `data/schema.sql` has `CHECK (status IN ('sent', 'excluded', 'skipped'))` on `sent_events`. The workflow inserts `'pending'` as the initial status for matched events. This must be updated to `CHECK (status IN ('sent', 'excluded', 'skipped', 'pending'))` or the first INSERT will fail with a constraint violation. Do this as the first step of Task 2.

### Files to delete after migration is verified working

```
src/                            ← entire build system
mcp-servers/                    ← replaced by lib/gmail.js + lib/ical.js
setup/                          ← no longer needed
scripts/build.js
scripts/setup-build.js
```

### Files to update

```
package.json                    ← replace build scripts with openclaw scripts
.env.template                   ← update to new variable names
CLAUDE.md                       ← document new architecture
```

---

## Task 1: Bootstrap serverless-openclaw

**Files:**
- Create: `infra/template.yaml`
- Create: `infra/.env.example`
- Modify: `package.json`

### Prerequisites (manual steps — do these before Task 1)

- [ ] **Create a dedicated Gmail account** (e.g. `eventfinder.digest@gmail.com`)
  - Enable 2-Step Verification
  - Go to Google Account → Security → App Passwords → create one for "EventFinder"
  - Save the 16-character App Password
- [ ] **Create an OpenRouter account** at https://openrouter.ai
  - Get a free API key (no credit card needed for free models)
  - Note your API key (`sk-or-...`)
- [ ] **Install AWS CLI** and configure credentials (`aws configure`)
- [ ] **Install AWS SAM CLI**: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

### Steps

- [ ] **Step 1: Clone serverless-openclaw**

```bash
cd /home/jhedin/workspace
git clone https://github.com/serithemage/serverless-openclaw openclaw-runtime
cd openclaw-runtime
npm install
```

- [ ] **Step 2: Verify it runs locally**

```bash
# Should show OpenClaw startup message
npm start
```

Expected: OpenClaw starts, shows available tools

- [ ] **Step 3: Create S3 bucket for SQLite persistence**

```bash
aws s3 mb s3://eventfinder-db-$(aws sts get-caller-identity --query Account --output text) --region us-east-1
# Note the bucket name — you'll need it for env vars
```

- [ ] **Step 4: Locate the SAM/CDK entry point in serverless-openclaw**

```bash
ls /home/jhedin/workspace/openclaw-runtime/
# Look for: template.yaml, template.yml, cdk.json, serverless.yml, or similar
```

Copy whichever infrastructure definition file exists into `infra/`. If it's a CDK project, the file is likely `bin/*.ts` or `lib/*Stack.ts`. Then add the EventBridge schedule rule to it:

For SAM (`template.yaml`):

```yaml
# Add this resource to the existing template
EventFinderSchedule:
  Type: AWS::Events::Rule
  Properties:
    Description: "Daily EventFinder trigger at 8am MST (3pm UTC)"
    ScheduleExpression: "cron(0 15 * * ? *)"
    State: ENABLED
    Targets:
      - Arn: !GetAtt OpenClawFunction.Arn
        Id: "EventFinderDailyTrigger"
        Input: '{"action": "run-skill", "skill": "discover-events"}'

EventFinderSchedulePermission:
  Type: AWS::Lambda::Permission
  Properties:
    FunctionName: !Ref OpenClawFunction
    Action: lambda:InvokeFunction
    Principal: events.amazonaws.com
    SourceArn: !GetAtt EventFinderSchedule.Arn
```

- [ ] **Step 5: Create infra/.env.example**

```bash
cat > infra/.env.example << 'EOF'
# OpenRouter (free tier — https://openrouter.ai)
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=deepseek/deepseek-chat:free

# Gmail (dedicated account + App Password)
GMAIL_USER=eventfinder.digest@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Email recipient
EMAIL_TO=your-personal@email.com

# S3 bucket for SQLite persistence (created in Step 3)
S3_BUCKET=eventfinder-db-123456789012
S3_KEY=eventfinder.db
AWS_REGION=us-east-1
EOF
```

- [ ] **Step 6: Copy .env.example to .env and fill in real values**

```bash
cp infra/.env.example .env
# Edit .env with your actual API keys
```

- [ ] **Step 7: Commit**

```bash
git add infra/
git commit -m "feat: add serverless-openclaw infra and EventBridge schedule"
```

---

## Task 2: SQLite S3 persistence helper

**Files:**
- Create: `lib/db.js`

This module handles the download-from-S3 → work-in-tmp → upload-to-S3 lifecycle. It's called at the start and end of every Lambda invocation.

- [ ] **Step 1: Fix schema CHECK constraint in data/schema.sql**

The `sent_events` table has `CHECK (status IN ('sent', 'excluded', 'skipped'))` but the workflow inserts `'pending'`. Add `'pending'` to the constraint:

```bash
sed -i "s/CHECK (status IN ('sent', 'excluded', 'skipped'))/CHECK (status IN ('sent', 'excluded', 'skipped', 'pending'))/" data/schema.sql
# Verify the change:
grep "CHECK (status" data/schema.sql
```

Expected output: `CHECK (status IN ('sent', 'excluded', 'skipped', 'pending'))`

- [ ] **Step 2: Create lib/db.js**

```javascript
// lib/db.js
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import Database from 'better-sqlite3';
import { createReadStream, readFileSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';

const DB_LOCAL_PATH = '/tmp/eventfinder.db';
const SCHEMA_PATH = new URL('../data/schema.sql', import.meta.url).pathname;

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

/** Download DB from S3, or initialize fresh if not found */
export async function loadDb() {
  const bucket = process.env.S3_BUCKET;
  const key = process.env.S3_KEY || 'eventfinder.db';

  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks = [];
    for await (const chunk of response.Body) chunks.push(chunk);
    writeFileSync(DB_LOCAL_PATH, Buffer.concat(chunks));
    console.log(`[db] Downloaded ${DB_LOCAL_PATH} from s3://${bucket}/${key}`);
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      console.log('[db] No DB found in S3, initializing fresh database');
      initializeDb();
    } else {
      throw err;
    }
  }

  return new Database(DB_LOCAL_PATH);
}

/** Upload DB back to S3 after all operations */
export async function saveDb() {
  const bucket = process.env.S3_BUCKET;
  const key = process.env.S3_KEY || 'eventfinder.db';
  const data = readFileSync(DB_LOCAL_PATH);
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data }));
  console.log(`[db] Uploaded ${DB_LOCAL_PATH} to s3://${bucket}/${key}`);
}

/** Initialize SQLite schema from data/schema.sql */
function initializeDb() {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const db = new Database(DB_LOCAL_PATH);
  db.exec(schema);
  db.close();
  console.log('[db] Schema initialized');
}
```

- [ ] **Step 2: Set package.json to ESM and install dependencies**

All `lib/` files use ES module syntax (`import`/`export`). Add `"type": "module"` to `package.json`:

```bash
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.type = 'module';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Set type: module');
"
npm install @aws-sdk/client-s3 better-sqlite3
```

- [ ] **Step 3: Smoke-test locally (requires AWS credentials)**

```bash
# Write a temporary test file (needed for ESM — node -e doesn't support top-level await in all versions)
cat > /tmp/test-db.mjs << 'EOF'
import { loadDb, saveDb } from '/home/jhedin/workspace/eventfinder/lib/db.js';
const db = await loadDb();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
db.close();
await saveDb();
console.log('OK');
EOF
node /tmp/test-db.mjs
```

Expected output:
```
[db] No DB found in S3, initializing fresh database
[db] Schema initialized
Tables: [ { name: 'sources' }, { name: 'events' }, { name: 'event_instances' }, { name: 'sent_events' } ]
[db] Uploaded /tmp/eventfinder.db to s3://eventfinder-db-.../eventfinder.db
OK
```

- [ ] **Step 4: Commit**

```bash
git add lib/db.js package.json package-lock.json
git commit -m "feat: add SQLite S3 persistence helper"
```

---

## Task 3: iCal and email helpers

**Files:**
- Create: `lib/ical.js`
- Create: `lib/email.js`
- Create: `lib/hash.js`

These replace the `mcp-servers/smtp-email/index.js` MCP server with plain Node.js modules.

> **SNS vs SES for sending:** SNS email subscriptions only deliver plain text — no HTML, no attachments. For a rich digest with iCal files, use **Amazon SES** (SendRawEmail API, supports full MIME with attachments, 62,000 emails/month free within AWS) or **Gmail SMTP** (simpler setup, App Password, no domain needed). The implementation below uses Gmail for MVP simplicity. To switch to SES later, replace `lib/email.js` — the rest of the code is unchanged.

> **SES setup (if preferred over Gmail):** Verify your personal email address in SES sandbox, then call `ses.sendRawEmail()` with the same nodemailer-generated MIME. Add `SES_FROM=eventfinder@yourdomain.com` env var and `SESFullAccess` IAM policy to Lambda. No App Password needed.

- [ ] **Step 1: Create lib/hash.js**

```javascript
// lib/hash.js
import { createHash } from 'crypto';

/** Normalize a string for event deduplication */
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')  // remove accents
    .replace(/[^a-z0-9]/g, '');               // remove punctuation and spaces
}

/** Generate event_hash from title + venue */
export function eventHash(title, venue) {
  const key = normalize(title) + normalize(venue || '');
  return createHash('sha256').update(key).digest('hex');
}
```

- [ ] **Step 2: Create lib/ical.js** (ported from `mcp-servers/smtp-email/index.js:50-107`)

```javascript
// lib/ical.js
import ical from 'ical-generator';

/** Generate iCal data for an event instance */
export function generateEventIcal(event, instance, emailFrom) {
  const calendar = ical({ name: 'EventFinder Events' });
  const eventDate = new Date(`${instance.date}T${instance.time || '00:00:00'}`);
  const endDate = instance.end_date
    ? new Date(`${instance.end_date}T23:59:59`)
    : new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);

  calendar.createEvent({
    start: eventDate,
    end: endDate,
    summary: event.title,
    description: event.description || '',
    location: event.venue || '',
    url: event.event_url || '',
    organizer: { name: 'EventFinder', email: emailFrom },
    alarms: [
      { type: 'display', trigger: 60 * 24 },
      { type: 'display', trigger: 60 * 3 },
    ],
  });
  return calendar.toString();
}

/** Generate iCal data for ticket sale reminder (returns null if no ticket_sale_date) */
export function generateTicketIcal(event, instance, emailFrom) {
  if (!instance.ticket_sale_date) return null;
  const calendar = ical({ name: 'EventFinder Ticket Sales' });
  const saleDate = new Date(`${instance.ticket_sale_date}T${instance.ticket_sale_time || '09:00:00'}`);

  calendar.createEvent({
    start: saleDate,
    end: new Date(saleDate.getTime() + 15 * 60 * 1000),
    summary: `Tickets on Sale: ${event.title}`,
    description: `Ticket sales begin for ${event.title}${event.venue ? ' at ' + event.venue : ''}.\n\n${event.ticket_url || event.event_url || ''}`,
    location: event.venue || '',
    url: event.ticket_url || event.event_url || '',
    organizer: { name: 'EventFinder', email: emailFrom },
    alarms: [{ type: 'display', trigger: 0 }],
  });
  return calendar.toString();
}
```

- [ ] **Step 3: Create lib/gmail.js**

```javascript
// lib/gmail.js
import nodemailer from 'nodemailer';
import { generateEventIcal, generateTicketIcal } from './ical.js';

/** Send the EventFinder digest email with iCal attachments */
export async function sendDigest({ to, subject, html, text, events }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const emailFrom = process.env.GMAIL_USER;
  const today = new Date().toISOString().split('T')[0];

  // Combine iCal data across all events/instances
  const eventIcals = [];
  const ticketIcals = [];
  for (const event of events) {
    for (const instance of event.instances) {
      eventIcals.push(generateEventIcal(event, instance, emailFrom));
      const ticketIcal = generateTicketIcal(event, instance, emailFrom);
      if (ticketIcal) ticketIcals.push(ticketIcal);
    }
  }

  const attachments = [
    { filename: `events-${today}.ics`, content: eventIcals.join('\n'), contentType: 'text/calendar' },
  ];
  if (ticketIcals.length > 0) {
    attachments.push({ filename: `tickets-${today}.ics`, content: ticketIcals.join('\n'), contentType: 'text/calendar' });
  }

  const info = await transporter.sendMail({
    from: emailFrom,
    to: to || process.env.EMAIL_TO,
    subject,
    text,
    html,
    attachments,
  });

  return { messageId: info.messageId, attachments: attachments.map(a => a.filename) };
}
```

- [ ] **Step 4: Install dependencies**

```bash
npm install nodemailer ical-generator
```

- [ ] **Step 5: Smoke-test Gmail send**

```bash
cat > /tmp/test-gmail.mjs << 'EOF'
import { sendDigest } from '/home/jhedin/workspace/eventfinder/lib/gmail.js';
const result = await sendDigest({
  to: process.env.EMAIL_TO,
  subject: 'EventFinder test',
  html: '<h1>Test email</h1>',
  text: 'Test email',
  events: [{
    title: 'Test Event',
    venue: 'Test Venue',
    description: 'A test',
    event_url: 'https://example.com',
    ticket_url: null,
    instances: [{ date: '2026-04-01', time: '19:00:00', end_date: null, ticket_sale_date: null, ticket_sale_time: null }]
  }]
});
console.log('Sent:', result);
EOF
GMAIL_USER=eventfinder.digest@gmail.com GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx" EMAIL_TO=your@email.com node /tmp/test-gmail.mjs
```

Expected: Email arrives in your personal inbox with one `.ics` attachment.

- [ ] **Step 6: Commit**

```bash
git add lib/
git commit -m "feat: add iCal, Gmail, and hash helpers"
```

---

## Task 4: Lambda entry point + discover-events Skill

**Files:**
- Create: `agent-entrypoint.js`
- Create: `skills/discover-events/SKILL.md`
- Create: `skills/discover-events/templates/extract-events.md`

> **Architecture clarification:** OpenClaw Skills are Markdown instruction files for the agent. `lib/db.js` is a Node.js module — it cannot be called directly from a SKILL.md. The solution: `agent-entrypoint.js` is the Lambda handler. It calls `loadDb()` before invoking the skill and `saveDb()` after. The skill itself uses OpenClaw's built-in SQLite MCP tool (pointed at `/tmp/eventfinder.db`) for all DB reads/writes during execution.

- [ ] **Step 1: Create agent-entrypoint.js**

This is the Lambda handler that wraps OpenClaw skill execution with DB lifecycle management:

```javascript
// agent-entrypoint.js
import { loadDb, saveDb } from './lib/db.js';
import { runSkill } from 'openclaw'; // serverless-openclaw exports this

export const handler = async (event) => {
  const skill = event?.skill || event?.detail?.skill || 'discover-events';
  console.log(`[entrypoint] Starting skill: ${skill}`);

  // Download DB from S3 before the agent runs
  const db = await loadDb();
  db.close(); // lib/db.js writes to /tmp; OpenClaw SQLite MCP picks it up from there

  try {
    // Run the OpenClaw skill — agent uses Browser tool, SQLite MCP at /tmp/eventfinder.db, etc.
    const result = await runSkill(skill, {
      env: {
        DB_PATH: '/tmp/eventfinder.db',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat:free',
      }
    });
    console.log('[entrypoint] Skill complete:', result);
    return { statusCode: 200, body: result };
  } finally {
    // Always upload DB back to S3, even if skill threw
    await saveDb();
    console.log('[entrypoint] DB saved to S3');
  }
};
```

> **Note:** The exact import path for `runSkill` depends on what `serverless-openclaw` exports. After cloning it in Task 1, check its `package.json` `"main"` field and adjust accordingly. If it doesn't export `runSkill`, check for an `invoke` or `run` export, or look at how the existing Lambda handler triggers skills.

- [ ] **Step 2: Configure OpenClaw SQLite MCP to use /tmp**

In the OpenClaw config (typically `openclaw.config.js` or `config.yml` in the cloned repo), set the SQLite MCP database path to `/tmp/eventfinder.db`:

```yaml
# openclaw.config.yml (adjust based on what serverless-openclaw uses)
mcp:
  sqlite:
    dbPath: /tmp/eventfinder.db
```

This means the agent's SQL queries go to the same file that `lib/db.js` downloads from S3.

- [ ] **Step 3: Copy and adapt the extract-events template**

```bash
mkdir -p skills/discover-events/templates
cp src/templates/extract-events-from-markdown.md skills/discover-events/templates/extract-events.md
```

No content changes needed — the template is already well-structured.

- [ ] **Step 4: Create skills/discover-events/SKILL.md**

```markdown
# Discover Events

**You are EventFinder.** Run the complete event discovery workflow autonomously.

## Setup

The SQLite database is already available at `/tmp/eventfinder.db` — `agent-entrypoint.js` downloaded it from S3 before invoking this skill. Do NOT attempt to download or upload the database yourself; that is handled outside this skill.

Before starting:
1. Read `data/user-preferences.md` to load user interests into context
2. Read `data/sources.json` to get the list of sources to check

## Step 1: Load Sources

Query active web sources from the database:
```sql
SELECT id, url, name, description
FROM sources
WHERE active = 1 AND (type IS NULL OR type = 'web')
ORDER BY last_checked_at ASC NULLS FIRST
```

## Step 2: Scrape Each Source

For each source URL:

1. Use the **browser tool** to fetch the page: `browser.fetch(url)`
   - This returns the page as markdown
   - Timeout: 10 seconds
   - On error: log to DB, continue to next source

2. Pass the markdown to the LLM with the template from `skills/discover-events/templates/extract-events.md`
   - Extract all events as structured JSON
   - Return `[]` if no events found

3. Update source status in DB:
   - **Success**: `UPDATE sources SET last_checked_at=NOW(), last_success_at=NOW(), consecutive_failures=0 WHERE id=?`
   - **Failure**: `UPDATE sources SET last_checked_at=NOW(), consecutive_failures=consecutive_failures+1, error_message=?, error_type=? WHERE id=?`
   - **Auto-disable after 3 failures**: `UPDATE sources SET active=0 WHERE consecutive_failures >= 3`

## Step 3: Process Each Extracted Event

For each extracted event:

### Deduplication
1. Generate `event_hash` using `hash.eventHash(title, venue)` from `lib/hash.js`
2. Query: `SELECT id FROM events WHERE event_hash = ?`
   - If found: skip (already known)
3. Fuzzy check: `SELECT id, title, venue FROM events e JOIN event_instances ei ON e.id=ei.event_id WHERE e.venue LIKE ? AND ei.instance_date BETWEEN ? AND ? LIMIT 5`
   - Use main venue keyword with `%` wildcards, date range ±3 days
   - Use LLM judgment: same event with slightly different wording? Skip.

### Relevance Matching
If genuinely new, decide relevance based on `data/user-preferences.md`:
- Does it match the user's music, arts, or workshop interests?
- Is it excluded (sports, nightclubs, EDM, corporate events)?
- Output: `{ matches: true/false, reason: "..." }`

### Store in DB
```sql
-- Insert event
INSERT INTO events (event_hash, title, venue, description, price, event_url, ticket_url, source_id, source_url)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id

-- Insert instances
INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone, ticket_sale_date, ticket_sale_time)
VALUES (?, ?, ?, ?, 'America/Edmonton', ?, ?)

-- Mark status
INSERT INTO sent_events (event_id, instance_id, status, reason)
SELECT ?, id, ?, ? FROM event_instances WHERE event_id = ?
-- status = 'pending' if matches=true, 'excluded' if matches=false
```

## Step 4: Generate and Send Digest

Query unsent pending events:
```sql
SELECT e.*, ei.id as instance_id, ei.instance_date, ei.instance_time, ei.end_date, ei.ticket_sale_date, ei.ticket_sale_time
FROM events e
JOIN event_instances ei ON e.id = ei.event_id
JOIN sent_events se ON se.instance_id = ei.id
WHERE se.status = 'pending'
ORDER BY ei.instance_date ASC
```

If no events: report "No new events to send" and stop.

Generate email:
- **Subject**: `{N} New Events ({earliest_date} - {latest_date})`
- **HTML body**: Group by category (🎵 Music, 🎨 Arts & Culture, 🛠️ Workshops, 📅 Other). Each event card shows title, date/time, venue, price, links.
- **Plain text**: Same structure, markdown-style formatting

Send via `gmail.sendDigest({ to: EMAIL_TO, subject, html, text, events })` from `lib/gmail.js`

After successful send:
```sql
UPDATE sent_events SET status='sent', sent_at=CURRENT_TIMESTAMP
WHERE instance_id IN (/* all sent instance IDs */)
```

## Step 5: Finish

Print the summary below. The database will be uploaded back to S3 automatically by `agent-entrypoint.js` after this skill returns — do NOT attempt to upload it yourself.

Print summary:
```
✅ EventFinder Complete
Sources checked: N | Failed: N
Events found: N | New: N | Duplicates skipped: N
Matched: N | Excluded: N
Email: sent to EMAIL_TO with N events
```

## Error Handling
- Source fetch fails → log, continue
- Email send fails → report error, leave events in 'pending' (retry next run)
- DB errors → stop immediately (data integrity)
```

- [ ] **Step 5: Commit**

```bash
git add skills/ agent-entrypoint.js
git commit -m "feat: add discover-events OpenClaw skill and Lambda entrypoint"
```

---

## Task 5: Add read-inbox skill for newsletter sources

**Files:**
- Create: `skills/read-inbox/SKILL.md`

This skill reads unread emails from the dedicated Gmail inbox, extracts events, and feeds them into the same pipeline as scraped events.

> **Architecture note:** The user asked about SQS. A cleaner AWS-native approach is:
> - Configure Amazon SES to receive email for the domain → route to SNS → SNS fans out to SQS
> - Lambda polls SQS for new emails
>
> However, this requires a custom domain verified with SES ($0/month but setup complexity).
> **For the MVP, we use Gmail IMAP polling** (OpenClaw Gmail read tool). A `type='email'` entry in `sources` identifies email sources. This can be upgraded to SES→SQS later without changing the event processing pipeline.

- [ ] **Step 1: Add email source type to sources.json**

Edit `data/sources.json` to support both web and email source types:

```json
{
  "sources": [
    {
      "url": "https://thepalomino.ca/live-events/",
      "name": "The Palomino",
      "description": "Calgary country/rock venue",
      "type": "web"
    },
    {
      "url": "newsletter@venue.com",
      "name": "Venue Newsletter",
      "description": "Subscribed to their mailing list",
      "type": "email"
    }
  ]
}
```

- [ ] **Step 2: Create skills/read-inbox/SKILL.md**

```markdown
# Read Inbox

**You are EventFinder.** Process unread newsletter emails from the dedicated Gmail inbox and extract events.

## Setup

The SQLite database is already available at `/tmp/eventfinder.db` — loaded by `agent-entrypoint.js` before this skill runs. Do not attempt to download or upload the database.

Read `data/user-preferences.md` for user interests.

## Step 1: Fetch Unread Emails

Use the **Gmail read tool** to get unread messages from the inbox:
- Filter: unread, from the last 48 hours
- Ignore: automated replies, spam, non-event emails

For each email:
1. Extract the plain text or HTML body
2. Convert HTML to readable text if needed
3. Note the sender address and email subject

## Step 2: Extract Events from Email

Pass the email body to the LLM using the same template as web scraping:
`skills/discover-events/templates/extract-events.md`

The email body is your "markdown input". Extract events exactly as you would from a web page.

Identify the source:
- Look up `source_id` from the `sources` table where `url = sender_email_address`
- If no matching source: skip this email (unknown sender)

## Step 3: Process Events

Use the **exact same logic** as discover-events Steps 3 (deduplication, relevance matching, DB insertion).

The event data flows into the same `events`, `event_instances`, and `sent_events` tables.

## Step 4: Mark Emails as Read

After processing each email, mark it as read in Gmail so it's not processed again.

## Step 5: Finish

The database will be uploaded to S3 automatically by `agent-entrypoint.js` after this skill returns.

Report how many emails were processed and how many events were extracted.
```

- [ ] **Step 3: Commit**

```bash
git add skills/read-inbox/ data/sources.json
git commit -m "feat: add read-inbox skill for newsletter email sources"
```

---

## Task 6: Deploy to Lambda and verify end-to-end

**Files:**
- Modify: `infra/template.yaml` (add env vars, S3 permissions)

- [ ] **Step 1: Add Lambda permissions for S3**

In `infra/template.yaml`, add S3 permissions to the Lambda execution role:

```yaml
Policies:
  - S3CrudPolicy:
      BucketName: !Ref S3BucketName
```

And add S3BucketName as a parameter:

```yaml
Parameters:
  S3BucketName:
    Type: String
    Description: S3 bucket for SQLite persistence
```

- [ ] **Step 2: Add a deploy prep script to package.json**

Rather than ad-hoc `cp` commands, add a `predeploy` npm script to `package.json` that stages files into the openclaw-runtime directory before each SAM build. This ensures re-deploys stay in sync:

```json
"scripts": {
  "predeploy": "node scripts/stage-for-deploy.js",
  "deploy": "cd /home/jhedin/workspace/openclaw-runtime && sam build && sam deploy"
}
```

Create `scripts/stage-for-deploy.js`:

```javascript
// scripts/stage-for-deploy.js
import { cpSync } from 'fs';
const dest = '/home/jhedin/workspace/openclaw-runtime';
for (const dir of ['skills', 'lib', 'data']) {
  cpSync(`./${dir}`, `${dest}/${dir}`, { recursive: true, force: true });
  console.log(`Staged ${dir}/ → ${dest}/${dir}/`);
}
// Copy entrypoint
cpSync('./agent-entrypoint.js', `${dest}/agent-entrypoint.js`, { force: true });
console.log('Staged agent-entrypoint.js');
```

Run it once manually to stage:

```bash
node scripts/stage-for-deploy.js
```

- [ ] **Step 3: Bake environment variables into infra/template.yaml**

Add an `Environment` block to the Lambda function resource so env vars are set at deploy time (not manually afterwards):

```yaml
# In the Lambda function resource in template.yaml, add:
Environment:
  Variables:
    OPENROUTER_API_KEY: !Sub "{{resolve:ssm:/eventfinder/openrouter-api-key}}"
    OPENROUTER_MODEL: "deepseek/deepseek-chat:free"
    GMAIL_USER: !Sub "{{resolve:ssm:/eventfinder/gmail-user}}"
    GMAIL_APP_PASSWORD: !Sub "{{resolve:ssm:/eventfinder/gmail-app-password}}"
    EMAIL_TO: !Sub "{{resolve:ssm:/eventfinder/email-to}}"
    S3_BUCKET: !Ref S3BucketName
    S3_KEY: "eventfinder.db"
```

First, store secrets in SSM Parameter Store:

```bash
aws ssm put-parameter --name /eventfinder/openrouter-api-key --value "sk-or-..." --type SecureString
aws ssm put-parameter --name /eventfinder/gmail-user --value "eventfinder.digest@gmail.com" --type String
aws ssm put-parameter --name /eventfinder/gmail-app-password --value "xxxx xxxx xxxx xxxx" --type SecureString
aws ssm put-parameter --name /eventfinder/email-to --value "your@email.com" --type String
```

Also add SSM read permission to the Lambda IAM role in template.yaml:
```yaml
- SSMParameterReadPolicy:
    ParameterName: "/eventfinder/*"
```

- [ ] **Step 4: Deploy**

```bash
cd /home/jhedin/workspace/openclaw-runtime
sam build && sam deploy --guided
```

Follow prompts. When asked for `S3BucketName` parameter, enter the bucket name from Task 1 Step 3. Note the Lambda function ARN.

- [ ] **Step 5: Invoke manually to verify**

```bash
aws lambda invoke \
  --function-name OpenClawFunction \
  --payload '{"action": "run-skill", "skill": "discover-events"}' \
  --cli-binary-format raw-in-base64-out \
  response.json
cat response.json
```

Expected: JSON with `statusCode: 200` and a summary of events found

- [ ] **Step 6: Check CloudWatch logs**

```bash
aws logs tail /aws/lambda/OpenClawFunction --follow
```

Look for: `✅ EventFinder Complete` and email send confirmation.

- [ ] **Step 7: Verify email arrives**

Check your personal inbox. Should see:
- Subject: `N New Events (date - date)`
- Body: categorized events with HTML cards
- Attachments: `events-YYYY-MM-DD.ics` (and `tickets-YYYY-MM-DD.ics` if ticket sales found)

- [ ] **Step 8: Verify EventBridge schedule**

```bash
aws events list-rules --name-prefix EventFinder
aws events list-targets-by-rule --rule EventFinderSchedule
```

Expected: Rule shows `ENABLED` state and correct cron expression.

- [ ] **Step 9: Commit**

```bash
git add infra/
git commit -m "feat: deploy to Lambda with EventBridge schedule"
```

---

## Task 7: Clean up old infrastructure

Only do this **after** verifying Task 6 works end-to-end.

- [ ] **Step 1: Remove old directories**

```bash
git rm -r src/ mcp-servers/ setup/
git rm scripts/build.js scripts/setup-build.js
```

- [ ] **Step 2: Update package.json**

Replace the old build scripts in `package.json`. Keep only scripts that still make sense:

```json
{
  "type": "module",
  "scripts": {
    "init": "node scripts/init.js",
    "test:gmail": "node /tmp/test-gmail.mjs",
    "test:db": "node /tmp/test-db.mjs",
    "predeploy": "node scripts/stage-for-deploy.js",
    "deploy": "cd /home/jhedin/workspace/openclaw-runtime && sam build && sam deploy"
  }
}
```

> `scripts/init.js` already exists and creates `.env` from `.env.template` — keep it. `scripts/init-db.js` is no longer needed since `lib/db.js` handles first-run initialization from `data/schema.sql`.
```

- [ ] **Step 3: Update .env.template**

```bash
cat > .env.template << 'EOF'
# OpenRouter (free tier LLM — https://openrouter.ai)
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=deepseek/deepseek-chat:free

# Gmail dedicated account (create new account + App Password)
GMAIL_USER=eventfinder.digest@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Your personal email to receive the digest
EMAIL_TO=your-personal@email.com

# S3 bucket for SQLite database persistence
S3_BUCKET=eventfinder-db-your-account-id
S3_KEY=eventfinder.db
AWS_REGION=us-east-1
EOF
```

- [ ] **Step 4: Update CLAUDE.md** to document the new architecture (replace the existing Development Commands and Architecture sections)

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: remove old claude-code CLI infrastructure, update docs"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `node lib/db.js` downloads DB from S3, runs without error
- [ ] `node lib/gmail.js` sends a test email with `.ics` attachment
- [ ] OpenClaw runs `discover-events` skill locally against one URL → extracts events → stores in SQLite
- [ ] Lambda invoke via AWS CLI → returns success → email arrives in inbox
- [ ] EventBridge rule shows ENABLED in AWS Console
- [ ] CloudWatch logs show daily run completing without errors
- [ ] S3 bucket contains updated `eventfinder.db` after each run
- [ ] Cost: check AWS Cost Explorer after 1 week — should be well under $1

---

## Open Questions / Future Improvements

**SES → SQS inbox (future upgrade)**

The user asked about subscribing an SQS queue to an email address. Yes — this is possible with Amazon SES email receiving:
1. Verify a domain in SES
2. Create an SES receipt rule to route incoming emails to SNS
3. Subscribe SQS to that SNS topic
4. Lambda polls SQS for new messages
5. Extract email body and process with read-inbox skill logic

This is cleaner than Gmail polling (no IMAP, no App Password) but requires a custom domain. Add this when subscribing to enough venues that Gmail polling becomes cumbersome.

**OpenRouter rate limits**

Free tier: 50 req/day without credits, 200 req/day with any purchase. With ~10 sources and ~10 events each, expect ~30-50 LLM calls/run. Fine for free tier. If you grow to 20+ sources, add $10 credits to raise the limit.

**Headless browser on Lambda**

serverless-openclaw includes a Chromium Lambda layer. If it doesn't, use `chrome-aws-lambda` package (~45MB layer). Verify during Task 6 deploy.
