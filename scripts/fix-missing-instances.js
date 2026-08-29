#!/usr/bin/env node
// Fixes events that were imported with 0 instances because subagents used
// non-standard field names (date_start, start_date, date, etc.) instead of
// the expected instances[] array format.
//
// Reads /tmp/eventfinder-batch-merged.json, finds events with 0 instances
// in the DB, and inserts instances from whatever date fields are present.
//
// Usage: node scripts/fix-missing-instances.js

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');
const BATCH_FILE = '/tmp/eventfinder-batch-merged.json';

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

// Extract instances from an event object using whatever field names are present
function extractInstances(event) {
  // Standard format: event.instances[]
  if (Array.isArray(event.instances) && event.instances.length > 0) {
    return event.instances
      .filter(inst => inst.date || inst.instance_date)
      .map(inst => ({
        date: inst.date || inst.instance_date,
        time: inst.time || inst.instance_time || null,
        end_date: inst.end_date || null,
        ticket_sale_date: inst.ticket_sale_date || null,
        ticket_sale_time: inst.ticket_sale_time || null,
      }));
  }

  // Flat format: event.start_date / event.start_time
  const date =
    event.date ||
    event.start_date ||
    event.date_start ||
    event.event_date ||
    null;

  if (!date) return [];

  const time =
    event.time ||
    event.start_time ||
    event.time_start ||
    event.event_time ||
    null;

  const endDate =
    event.end_date ||
    event.date_end ||
    null;

  return [{
    date,
    time: time ? (time.length === 5 ? time + ':00' : time) : null,
    end_date: endDate,
    ticket_sale_date: event.ticket_sale_date || null,
    ticket_sale_time: event.ticket_sale_time || null,
  }];
}

const batch = JSON.parse(readFileSync(BATCH_FILE, 'utf8'));

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const getEventByHash = db.prepare('SELECT id FROM events WHERE event_hash = ?');
const countInstances = db.prepare('SELECT COUNT(*) as cnt FROM event_instances WHERE event_id = ?');
const insertInstance = db.prepare(`
  INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone, ticket_sale_date, ticket_sale_time)
  VALUES (?, ?, ?, ?, 'America/Edmonton', ?, ?)
`);

let fixed = 0;
let instancesAdded = 0;
let alreadyHasInstances = 0;
let noDateFound = 0;

const fixAll = db.transaction(() => {
  for (const result of (batch.results || [])) {
    if (!result.success) continue;
    for (const event of (result.events || [])) {
      const hash = eventHash(event.title, event.venue);
      const row = getEventByHash.get(hash);
      if (!row) continue;

      const { cnt } = countInstances.get(row.id);
      if (cnt > 0) {
        alreadyHasInstances++;
        continue;
      }

      const instances = extractInstances(event);
      if (instances.length === 0) {
        noDateFound++;
        continue;
      }

      for (const inst of instances) {
        if (!inst.date) continue;
        insertInstance.run(
          row.id,
          inst.date,
          inst.time,
          inst.end_date,
          inst.ticket_sale_date,
          inst.ticket_sale_time
        );
        instancesAdded++;
      }
      fixed++;
    }
  }
});

fixAll();
db.close();

console.log(`Fix complete:
  Events fixed:        ${fixed}
  Instances inserted:  ${instancesAdded}
  Already had instances: ${alreadyHasInstances}
  No date found:       ${noDateFound}
`);
