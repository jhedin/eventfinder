#!/usr/bin/env node
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');
const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';

const db = new Database(DB_PATH);

// Ensure flyer_items table exists
const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='flyer_items'").get();
if (!tableExists) {
  const schema = readFileSync(join(__dirname, '..', 'data', 'schema.sql'), 'utf8');
  // Extract flyer_items related DDL
  const flyerSection = schema.slice(schema.indexOf('CREATE TABLE flyer_items'));
  db.exec(flyerSection.split('-- ===')[0]);
}

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Build lookup: store_name -> { sale_start, sale_end, items by name }
const rawByStore = {};
for (const store of raw) {
  rawByStore[store.store_name] = {
    sale_start: store.sale_start,
    sale_end: store.sale_end,
    itemsByName: Object.fromEntries(
      store.items
        .filter(i => i.name)
        .map(i => [i.name.toLowerCase(), i])
    ),
  };
}

// Ensure source exists, return source_id
const getOrCreateSource = db.transaction((storeName) => {
  const url = 'flipp://' + storeName.toLowerCase().replace(/\s+/g, '-');
  let row = db.prepare("SELECT id FROM sources WHERE url = ?").get(url);
  if (!row) {
    db.prepare("INSERT INTO sources (name, url, type) VALUES (?, ?, 'flyer')").run(storeName, url);
    row = db.prepare("SELECT id FROM sources WHERE url = ?").get(url);
  }
  return { id: row.id, url };
});

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO flyer_items
    (item_hash, item_name, brand, sale_price, regular_price, category,
     sale_start, sale_end, image_url, source_id, source_url)
  VALUES
    (@item_hash, @item_name, @brand, @sale_price, @regular_price, @category,
     @sale_start, @sale_end, @image_url, @source_id, @source_url)
`);

let stored = 0, skipped = 0;

const storeAll = db.transaction(() => {
  for (const [category, items] of Object.entries(curated.categories)) {
    for (const item of items) {
      const storeName = item.store;
      const { id: sourceId, url: sourceUrl } = getOrCreateSource(storeName);

      // Get sale dates from raw data
      const rawStore = rawByStore[storeName] || {};
      const sale_start = rawStore.sale_start || null;
      const sale_end = rawStore.sale_end || null;

      // Get image_url from raw data
      const rawItem = rawStore.itemsByName?.[item.name.toLowerCase()];
      const image_url = rawItem?.image_url || item.image_url || null;

      const hashInput = (item.name + '|' + (item.brand || '') + '|' + item.price + '|' + sourceId + '|' + (sale_end || '')).toLowerCase();
      const item_hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 32);

      const result = insertItem.run({
        item_hash,
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
      });

      if (result.changes > 0) stored++;
      else skipped++;
    }
  }
});

storeAll();
db.close();

console.log(stored + ' items stored, ' + skipped + ' duplicates skipped');
