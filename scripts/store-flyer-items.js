#!/usr/bin/env node
/**
 * Phase 2.5: Store curated flyer items into the database
 * Reads /tmp/eventfinder-flyer-curated.json
 * Upserts sources with type='flyer', inserts flyer_items with INSERT OR IGNORE
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

function itemHash(itemName, brand, salePrice, sourceId, saleEnd) {
  const str = [itemName, brand || '', salePrice, String(sourceId), saleEnd || ''].join('|');
  return createHash('sha256').update(str).digest('hex').slice(0, 32);
}

function main() {
  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
  const db = new Database(DB_PATH);

  // Ensure WAL mode for concurrent access safety
  db.pragma('journal_mode = WAL');

  let stored = 0, skipped = 0;

  // Collect all unique store names from curated categories
  const storeNames = new Set();
  for (const items of Object.values(curated.categories)) {
    for (const item of items) {
      storeNames.add(item.store);
    }
  }

  // Ensure a flyer source exists for each store
  const ensureSource = db.prepare(`
    INSERT INTO sources (url, name, type, active)
    VALUES (?, ?, 'flyer', 1)
    ON CONFLICT(url) DO UPDATE SET name=excluded.name
    RETURNING id
  `);
  const getSource = db.prepare(`SELECT id FROM sources WHERE url = ?`);

  const sourceIds = {};
  for (const storeName of storeNames) {
    const url = 'flipp://' + storeName.toLowerCase().replace(/\s+/g, '-');
    let row = getSource.get(url);
    if (!row) {
      row = ensureSource.get(url, storeName);
    }
    sourceIds[storeName] = row.id;
  }

  // Insert flyer items
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO flyer_items (
      item_hash, item_name, brand, sale_price, regular_price,
      category, sale_start, sale_end, image_url, source_id, source_url
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  const insertMany = db.transaction((items) => {
    for (const [category, itemList] of Object.entries(items)) {
      for (const item of itemList) {
        const sourceId = sourceIds[item.store];
        const sourceUrl = 'flipp://' + item.store.toLowerCase().replace(/\s+/g, '-');
        const hash = itemHash(item.name, item.brand, item.price, sourceId, item.sale_end);

        const result = insertItem.run(
          hash,
          item.name,
          item.brand || null,
          item.price,
          item.original_price || null,
          category,
          item.sale_start || null,
          item.sale_end || null,
          item.image_url || null,
          sourceId,
          sourceUrl
        );

        if (result.changes > 0) {
          stored++;
        } else {
          skipped++;
        }
      }
    }
  });

  insertMany(curated.categories);

  console.log(`${stored} items stored, ${skipped} duplicates skipped`);
  db.close();
}

main();
