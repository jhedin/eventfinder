#!/usr/bin/env node
/**
 * Store curated flyer items into the database.
 * Reads: /tmp/eventfinder-flyer-curated.json, /tmp/eventfinder-flyer-batch-flipp.json
 */

import fs from 'fs';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'eventfinder.db');
const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';

const db = new Database(DB_PATH);
const curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));
const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));

// Build lookup: storeName → { sale_start, sale_end, itemsByName }
const storeRaw = {};
for (const store of Object.values(raw)) {
  if (!store.success) continue;
  const key = store.store_name;
  storeRaw[key] = {
    sale_start: store.sale_start,
    sale_end: store.sale_end,
    items: new Map((store.items || []).map(i => [i.name, i])),
  };
}

function ensureSource(storeName) {
  const url = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;
  let row = db.prepare('SELECT id FROM sources WHERE url = ?').get(url);
  if (!row) {
    db.prepare(`INSERT INTO sources (url, name, type) VALUES (?, ?, 'flyer')`).run(url, storeName);
    row = db.prepare('SELECT id FROM sources WHERE url = ?').get(url);
  }
  return row.id;
}

function hashItem(itemName, brand, salePrice, sourceId, saleEnd) {
  return createHash('sha256')
    .update([itemName, brand || '', salePrice || '', String(sourceId), saleEnd || ''].join('|'))
    .digest('hex')
    .slice(0, 32);
}

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category, sale_start, sale_end, image_url, source_id, source_url)
  VALUES
    (@item_hash, @item_name, @brand, @sale_price, @regular_price, @category, @sale_start, @sale_end, @image_url, @source_id, @source_url)
`);

let stored = 0, skipped = 0;

const storeAll = db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const sourceId = ensureSource(item.store);
      const storeData = storeRaw[item.store] || {};
      const rawItem = storeData.items ? storeData.items.get(item.name) : null;
      const saleStart = storeData.sale_start || null;
      const saleEnd = storeData.sale_end || null;
      const imageUrl = rawItem ? rawItem.image_url || null : null;
      const sourceUrl = `flipp://${item.store.toLowerCase().replace(/\s+/g, '-')}`;

      const itemHash = hashItem(item.name, item.brand, item.price, sourceId, saleEnd);

      const result = insertItem.run({
        item_hash: itemHash,
        item_name: item.name,
        brand: item.brand || null,
        sale_price: item.price || null,
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

storeAll();
db.close();

console.log(`${stored} items stored, ${skipped} duplicates skipped`);
