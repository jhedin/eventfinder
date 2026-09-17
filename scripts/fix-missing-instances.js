#!/usr/bin/env node
// Reads /tmp/eventfinder-src-*.json files and adds missing instances for events
// that were imported without instances (due to subagents using non-standard field names).
// Handles many flat date formats as well as the proper instances[] format.

import { createRequire } from 'module';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const TMP_DIR = '/tmp';

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

// Parse an ISO datetime string into { date, time }
function parseIso(dt) {
  if (!dt) return { date: null, time: null };
  const m = dt.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}))?/);
  if (m) return { date: m[1], time: m[2] || null };
  return { date: null, time: null };
}

// Normalize a time value to HH:MM:SS or null
function normalizeTime(t) {
  if (!t) return null;
  // Already HH:MM:SS
  const m = t.match(/^(\d{2}:\d{2}(?::\d{2})?)$/);
  if (m) return m[1].length === 5 ? m[1] + ':00' : m[1];
  // Could be part of an ISO string
  const iso = parseIso(t);
  return iso.time || null;
}

// Extract { date, time, end_date } from an event object using any known field pattern
function extractInstance(event) {
  // Canonical format
  if (Array.isArray(event.instances) && event.instances.length > 0) {
    return null; // handled separately in loop below
  }

  let date = null;
  let time = null;
  let end_date = null;

  // Try all known date field combinations
  if (event.start_datetime) {
    const p = parseIso(event.start_datetime);
    date = p.date; time = p.time;
  } else if (event.start_date_time) {
    const p = parseIso(event.start_date_time);
    date = p.date; time = p.time;
  } else if (event.start_date_iso) {
    const p = parseIso(event.start_date_iso);
    date = p.date; time = p.time;
  } else if (event.date_time) {
    const p = parseIso(event.date_time);
    date = p.date; time = p.time;
  } else if (event.start) {
    // "start" field used by source 209
    const p = parseIso(event.start);
    date = p.date; time = p.time;
  } else if (event.start_date) {
    date = event.start_date;
    time = normalizeTime(event.start_time || event.time_start || null);
  } else if (event.date_start) {
    date = event.date_start;
    time = normalizeTime(event.time_start || event.start_time || null);
  } else if (event.date) {
    date = event.date;
    time = normalizeTime(event.time || event.start_time || event.time_start || null);
  }

  // End date
  if (event.end_date) end_date = event.end_date;
  else if (event.date_end) end_date = event.date_end;
  else if (event.end_date_iso) end_date = parseIso(event.end_date_iso).date;
  else if (event.end_datetime) end_date = parseIso(event.end_datetime).date;

  if (!date) return null;
  return { date, time, end_date };
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const getEventByHash = db.prepare('SELECT id FROM events WHERE event_hash = ?');
const getExistingInstance = db.prepare(
  'SELECT id FROM event_instances WHERE event_id = ? AND instance_date = ?'
);
const insertInstance = db.prepare(`
  INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone, ticket_sale_date, ticket_sale_time)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const srcFiles = readdirSync(TMP_DIR)
  .filter(f => /^eventfinder-src-\d+\.json$/.test(f))
  .map(f => join(TMP_DIR, f));

let totalFixed = 0;
let totalSkipped = 0;

const fixAll = db.transaction(() => {
  for (const filePath of srcFiles) {
    let data;
    try {
      data = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }

    for (const result of (data.results || [])) {
      for (const event of (result.events || [])) {
        const hash = eventHash(event.title, event.venue);
        const row = getEventByHash.get(hash);
        if (!row) continue;

        const eventId = row.id;
        const instancesToAdd = [];

        if (Array.isArray(event.instances) && event.instances.length > 0) {
          for (const inst of event.instances) {
            if (inst.date) {
              instancesToAdd.push({
                date: inst.date,
                time: inst.time || null,
                end_date: inst.end_date || null,
                ticket_sale_date: inst.ticket_sale_date || null,
                ticket_sale_time: inst.ticket_sale_time || null,
              });
            }
          }
        } else {
          const inst = extractInstance(event);
          if (inst) {
            instancesToAdd.push({
              date: inst.date,
              time: inst.time,
              end_date: inst.end_date,
              ticket_sale_date: null,
              ticket_sale_time: null,
            });
          }
        }

        for (const inst of instancesToAdd) {
          const existing = getExistingInstance.get(eventId, inst.date);
          if (existing) {
            totalSkipped++;
            continue;
          }
          insertInstance.run(
            eventId,
            inst.date,
            inst.time,
            inst.end_date,
            'America/Edmonton',
            inst.ticket_sale_date,
            inst.ticket_sale_time
          );
          totalFixed++;
        }
      }
    }
  }
});

fixAll();
db.close();

console.log(`Fixed: ${totalFixed} instances added, ${totalSkipped} already existed`);
