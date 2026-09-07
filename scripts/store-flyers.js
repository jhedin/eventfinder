#!/usr/bin/env node
// Phase 2.5: Persist curated flyer items into the database.
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const DB_PATH = 'data/eventfinder.db';

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
const db = new Database(DB_PATH);

const ensureSource = db.prepare(`
  INSERT OR IGNORE INTO sources (url, name, type)
  VALUES (?, ?, 'flyer')
`);
const getSource = db.prepare(`SELECT id FROM sources WHERE url = ?`);

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category,
     sale_start, sale_end, image_url, source_id, source_url)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let stored = 0;
let skipped = 0;

const storeRun = db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const storeName = item.store;
      const sourceUrl = `flipp://${storeName.toLowerCase().replace(/\s+/g, '-')}`;

      // Ensure source row exists
      ensureSource.run(sourceUrl, storeName);
      const sourceRow = getSource.get(sourceUrl);
      const sourceId = sourceRow.id;

      // Compute hash: item_name + brand + sale_price + source_id + sale_end
      const hashInput = [
        item.name || '',
        item.brand || '',
        item.price || '',
        String(sourceId),
        item.sale_end || '',
      ].join('|');
      const itemHash = createHash('sha256').update(hashInput).digest('hex').slice(0, 32);

      const result = insertItem.run(
        itemHash,
        item.name,
        item.brand || null,
        item.price || '',
        item.original_price || null,
        category,
        item.sale_start || null,
        item.sale_end || null,
        item.image_url || null,
        sourceId,
        sourceUrl,
      );

      if (result.changes > 0) {
        stored++;
      } else {
        skipped++;
      }
    }
  }
});

storeRun();

console.log(`${stored} items stored, ${skipped} duplicates skipped`);
