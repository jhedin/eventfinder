#!/usr/bin/env node
// Idempotent migration: fixes broken views, adds missing indexes, adds FTS5.
//
// Issues fixed:
// - v_last_digest and v_unsent_upcoming_events reference "sent_events_old"
// - Missing indexes on sent_events (event, status, sent_at)
// - Missing events_fts FTS5 table and sync triggers
//
// Safe to run multiple times.
//
// Usage: node scripts/migrate-fix-views-indexes-fts.js

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function indexExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(name);
  return !!row;
}

function tableExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name=?").get(name);
  return !!row;
}

function triggerExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?").get(name);
  return !!row;
}

console.log('Running views/indexes/FTS migration...\n');

// 1. Fix broken views (drop and recreate)
console.log('-- Views --');

db.exec('DROP VIEW IF EXISTS v_last_digest');
db.exec(`
  CREATE VIEW v_last_digest AS
  SELECT
    e.title,
    e.venue,
    ei.instance_date,
    ei.instance_time,
    se.sent_at,
    s.name as source_name
  FROM sent_events se
  JOIN events e ON e.id = se.event_id
  JOIN event_instances ei ON ei.id = se.instance_id
  JOIN sources s ON s.id = e.source_id
  WHERE se.status = 'sent'
    AND se.sent_at = (SELECT MAX(sent_at) FROM sent_events WHERE status = 'sent')
  ORDER BY ei.instance_date
`);
console.log('+ Recreated v_last_digest (fixed sent_events_old → sent_events)');

db.exec('DROP VIEW IF EXISTS v_unsent_upcoming_events');
db.exec(`
  CREATE VIEW v_unsent_upcoming_events AS
  SELECT
    e.id as event_id,
    e.title,
    e.venue,
    e.description,
    e.price,
    e.event_url,
    ei.id as instance_id,
    ei.instance_date,
    ei.instance_time,
    ei.timezone,
    s.name as source_name,
    s.url as source_url
  FROM events e
  JOIN event_instances ei ON ei.event_id = e.id
  JOIN sources s ON s.id = e.source_id
  WHERE ei.instance_date >= date('now')
    AND e.id NOT IN (
      SELECT event_id
      FROM sent_events
      WHERE status = 'sent'
    )
  ORDER BY ei.instance_date, ei.instance_time
`);
console.log('+ Recreated v_unsent_upcoming_events (fixed sent_events_old → sent_events)');

// 2. Add missing indexes on sent_events
console.log('\n-- Indexes --');

for (const [name, sql] of [
  ['idx_sent_events_event', 'CREATE INDEX idx_sent_events_event ON sent_events(event_id)'],
  ['idx_sent_events_status', 'CREATE INDEX idx_sent_events_status ON sent_events(status)'],
  ['idx_sent_events_sent_at', 'CREATE INDEX idx_sent_events_sent_at ON sent_events(sent_at)'],
]) {
  if (!indexExists(name)) {
    db.exec(sql);
    console.log(`+ Created ${name}`);
  } else {
    console.log(`- ${name} already exists`);
  }
}

// 3. Add FTS5 table and triggers
console.log('\n-- FTS5 --');

if (!tableExists('events_fts')) {
  db.exec(`
    CREATE VIRTUAL TABLE events_fts USING fts5(
      title,
      description,
      venue,
      content='events',
      content_rowid='id',
      tokenize='porter unicode61'
    )
  `);
  db.exec("INSERT INTO events_fts(events_fts) VALUES('rebuild')");
  console.log('+ Created events_fts and rebuilt index');
} else {
  console.log('- events_fts already exists');
}

for (const [name, sql] of [
  ['events_ai', `
    CREATE TRIGGER events_ai AFTER INSERT ON events BEGIN
      INSERT INTO events_fts(rowid, title, description, venue)
      VALUES (new.id, new.title, new.description, new.venue);
    END
  `],
  ['events_ad', `
    CREATE TRIGGER events_ad AFTER DELETE ON events BEGIN
      INSERT INTO events_fts(events_fts, rowid, title, description, venue)
      VALUES ('delete', old.id, old.title, old.description, old.venue);
    END
  `],
  ['events_au', `
    CREATE TRIGGER events_au AFTER UPDATE ON events BEGIN
      INSERT INTO events_fts(events_fts, rowid, title, description, venue)
      VALUES ('delete', old.id, old.title, old.description, old.venue);
      INSERT INTO events_fts(rowid, title, description, venue)
      VALUES (new.id, new.title, new.description, new.venue);
    END
  `],
]) {
  if (!triggerExists(name)) {
    db.exec(sql);
    console.log(`+ Created trigger ${name}`);
  } else {
    console.log(`- Trigger ${name} already exists`);
  }
}

// 4. Clean up sent_events_old if it exists (orphan from previous migration)
const oldTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sent_events_old'").get();
if (oldTable) {
  console.log('\n-- Cleanup --');
  db.exec('DROP TABLE sent_events_old');
  console.log('+ Dropped orphan table sent_events_old');
}

db.close();
console.log('\nMigration complete.');
