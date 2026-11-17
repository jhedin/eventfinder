#!/usr/bin/env node
// Phase 2.5: Store curated flyer items into the database.

import { readFileSync } from 'node:fs';
import { createHash as hashFn } from 'node:crypto';
import Database from 'better-sqlite3';

const CURATED = '/tmp/eventfinder-flyer-curated.json';
const DB_PATH = 'data/eventfinder.db';

const curated = JSON.parse(readFileSync(CURATED, 'utf8'));
const db = new Database(DB_PATH);

// Ensure sources exist for each store
const ensureSource = db.prepare(`
  INSERT OR IGNORE INTO sources (url, name, type, active)
  VALUES (?, ?, 'flyer', 1)
`);
const getSource = db.prepare(`SELECT id FROM sources WHERE url = ?`);

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category, sale_start, sale_end, image_url, source_id, source_url)
  VALUES
    (@item_hash, @item_name, @brand, @sale_price, @regular_price, @category, @sale_start, @sale_end, @image_url, @source_id, @source_url)
`);

function makeHash(str) {
  return hashFn('sha256').update(str).digest('hex').slice(0, 32);
}

let stored = 0;
let skipped = 0;

const storeCache = {};

function getSourceId(storeName) {
  if (storeCache[storeName]) return storeCache[storeName];
  const url = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;
  ensureSource.run(url, storeName);
  const row = getSource.get(url);
  storeCache[storeName] = row.id;
  return row.id;
}

const run = db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      if (!item.price) continue; // sale_price is NOT NULL

      const sourceId = getSourceId(item.store);
      const sourceUrl = `flipp://${item.store.toLowerCase().replace(/\s+/g, '-')}`;
      const hashStr = `${item.name}|${item.brand || ''}|${item.price}|${sourceId}|${item.sale_end || ''}`;
      const itemHash = makeHash(hashStr);

      const result = insertItem.run({
        item_hash: itemHash,
        item_name: item.name,
        brand: item.brand || null,
        sale_price: item.price,
        regular_price: item.original_price || null,
        category,
        sale_start: item.sale_start || null,
        sale_end: item.sale_end || null,
        image_url: item.image_url || null,
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

run();
db.close();

console.log(`Phase 2.5 — Store: ${stored} items stored, ${skipped} duplicates skipped`);
