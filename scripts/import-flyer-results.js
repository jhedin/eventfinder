#!/usr/bin/env node
// Reads all /tmp/eventfinder-flyer-batch-*.json files written by scraper subagents,
// deduplicates flyer items, and imports them into the EventFinder database.
//
// Usage: node scripts/import-flyer-results.js

import { createRequire } from 'module';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const TMP_DIR = '/tmp';
const BATCH_PATTERN = /^eventfinder-flyer-batch-.*\.json$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function flyerItemHash(itemName, brand, salePrice, sourceId, saleEnd) {
  const key = normalize(itemName) + normalize(brand) + normalize(salePrice) + String(sourceId) + (saleEnd || '');
  return createHash('sha256').update(key).digest('hex');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const stmts = {
  checkHash:       db.prepare('SELECT id FROM flyer_items WHERE item_hash = ?'),
  insertItem:      db.prepare(`
    INSERT INTO flyer_items (item_hash, item_name, brand, description, sale_price, regular_price, unit, category, sale_start, sale_end, item_url, image_url, source_id, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertSent:      db.prepare(`
    INSERT INTO sent_flyer_items (flyer_item_id, status) VALUES (?, 'pending')
  `),
  updateSourceSuccess: db.prepare(`
    UPDATE sources
    SET last_checked_at = CURRENT_TIMESTAMP,
        last_success_at = CURRENT_TIMESTAMP,
        consecutive_failures = 0,
        error_message = NULL,
        error_type = NULL
    WHERE id = ?
  `),
  updateSourceFailure: db.prepare(`
    UPDATE sources
    SET last_checked_at = CURRENT_TIMESTAMP,
        consecutive_failures = consecutive_failures + 1,
        error_message = ?,
        error_type = ?
    WHERE id = ?
  `),
  autoDisable: db.prepare(`
    UPDATE sources SET active = 0 WHERE consecutive_failures >= 3 AND type = 'flyer'
  `),
};

// Find batch files
const batchFiles = readdirSync(TMP_DIR)
  .filter(f => BATCH_PATTERN.test(f))
  .map(f => join(TMP_DIR, f))
  .sort();

if (batchFiles.length === 0) {
  console.error('No batch files found in /tmp matching eventfinder-flyer-batch-*.json');
  process.exit(1);
}

console.log(`Found ${batchFiles.length} batch file(s): ${batchFiles.join(', ')}`);

// Counters
let totalSources = 0;
let succeededSources = 0;
let failedSources = 0;
let totalItemsExtracted = 0;
let newItems = 0;
let duplicatesSkipped = 0;
const failedSourceList = [];

const importAll = db.transaction(() => {
  for (const filePath of batchFiles) {
    let batch;
    try {
      batch = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`Failed to parse ${filePath}: ${err.message}`);
      continue;
    }

    for (const result of (batch.results || [])) {
      totalSources++;
      const { source_id, source_url, success, error, items = [] } = result;

      if (!success) {
        failedSources++;
        failedSourceList.push({ source_id, source_url, error });
        stmts.updateSourceFailure.run(error || 'unknown error', 'fetch_error', source_id);
        continue;
      }

      stmts.updateSourceSuccess.run(source_id);
      succeededSources++;
      totalItemsExtracted += items.length;

      for (const item of items) {
        const hash = flyerItemHash(item.item_name, item.brand, item.sale_price, source_id, item.sale_end);
        const existing = stmts.checkHash.get(hash);

        if (existing) {
          duplicatesSkipped++;
          continue;
        }

        const insertResult = stmts.insertItem.run(
          hash,
          item.item_name || '',
          item.brand || null,
          item.description || null,
          item.sale_price || '',
          item.regular_price || null,
          item.unit || null,
          item.category || null,
          item.sale_start || null,
          item.sale_end || null,
          item.item_url || null,
          item.image_url || null,
          source_id,
          source_url
        );

        const itemId = insertResult.lastInsertRowid;
        stmts.insertSent.run(itemId);
        newItems++;
      }
    }
  }

  stmts.autoDisable.run();
});

importAll();
db.close();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`
Import complete
───────────────────────────────
Sources processed: ${totalSources}
  Succeeded:       ${succeededSources}
  Failed:          ${failedSources}

Flyer items extracted: ${totalItemsExtracted}
  New (inserted):      ${newItems}
  Duplicates:          ${duplicatesSkipped}
`);

if (failedSourceList.length > 0) {
  console.log('Failed sources:');
  failedSourceList.forEach(s => console.log(`  [${s.source_id}] ${s.source_url}: ${s.error}`));
}
