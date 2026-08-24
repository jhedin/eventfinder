#!/usr/bin/env node
/**
 * Store curated flyer items in the database.
 * Reads: /tmp/eventfinder-flyer-curated.json, /tmp/eventfinder-flyer-batch-flipp.json
 * Writes: data/eventfinder.db
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const DB_PATH = 'data/eventfinder.db';

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Build a lookup: store_name -> { sale_start, sale_end, items by normalized name }
const rawIndex = {};
for (const store of raw) {
  const byName = {};
  for (const item of store.items) {
    if (item.name) {
      const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      byName[key] = item;
    }
  }
  rawIndex[store.store_name] = {
    sale_start: store.sale_start,
    sale_end: store.sale_end,
    byName,
  };
}

function itemHash(itemName, brand, salePrice, sourceId, saleEnd) {
  return createHash('sha256')
    .update([itemName, brand || '', salePrice, String(sourceId), saleEnd || ''].join('|'))
    .digest('hex')
    .slice(0, 64);
}

const db = new Database(DB_PATH);

const ensureSource = db.prepare(`
  INSERT INTO sources (url, name, type, active)
  VALUES (?, ?, 'flyer', 1)
  ON CONFLICT(url) DO UPDATE SET active=1
  RETURNING id
`);

const getSourceId = db.prepare(`SELECT id FROM sources WHERE url = ?`);

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category, sale_start, sale_end, image_url, source_id, source_url)
  VALUES
    (@item_hash, @item_name, @brand, @sale_price, @regular_price, @category, @sale_start, @sale_end, @image_url, @source_id, @source_url)
`);

let stored = 0;
let duplicates = 0;

const allItems = Object.entries(curated.categories).flatMap(([category, items]) =>
  items.map(i => ({ ...i, category }))
);

db.transaction(() => {
  for (const item of allItems) {
    const storeName = item.store;
    const storeUrl = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;

    // Ensure source exists
    let sourceRow = getSourceId.get(storeUrl);
    if (!sourceRow) {
      const inserted = ensureSource.get(storeUrl, storeName);
      sourceRow = inserted || getSourceId.get(storeUrl);
    }
    const sourceId = sourceRow.id;

    // Cross-reference raw data for sale dates and image_url
    const storeRaw = rawIndex[storeName] || {};
    const nameKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rawItem = (storeRaw.byName || {})[nameKey] || {};
    const saleStart = storeRaw.sale_start || null;
    const saleEnd = storeRaw.sale_end || null;
    const imageUrl = rawItem.image_url || null;

    const hash = itemHash(item.name, item.brand || null, item.price, sourceId, saleEnd);

    const result = insertItem.run({
      item_hash: hash,
      item_name: item.name,
      brand: item.brand || null,
      sale_price: item.price,
      regular_price: item.original_price || null,
      category: item.category,
      sale_start: saleStart,
      sale_end: saleEnd,
      image_url: imageUrl,
      source_id: sourceId,
      source_url: storeUrl,
    });

    if (result.changes > 0) {
      stored++;
    } else {
      duplicates++;
    }
  }
})();

console.log(`\n=== Phase 2.5: Store ===`);
console.log(`${stored} items stored, ${duplicates} duplicates skipped`);
