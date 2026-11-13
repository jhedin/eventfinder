#!/usr/bin/env node

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');
const CURATED_FILE = '/tmp/eventfinder-flyer-curated.json';
const RAW_FILE = '/tmp/eventfinder-flyer-batch-flipp.json';

const curated = JSON.parse(readFileSync(CURATED_FILE, 'utf8'));
const raw = JSON.parse(readFileSync(RAW_FILE, 'utf8'));

// Build a lookup map from raw data: store_name → { sale_start, sale_end, items by name }
const rawByStore = {};
for (const store of raw) {
  rawByStore[store.store_name] = {
    sale_start: store.sale_start,
    sale_end: store.sale_end,
    itemsByName: Object.fromEntries(store.items.map(i => [i.name?.toLowerCase().trim(), i])),
  };
}

const db = new Database(DB_PATH);

function ensureSource(storeName) {
  const url = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;
  const existing = db.prepare('SELECT id FROM sources WHERE url = ?').get(url);
  if (existing) return existing.id;
  const result = db.prepare(
    'INSERT INTO sources (url, name, type) VALUES (?, ?, ?)'
  ).run(url, storeName, 'flyer');
  return result.lastInsertRowid;
}

function itemHash(itemName, brand, salePrice, sourceId, saleEnd) {
  return createHash('sha256')
    .update([itemName, brand || '', salePrice, String(sourceId), saleEnd || ''].join('|'))
    .digest('hex')
    .slice(0, 32);
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

const storeAll = db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const sourceId = ensureSource(item.store);
      const sourceUrl = `flipp://${item.store.toLowerCase().replace(/\s+/g, '-')}`;

      // Look up raw data for this item to get sale dates and image_url
      const rawStore = rawByStore[item.store] || rawByStore['Safeway']; // Sobeys merged into Safeway
      const rawItem = rawStore?.itemsByName[item.name.toLowerCase().trim()];
      const sale_start = rawStore?.sale_start || null;
      const sale_end = rawStore?.sale_end || null;
      const image_url = rawItem?.image_url || null;

      const hash = itemHash(item.name, item.brand || null, item.price, sourceId, sale_end);

      const info = {
        item_hash: hash,
        item_name: item.name,
        brand: item.brand || null,
        sale_price: item.price,
        regular_price: item.original_price || null,
        category,
        sale_start,
        sale_end,
        image_url,
        source_id: sourceId,
        source_url: sourceUrl,
      };

      const result = insertItem.run(info);
      if (result.changes > 0) {
        stored++;
      } else {
        skipped++;
      }
    }
  }
});

storeAll();
db.close();

console.log(`Phase 2.5 — Store: ${stored} items stored, ${skipped} duplicates skipped`);
