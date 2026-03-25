#!/usr/bin/env node
// Simple SQLite query runner for the EventFinder agent.
// Usage: node scripts/db-query.js "<SQL>" [json_param1] [json_param2] ...
//
// Examples:
//   node scripts/db-query.js "SELECT * FROM sources WHERE active=1"
//   node scripts/db-query.js "SELECT * FROM events WHERE event_hash=?" '"abc123"'

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const [sql, ...paramArgs] = process.argv.slice(2);

if (!sql) {
  console.error('Usage: node scripts/db-query.js "<SQL>" [param1] [param2] ...');
  process.exit(1);
}

const params = paramArgs.map(p => JSON.parse(p));

const db = new Database(DB_PATH);
const stmt = db.prepare(sql);

// Determine if this returns rows (SELECT, PRAGMA, or RETURNING clause)
const upper = sql.trim().toUpperCase();
const returnsRows = upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.includes(' RETURNING ');

if (returnsRows) {
  const rows = stmt.all(...params);
  console.log(JSON.stringify(rows, null, 2));
} else {
  const result = stmt.run(...params);
  console.log(JSON.stringify({ changes: result.changes, lastInsertRowid: result.lastInsertRowid }));
}

db.close();
