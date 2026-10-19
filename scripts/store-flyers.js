#!/usr/bin/env node
// Store curated flyer items into the database
import fs from 'fs';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const DB_PATH = '/home/user/eventfinder/data/eventfinder.db';

const curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));
const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));

// Build lookup from raw: store_name -> { sale_start, sale_end, items: Map<name, item> }
const rawByStore = {};
for (const store of raw) {
  rawByStore[store.store_name] = {
    sale_start: store.sale_start,
    sale_end: store.sale_end,
    itemsByName: new Map(store.items.map(i => [i.name, i])),
  };
}

const db = new Database(DB_PATH);

// Check if flyer_items table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
console.log('Existing tables:', tables);

if (!tables.includes('flyer_items')) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flyer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_hash TEXT UNIQUE NOT NULL,
      item_name TEXT NOT NULL,
      brand TEXT,
      sale_price TEXT,
      regular_price TEXT,
      category TEXT,
      sale_start TEXT,
      sale_end TEXT,
      image_url TEXT,
      source_id INTEGER,
      source_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Created flyer_items table');
}

// Ensure sources exist for each store
const storeNames = new Set();
for (const items of Object.values(curated.categories)) {
  for (const item of items) {
    storeNames.add(item.store);
  }
}

const getSource = db.prepare("SELECT id FROM sources WHERE url = ?");
const insertSource = db.prepare("INSERT OR IGNORE INTO sources (name, url, type) VALUES (?, ?, 'flyer')");

const sourceIds = {};
for (const storeName of storeNames) {
  const url = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;
  insertSource.run(storeName, url);
  const row = getSource.get(url);
  sourceIds[storeName] = row ? row.id : null;
}

// Insert items
const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category, sale_start, sale_end, image_url, source_id, source_url)
  VALUES
    (@item_hash, @item_name, @brand, @sale_price, @regular_price, @category, @sale_start, @sale_end, @image_url, @source_id, @source_url)
`);

let stored = 0;
let duplicates = 0;

for (const [category, items] of Object.entries(curated.categories)) {
  for (const item of items) {
    const sourceId = sourceIds[item.store];
    const sourceUrl = `flipp://${item.store.toLowerCase().replace(/\s+/g, '-')}`;
    const saleEnd = item.sale_end || '';

    const hashStr = `${item.name}|${item.brand || ''}|${item.price}|${sourceId}|${saleEnd}`;
    const itemHash = crypto.createHash('sha256').update(hashStr).digest('hex').slice(0, 16);

    // Try to get image_url from raw data
    const rawStore = rawByStore[item.store];
    let imageUrl = item.image_url || null;
    if (!imageUrl && rawStore) {
      const rawItem = rawStore.itemsByName.get(item.name);
      if (rawItem) imageUrl = rawItem.image_url || null;
    }

    const result = insertItem.run({
      item_hash: itemHash,
      item_name: item.name,
      brand: item.brand || null,
      sale_price: item.price || null,
      regular_price: item.original_price || null,
      category,
      sale_start: item.sale_start || null,
      sale_end: item.sale_end || null,
      image_url: imageUrl,
      source_id: sourceId,
      source_url: sourceUrl,
    });

    if (result.changes > 0) {
      stored++;
    } else {
      duplicates++;
    }
  }
}

db.close();
console.log(`\n${stored} items stored, ${duplicates} duplicates skipped`);
