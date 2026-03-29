#!/usr/bin/env node
// Idempotent migration: adds flyer support to the existing EventFinder database.
// - Adds `type` column to `sources` (default 'event')
// - Creates `flyer_items` and `sent_flyer_items` tables
//
// Safe to run multiple times.
//
// Usage: node scripts/migrate-add-flyers.js

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Check if a column exists on a table
function columnExists(table, column) {
  const cols = db.pragma(`table_info(${table})`);
  return cols.some(c => c.name === column);
}

// Check if a table exists
function tableExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return !!row;
}

console.log('Running flyer migration...\n');

// 1. Add type column to sources
if (!columnExists('sources', 'type')) {
  db.exec("ALTER TABLE sources ADD COLUMN type TEXT NOT NULL DEFAULT 'event' CHECK (type IN ('event', 'flyer'))");
  db.exec("CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type)");
  console.log("+ Added 'type' column to sources table");
} else {
  console.log("- 'type' column already exists on sources");
}

// 2. Create flyer_items table
if (!tableExists('flyer_items')) {
  db.exec(`
    CREATE TABLE flyer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_hash TEXT NOT NULL UNIQUE,
      item_name TEXT NOT NULL,
      brand TEXT,
      description TEXT,
      sale_price TEXT NOT NULL,
      regular_price TEXT,
      unit TEXT,
      category TEXT,
      sale_start DATE,
      sale_end DATE,
      item_url TEXT,
      image_url TEXT,
      source_id INTEGER NOT NULL,
      source_url TEXT NOT NULL,
      discovered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_flyer_items_hash ON flyer_items(item_hash);
    CREATE INDEX idx_flyer_items_source ON flyer_items(source_id);
    CREATE INDEX idx_flyer_items_sale_end ON flyer_items(sale_end);
    CREATE INDEX idx_flyer_items_discovered ON flyer_items(discovered_at);
    CREATE INDEX idx_flyer_items_category ON flyer_items(category);
  `);
  console.log('+ Created flyer_items table');
} else {
  console.log('- flyer_items table already exists');
}

// 3. Create sent_flyer_items table
if (!tableExists('sent_flyer_items')) {
  db.exec(`
    CREATE TABLE sent_flyer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flyer_item_id INTEGER NOT NULL,
      sent_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (flyer_item_id) REFERENCES flyer_items(id) ON DELETE CASCADE,
      CHECK (status IN ('pending', 'sent', 'skipped'))
    );
    CREATE UNIQUE INDEX idx_sent_flyer_items_unique ON sent_flyer_items(flyer_item_id);
    CREATE INDEX idx_sent_flyer_items_status ON sent_flyer_items(status);
  `);
  console.log('+ Created sent_flyer_items table');
} else {
  console.log('- sent_flyer_items table already exists');
}

db.close();
console.log('\nMigration complete.');
