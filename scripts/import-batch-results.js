#!/usr/bin/env node
// Reads all /tmp/eventfinder-batch-*.json files written by scraper subagents,
// deduplicates events, and imports them into the EventFinder database.
//
// Usage: node scripts/import-batch-results.js

import { createRequire } from 'module';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const TMP_DIR = '/tmp';
const BATCH_PATTERN = /^eventfinder-batch-.*\.json$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '')                        // remove punctuation/spaces
    .trim();
}

function eventHash(title, venue) {
  const key = normalize(title) + normalize(venue);
  return createHash('sha256').update(key).digest('hex');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Prepared statements
const stmts = {
  checkHash:    db.prepare('SELECT id FROM events WHERE event_hash = ?'),
  insertEvent:  db.prepare(`
    INSERT INTO events (event_hash, title, venue, description, price, event_url, ticket_url, source_id, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertInstance: db.prepare(`
    INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone, ticket_sale_date, ticket_sale_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateSourceSuccess: db.prepare(`
    UPDATE sources
    SET last_checked_at = CURRENT_TIMESTAMP,
        last_success_at = CURRENT_TIMESTAMP,
        consecutive_failures = 0,
        error_message = NULL,
        error_type = NULL
    WHERE id = ?
  `),
  updateSourceFailure: db.prepare(`
    UPDATE sources
    SET last_checked_at = CURRENT_TIMESTAMP,
        consecutive_failures = consecutive_failures + 1,
        error_message = ?,
        error_type = ?
    WHERE id = ?
  `),
  autoDisable: db.prepare(`
    UPDATE sources SET active = 0 WHERE consecutive_failures >= 3
  `),
};

// Find batch files
const batchFiles = readdirSync(TMP_DIR)
  .filter(f => BATCH_PATTERN.test(f))
  .map(f => join(TMP_DIR, f))
  .sort();

if (batchFiles.length === 0) {
  console.error('No batch files found in /tmp matching eventfinder-batch-*.json');
  process.exit(1);
}

console.log(`Found ${batchFiles.length} batch file(s): ${batchFiles.join(', ')}`);

// Counters
let totalSources = 0;
let succeededSources = 0;
let failedSources = 0;
let jsHeavySources = 0;
let totalEventsExtracted = 0;
let newEvents = 0;
let duplicatesSkipped = 0;
const failedSourceList = [];
const jsHeavySourceList = [];

// Process all batches in a transaction
const importAll = db.transaction(() => {
  for (const filePath of batchFiles) {
    let batch;
    try {
      batch = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`Failed to parse ${filePath}: ${err.message}`);
      continue;
    }

    for (const result of (batch.results || [])) {
      totalSources++;
      const { source_id, source_url, success, js_heavy, error, events = [] } = result;

      if (!success) {
        failedSources++;
        failedSourceList.push({ source_id, source_url, error });
        stmts.updateSourceFailure.run(error || 'unknown error', 'fetch_error', source_id);
        continue;
      }

      stmts.updateSourceSuccess.run(source_id);
      succeededSources++;

      if (js_heavy) {
        jsHeavySources++;
        jsHeavySourceList.push({ source_id, source_url });
      }

      totalEventsExtracted += events.length;

      for (const event of events) {
        const hash = eventHash(event.title, event.venue);
        const existing = stmts.checkHash.get(hash);

        if (existing) {
          duplicatesSkipped++;
          continue;
        }

        // Insert event
        const insertResult = stmts.insertEvent.run(
          hash,
          event.title || '',
          event.venue || null,
          event.description || null,
          event.price || null,
          event.event_url || null,
          event.ticket_url || null,
          source_id,
          source_url
        );

        const eventId = insertResult.lastInsertRowid;
        newEvents++;

        // Insert instances
        for (const inst of (event.instances || [])) {
          stmts.insertInstance.run(
            eventId,
            inst.date || null,
            inst.time || null,
            inst.end_date || null,
            'America/Edmonton',
            inst.ticket_sale_date || null,
            inst.ticket_sale_time || null
          );
        }
      }
    }
  }

  stmts.autoDisable.run();
});

importAll();
db.close();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`
Import complete
───────────────────────────────
Sources processed: ${totalSources}
  Succeeded:       ${succeededSources}
  Failed:          ${failedSources}
  JS-heavy:        ${jsHeavySources}

Events extracted:  ${totalEventsExtracted}
  New (inserted):  ${newEvents}
  Duplicates:      ${duplicatesSkipped}
`);

if (failedSourceList.length > 0) {
  console.log('Failed sources:');
  failedSourceList.forEach(s => console.log(`  [${s.source_id}] ${s.source_url}: ${s.error}`));
}

if (jsHeavySourceList.length > 0) {
  console.log('JS-heavy sources (limited data — consider Browserless.io):');
  jsHeavySourceList.forEach(s => console.log(`  [${s.source_id}] ${s.source_url}`));
}
