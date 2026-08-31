#!/usr/bin/env node
// Store curated flyer items into the SQLite database

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../data/eventfinder.db');
const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Build a lookup from store name -> sale dates
const storeDates = {};
for (const store of raw) {
  storeDates[store.store_name] = { sale_start: store.sale_start, sale_end: store.sale_end };
}
// Alias for Superstore display name
storeDates['Superstore'] = storeDates['Real Canadian Superstore'];

const db = new Database(DB_PATH);

let stored = 0;
let skipped = 0;

db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const storeName = item.store;

      // Ensure flyer source row exists
      const sourceUrl = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;
      let source = db.prepare('SELECT id FROM sources WHERE url = ?').get(sourceUrl);
      if (!source) {
        const info = db.prepare(
          "INSERT INTO sources (name, url, type, active) VALUES (?, ?, 'flyer', 1)"
        ).run(storeName, sourceUrl);
        source = { id: info.lastInsertRowid };
      }

      // Find sale dates from raw data (match by store display name)
      const dates = storeDates[storeName] || {};
      const saleEnd = dates.sale_end || null;

      // Compute item_hash: hash(item_name + brand + sale_price + source_id + sale_end)
      const hashInput = `${item.name}${item.brand || ''}${item.price}${source.id}${saleEnd || ''}`;
      const itemHash = createHash('sha256').update(hashInput).digest('hex').slice(0, 32);

      const result = db.prepare(`
        INSERT OR IGNORE INTO flyer_items
          (item_hash, item_name, brand, sale_price, regular_price, category,
           sale_start, sale_end, image_url, source_id, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemHash,
        item.name,
        item.brand || null,
        item.price,
        item.original_price || null,
        category,
        dates.sale_start || null,
        saleEnd,
        item.image_url || null,
        source.id,
        sourceUrl
      );

      if (result.changes > 0) stored++;
      else skipped++;
    }
  }
})();

console.log(`${stored} items stored, ${skipped} duplicates skipped`);
