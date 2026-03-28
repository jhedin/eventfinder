#!/usr/bin/env node
// Records relevance decisions for events into sent_events.
// Called once per event after the LLM has assessed it.
//
// Usage:
//   node scripts/record-relevance.js <event_id> <status> <reason>
//
//   status: "pending" (matches preferences) or "excluded" (does not match)
//   reason: plain text explanation (quote it in shell)
//
// Example:
//   node scripts/record-relevance.js 42 pending "Jazz quartet at intimate venue — matches user's jazz interest"
//   node scripts/record-relevance.js 43 excluded "Heavy metal festival — explicitly excluded"

import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const [,, eventId, status, reason] = process.argv;

if (!eventId || !status || !reason) {
  console.error('Usage: node scripts/record-relevance.js <event_id> <status> <reason>');
  console.error('  status: "pending" or "excluded"');
  process.exit(1);
}

if (status !== 'pending' && status !== 'excluded') {
  console.error(`Invalid status "${status}" — must be "pending" or "excluded"`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const existing = db.prepare('SELECT id FROM sent_events WHERE event_id = ? LIMIT 1').get(Number(eventId));
if (existing) {
  console.log(`Event ${eventId} already assessed — skipping`);
  db.close();
  process.exit(0);
}

const result = db.prepare(`
  INSERT INTO sent_events (event_id, instance_id, status, reason)
  SELECT ?, id, ?, ? FROM event_instances WHERE event_id = ?
`).run(Number(eventId), status, reason, Number(eventId));

db.close();
console.log(`Event ${eventId}: ${status} (${result.changes} instance(s) recorded)`);
