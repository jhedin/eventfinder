#!/usr/bin/env node
/**
 * store-curated-flyers.js
 *
 * Reads /tmp/eventfinder-flyer-batch-flipp.json (for sale dates + image URLs)
 * and /tmp/eventfinder-flyer-curated.json (curated items), ensures flyer sources
 * exist in the DB, then inserts curated items into flyer_items.
 *
 * Usage: node scripts/store-curated-flyers.js
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH     = join(__dirname, '..', 'data', 'eventfinder.db');
const BATCH_PATH  = '/tmp/eventfinder-flyer-batch-flipp.json';
const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';

// Store name normalization: display name → batch store_name
const STORE_NAME_MAP = {
  'Co-op':         'Calgary Co-op',
  'Safeway':       'Safeway',
  'Superstore':    'Real Canadian Superstore',
  'No Frills':     'No Frills',
  'Wholesale Club':'Wholesale Club',
  'T&T':           'T&T Supermarket',
};

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

function itemHash(itemName, brand, salePrice, sourceId, saleEnd) {
  const key = normalize(itemName) + normalize(brand) + normalize(salePrice) + String(sourceId) + (saleEnd || '');
  return createHash('sha256').update(key).digest('hex');
}

// ---------------------------------------------------------------------------

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
const batch   = JSON.parse(readFileSync(BATCH_PATH, 'utf8'));

// Build lookup: batchStoreName → { sale_start, sale_end, itemMap: name → image_url }
const batchIndex = {};
for (const store of batch) {
  const itemMap = {};
  for (const item of (store.items || [])) {
    if (item.name) itemMap[item.name.toLowerCase()] = item.image_url || null;
  }
  batchIndex[store.store_name] = {
    sale_start: store.sale_start || null,
    sale_end:   store.sale_end   || null,
    itemMap,
  };
}

// Ensure source rows exist for each store
const stmtGetSource = db.prepare("SELECT id FROM sources WHERE url = ?");
const stmtInsertSource = db.prepare(`
  INSERT INTO sources (name, url, active)
  VALUES (?, ?, 1)
`);
const stmtInsertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category,
     sale_start, sale_end, image_url, source_id, source_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let stored = 0;
let skipped = 0;

const run = db.transaction(() => {
  // Collect all unique store display names from curated JSON
  const displayNames = new Set();
  for (const items of Object.values(curated.categories)) {
    for (const item of items) displayNames.add(item.store);
  }

  // Ensure source rows
  const sourceIdMap = {}; // displayName → source id
  for (const displayName of displayNames) {
    const flippUrl = 'flipp://' + displayName.toLowerCase().replace(/\s+/g, '-');
    let row = stmtGetSource.get(flippUrl);
    if (!row) {
      const res = stmtInsertSource.run(displayName, flippUrl);

      sourceIdMap[displayName] = res.lastInsertRowid;
    } else {
      sourceIdMap[displayName] = row.id;
    }
  }

  // Insert items
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const sourceId  = sourceIdMap[item.store];
      const flippUrl  = 'flipp://' + item.store.toLowerCase().replace(/\s+/g, '-');
      const batchName = STORE_NAME_MAP[item.store] || item.store;
      const batchStore = batchIndex[batchName] || {};
      const saleStart = batchStore.sale_start || null;
      const saleEnd   = batchStore.sale_end   || null;
      const imageUrl  = batchStore.itemMap ? (batchStore.itemMap[item.name.toLowerCase()] || null) : null;

      const hash = itemHash(item.name, item.brand, item.price, sourceId, saleEnd);

      const res = stmtInsertItem.run(
        hash,
        item.name,
        item.brand || null,
        item.price || null,
        item.original_price || null,
        category,
        saleStart,
        saleEnd,
        imageUrl,
        sourceId,
        flippUrl
      );

      if (res.changes > 0) {
        stored++;
      } else {
        skipped++;
      }
    }
  }
});

run();
db.close();

console.log(`${stored} items stored, ${skipped} duplicates skipped`);
