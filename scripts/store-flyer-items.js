#!/usr/bin/env node
/**
 * Persists curated flyer deals into the SQLite database.
 * - Ensures flyer sources exist (type='flyer')
 * - Inserts flyer_items with INSERT OR IGNORE for deduplication
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../data/eventfinder.db');
const CURATED_FILE = '/tmp/eventfinder-flyer-curated.json';
const BATCH_FILE = '/tmp/eventfinder-flyer-batch-flipp.json';

const db = new Database(DB_PATH);
const curated = JSON.parse(readFileSync(CURATED_FILE, 'utf8'));
const batch = JSON.parse(readFileSync(BATCH_FILE, 'utf8'));

// Build a lookup: storeName -> batch store metadata
const batchByStore = {};
for (const store of batch) {
  batchByStore[store.store_name] = store;
}

// Build item lookup: storeName -> itemName -> item (for image_url)
const batchItemsByStore = {};
for (const store of batch) {
  batchItemsByStore[store.store_name] = {};
  for (const item of store.items) {
    if (item.name) {
      batchItemsByStore[store.store_name][item.name.toLowerCase()] = item;
    }
  }
}

function getOrCreateSource(storeName) {
  const url = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;
  const existing = db.prepare('SELECT id FROM sources WHERE url = ?').get(url);
  if (existing) return existing.id;

  const result = db.prepare(
    'INSERT INTO sources (url, name, type, active) VALUES (?, ?, ?, ?)'
  ).run(url, storeName, 'flyer', 1);
  return result.lastInsertRowid;
}

function hash(...parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

function findImageUrl(storeName, itemName) {
  const storeItems = batchItemsByStore[storeName];
  if (!storeItems) return null;
  const key = itemName.toLowerCase();
  // Try exact match first
  if (storeItems[key]) return storeItems[key].image_url || null;
  // Try partial match
  for (const [k, v] of Object.entries(storeItems)) {
    if (k.includes(key.slice(0, 20)) || key.includes(k.slice(0, 20))) {
      return v.image_url || null;
    }
  }
  return null;
}

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category,
     sale_start, sale_end, image_url, source_id, source_url)
  VALUES
    (@item_hash, @item_name, @brand, @sale_price, @regular_price, @category,
     @sale_start, @sale_end, @image_url, @source_id, @source_url)
`);

let stored = 0;
let skipped = 0;

const insertMany = db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const storeName = item.store;
      const sourceId = getOrCreateSource(storeName);
      const sourceUrl = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;

      const storeData = batchByStore[storeName];
      const saleStart = storeData ? storeData.sale_start : null;
      const saleEnd = storeData ? storeData.sale_end : null;

      const itemHash = hash(item.name, item.brand || '', item.price, String(sourceId), saleEnd || '');
      const imageUrl = findImageUrl(storeName, item.name);

      const result = insertItem.run({
        item_hash: itemHash,
        item_name: item.name,
        brand: item.brand || null,
        sale_price: item.price,
        regular_price: item.original_price || null,
        category,
        sale_start: saleStart,
        sale_end: saleEnd,
        image_url: imageUrl,
        source_id: sourceId,
        source_url: sourceUrl,
      });

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

console.log(`${stored} items stored, ${skipped} duplicates skipped`);
