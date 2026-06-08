#!/usr/bin/env node
/**
 * Phase 2.5 — Store curated flyer items in the database.
 * Reads /tmp/eventfinder-flyer-curated.json and /tmp/eventfinder-flyer-batch-flipp.json
 * Inserts sources (type=flyer) and flyer_items with INSERT OR IGNORE deduplication.
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';

const curated = JSON.parse(readFileSync('/tmp/eventfinder-flyer-curated.json', 'utf8'));
const raw = JSON.parse(readFileSync('/tmp/eventfinder-flyer-batch-flipp.json', 'utf8'));

// Build lookup: store_name -> { sale_start, sale_end, items: Map<name, image_url> }
const storeMeta = {};
for (const store of raw) {
  const items = new Map();
  for (const item of store.items) {
    const key = (item.name || '').trim().toLowerCase();
    if (!items.has(key)) {
      items.set(key, item.image_url || null);
    }
  }
  storeMeta[store.store_name] = {
    sale_start: store.sale_start ? store.sale_start.split('T')[0] : null,
    sale_end: store.sale_end ? store.sale_end.split('T')[0] : null,
    items,
  };
}

const db = new Database('data/eventfinder.db');

// Ensure sources exist for each flyer store
const upsertSource = db.prepare(`
  INSERT INTO sources (url, name, type)
  VALUES (?, ?, 'flyer')
  ON CONFLICT(url) DO UPDATE SET name=excluded.name
`);

const getSourceId = db.prepare(`SELECT id FROM sources WHERE url = ?`);

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category,
     sale_start, sale_end, image_url, source_id, source_url)
  VALUES
    (@item_hash, @item_name, @brand, @sale_price, @regular_price, @category,
     @sale_start, @sale_end, @image_url, @source_id, @source_url)
`);

function makeHash(...parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

let stored = 0;
let skipped = 0;

// Collect unique stores from curated data
const storeNames = new Set();
for (const items of Object.values(curated.categories)) {
  for (const item of items) storeNames.add(item.store);
}

// Ensure sources
for (const storeName of storeNames) {
  const url = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;
  upsertSource.run(url, storeName);
}

// Insert items
const insertMany = db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const storeName = item.store;
      const url = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;
      const sourceRow = getSourceId.get(url);
      if (!sourceRow) continue;
      const sourceId = sourceRow.id;

      const meta = storeMeta[storeName] || {};
      const saleEnd = meta.sale_end || null;
      const imageUrl = meta.items?.get((item.name || '').trim().toLowerCase()) || null;

      const hash = makeHash(
        item.name || '',
        item.brand || '',
        item.price || '',
        String(sourceId),
        saleEnd || ''
      );

      const result = insertItem.run({
        item_hash: hash,
        item_name: item.name,
        brand: item.brand || null,
        sale_price: item.price || 'n/a',
        regular_price: item.original_price || null,
        category,
        sale_start: meta.sale_start || null,
        sale_end: saleEnd,
        image_url: imageUrl,
        source_id: sourceId,
        source_url: url,
      });

      if (result.changes > 0) stored++;
      else skipped++;
    }
  }
});

insertMany();

console.log(`${stored} items stored, ${skipped} duplicates skipped`);
