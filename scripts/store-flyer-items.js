#!/usr/bin/env node
// Phase 2.5: Persist curated flyer deals to the database.

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Build a lookup of raw items by store name for sale date / image_url lookups
const rawByStore = {};
for (const store of raw) {
  rawByStore[store.store_name] = store;
}

const db = new Database(DB_PATH);

// Ensure flyer source rows exist (type = 'flyer')
const upsertSource = db.prepare(`
  INSERT INTO sources (name, url, type, added_at)
  VALUES (?, ?, 'flyer', datetime('now'))
  ON CONFLICT(url) DO NOTHING
`);

const getSource = db.prepare(`SELECT id FROM sources WHERE url = ?`);

// Collect all store names from curated results
const storeNames = new Set();
for (const items of Object.values(curated.categories)) {
  for (const item of items) {
    storeNames.add(item.store);
  }
}

for (const storeName of storeNames) {
  const url = 'flipp://' + storeName.toLowerCase().replace(/\s+/g, '-');
  upsertSource.run(storeName, url);
}

// Insert flyer items
const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category,
     sale_start, sale_end, image_url, source_id, source_url, discovered_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

let stored = 0;
let skipped = 0;

const insertMany = db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const storeName = item.store;
      const storeUrl = 'flipp://' + storeName.toLowerCase().replace(/\s+/g, '-');
      const sourceRow = getSource.get(storeUrl);
      if (!sourceRow) continue;

      // Use sale dates from curated item (which came from raw batch)
      const saleStart = item.sale_start || null;
      const saleEnd = item.sale_end || null;

      // Look up image_url from raw data
      let imageUrl = null;
      const rawStore = rawByStore[storeName];
      if (rawStore) {
        const rawItem = rawStore.items.find(r =>
          r.name === item.name && r.image_url
        );
        if (rawItem) imageUrl = rawItem.image_url;
      }
      if (!imageUrl) imageUrl = item.image_url || null;

      const hashInput = [item.name, item.brand || '', item.price, String(sourceRow.id), saleEnd || ''].join('|');
      const itemHash = createHash('sha256').update(hashInput).digest('hex').slice(0, 32);

      const result = insertItem.run(
        itemHash,
        item.name,
        item.brand || null,
        item.price,
        item.original_price || null,
        category,
        saleStart,
        saleEnd,
        imageUrl,
        sourceRow.id,
        storeUrl,
      );

      if (result.changes > 0) {
        stored++;
      } else {
        skipped++;
      }
    }
  }
});

insertMany();
db.close();

console.log(`Phase 2.5 — Store: ${stored} items stored, ${skipped} duplicates skipped`);
