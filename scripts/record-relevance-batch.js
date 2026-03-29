#!/usr/bin/env node
// Records relevance decisions for multiple events at once.
// Reads a JSON array from stdin or a file argument.
//
// Usage (pipe JSON):
//   echo '[{"event_id":42,"status":"pending","reason":"..."},...]' | node scripts/record-relevance-batch.js
//
// Usage (file):
//   node scripts/record-relevance-batch.js /tmp/relevance-decisions.json
//
// Each item: { event_id: number, status: "pending"|"excluded", reason: string }

import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

let input;
if (process.argv[2]) {
  input = readFileSync(process.argv[2], 'utf8');
} else {
  input = readFileSync('/dev/stdin', 'utf8');
}

const decisions = JSON.parse(input);

if (!Array.isArray(decisions) || decisions.length === 0) {
  console.error('Expected a non-empty JSON array of decisions');
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const insert = db.prepare(`
  INSERT INTO sent_events (event_id, instance_id, status, reason)
  SELECT ?, id, ?, ? FROM event_instances WHERE event_id = ?
`);
const checkExisting = db.prepare('SELECT id FROM sent_events WHERE event_id = ? LIMIT 1');

let recorded = 0;
let skipped = 0;

const runAll = db.transaction(() => {
  for (const { event_id, status, reason } of decisions) {
    if (!event_id || !status || !reason) {
      console.warn(`Skipping invalid entry: ${JSON.stringify({ event_id, status, reason })}`);
      continue;
    }
    if (status !== 'pending' && status !== 'excluded') {
      console.warn(`Skipping event ${event_id}: invalid status "${status}"`);
      continue;
    }
    const existing = checkExisting.get(Number(event_id));
    if (existing) {
      skipped++;
      continue;
    }
    const result = insert.run(Number(event_id), status, reason, Number(event_id));
    recorded += result.changes;
  }
});

runAll();
db.close();

console.log(`Done: ${recorded} instance(s) recorded, ${skipped} event(s) already assessed`);
