#!/usr/bin/env node
// One-time repair: inserts missing event_instances for events already in the DB
// that had non-standard date formats in the batch file (date, date_start, dates[]).
//
// Usage: node scripts/repair-missing-instances.js [batch-file]
// Default batch file: /tmp/eventfinder-batch-merged.json

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const batchFile = process.argv[2] || '/tmp/eventfinder-batch-merged.json';

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function eventHash(title, venue) {
  const key = normalize(title) + normalize(venue);
  return createHash('sha256').update(key).digest('hex');
}

// Normalize a time string like "21:30" or "19:00" to "HH:MM:SS"
function normalizeTime(t) {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] || '00'}`;
}

// Extract instances from an event that may use non-standard date fields
function extractInstances(event) {
  // Already has instances — skip
  if (event.instances && event.instances.length > 0) return null;

  const instances = [];

  // Format 1: top-level date + optional time/start_time
  if (event.date) {
    instances.push({
      date: event.date,
      time: normalizeTime(event.time || event.start_time || event.time_start),
      end_date: event.end_date || null,
    });
  }

  // Format 2: date_start + optional date_end
  if (!instances.length && event.date_start) {
    instances.push({
      date: event.date_start,
      time: normalizeTime(event.time || event.start_time || event.time_start),
      end_date: event.date_end || null,
    });
  }

  // Format 3: dates array [{start_date, end_date}]
  if (!instances.length && Array.isArray(event.dates) && event.dates.length > 0) {
    for (const d of event.dates) {
      const date = d.start_date || d.date;
      if (!date) continue;
      instances.push({
        date,
        time: normalizeTime(d.time || d.start_time),
        end_date: d.end_date || null,
      });
    }
  }

  // Format 4: start_datetime like "2026-10-03T21:30:00"
  if (!instances.length && event.start_datetime) {
    const dt = event.start_datetime;
    const dateMatch = dt.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/);
    if (dateMatch) {
      instances.push({
        date: dateMatch[1],
        time: normalizeTime(dateMatch[2]),
        end_date: null,
      });
    }
  }

  return instances.length ? instances : null;
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const lookupHash = db.prepare('SELECT id FROM events WHERE event_hash = ?');
const hasInstances = db.prepare('SELECT COUNT(*) as cnt FROM event_instances WHERE event_id = ?');
const insertInstance = db.prepare(`
  INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone)
  VALUES (?, ?, ?, ?, 'America/Edmonton')
`);

const batch = JSON.parse(readFileSync(batchFile, 'utf8'));
const allEvents = batch.results.flatMap(r => r.events || []);

let repaired = 0;
let instancesAdded = 0;
let skipped = 0;
let notFound = 0;

const doRepair = db.transaction(() => {
  for (const event of allEvents) {
    if (!event.title) continue;

    const hash = eventHash(event.title, event.venue);
    const row = lookupHash.get(hash);
    if (!row) { notFound++; continue; }

    const { cnt } = hasInstances.get(row.id);
    if (cnt > 0) { skipped++; continue; }

    const instances = extractInstances(event);
    if (!instances || instances.length === 0) { skipped++; continue; }

    for (const inst of instances) {
      if (!inst.date) continue;
      insertInstance.run(row.id, inst.date, inst.time, inst.end_date);
      instancesAdded++;
    }
    repaired++;
  }
});

doRepair();
db.close();

console.log(`Repair complete: ${repaired} events repaired, ${instancesAdded} instances added`);
console.log(`  Skipped (already had instances or no date): ${skipped}`);
console.log(`  Not found in DB: ${notFound}`);
