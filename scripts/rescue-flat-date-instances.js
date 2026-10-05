#!/usr/bin/env node
// One-time rescue script: reads the merged batch file and inserts missing event_instances
// for events where subagents used flat date fields (date/start_time) instead of instances[].
//
// Usage: node scripts/rescue-flat-date-instances.js [batchFile]
// Default batch file: /tmp/eventfinder-batch-merged.json

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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

function normalizeTime(t) {
  if (!t) return null;
  // Accept HH:MM or HH:MM:SS
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return `${m[1].padStart(2,'0')}:${m[2]}:${m[3] || '00'}`;
  return null;
}

const batch = JSON.parse(readFileSync(batchFile, 'utf8'));

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const findEvent  = db.prepare('SELECT id FROM events WHERE event_hash = ?');
const countInst  = db.prepare('SELECT COUNT(*) as cnt FROM event_instances WHERE event_id = ?');
const insertInst = db.prepare(`
  INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone, ticket_sale_date, ticket_sale_time)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
let skipped  = 0;

const run = db.transaction(() => {
  for (const result of (batch.results || [])) {
    for (const ev of (result.events || [])) {
      // Only rescue events that lack an instances array
      if (ev.instances && ev.instances.length > 0) continue;
      if (!ev.date && !ev.start_date) continue; // no date to rescue

      const hash = eventHash(ev.title, ev.venue);
      const row = findEvent.get(hash);
      if (!row) continue;

      const { cnt } = countInst.get(row.id);
      if (cnt > 0) {
        skipped++;
        continue;
      }

      // Use flat fields as a single instance
      const date = ev.date || ev.start_date || null;
      const time = normalizeTime(ev.start_time || ev.time || null);
      const endDate = ev.end_date || null;
      const timezone = ev.timezone || 'America/Edmonton';
      const ticketSaleDate = ev.ticket_sale_date || null;
      const ticketSaleTime = ev.ticket_sale_time ? normalizeTime(ev.ticket_sale_time) : null;

      insertInst.run(row.id, date, time, endDate, timezone, ticketSaleDate, ticketSaleTime);
      inserted++;
    }
  }
});

run();
db.close();

console.log(`Rescue complete: ${inserted} instance(s) inserted, ${skipped} event(s) already had instances`);
