#!/usr/bin/env node
// Fetches flyer deals from the Flipp public API (backflipp.wishabi.com)
// for configured merchants in the Calgary area, and writes results
// in the same batch format that import-flyer-results.js expects.
//
// Usage: node scripts/fetch-flipp-flyers.js
// Output: /tmp/eventfinder-flyer-batch-flipp.json

import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');
const POSTAL_CODE = 'T3C0W1';
const OUTPUT_FILE = '/tmp/eventfinder-flyer-batch-flipp.json';

// Flipp merchant IDs for our stores
const MERCHANTS = {
  208:  'Shoppers Drug Mart',
  228:  'London Drugs',
  2051: 'Calgary Co-op',
  2072: 'Sobeys',
  2126: 'Safeway',
  2271: 'Real Canadian Superstore',
  2332: 'No Frills',
  2471: 'Canadian Tire',
  2596: 'Costco',
  2702: 'Wholesale Club',
  3407: 'Co-op Wine Spirits Beer',
  3656: 'Sobeys & Safeway Liquor',
  6373: 'T&T Supermarket',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

function categorizeItem(name, brand) {
  const n = (name || '').toLowerCase();
  const b = (brand || '').toLowerCase();
  if (/chicken|beef|pork|salmon|fish|shrimp|steak|ground|sausage|bacon|turkey|lamb|deli|meat/.test(n)) return 'Meat & Seafood';
  if (/apple|banana|avocado|tomato|lettuce|onion|potato|berry|fruit|vegetable|produce|orange|grape|mango|pepper|cucumber|carrot|celery|mushroom|strawberr/.test(n)) return 'Produce';
  if (/milk|cheese|yogurt|butter|cream|egg|margarine|dairy/.test(n)) return 'Dairy';
  if (/bread|bun|bagel|muffin|cake|pastry|croissant|donut|bakery/.test(n)) return 'Bakery';
  if (/frozen|ice cream|pizza|fries/.test(n)) return 'Frozen';
  if (/juice|pop|soda|water|coffee|tea|beverage|drink|beer|wine|spirit|liquor|vodka|rum|whisky|gin|cooler|cider/.test(n)) return 'Beverages';
  if (/soap|shampoo|toothpaste|deodorant|lotion|tissue|toilet|paper towel|diaper|vitamin|medicine|pharmacy/.test(n)) return 'Personal Care';
  if (/cleaner|detergent|garbage|trash|pet food|dog|cat|laundry|dish/.test(n)) return 'Household';
  return 'Pantry';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Step 1: Get all current flyers for our postal code
  console.log(`Fetching flyers for postal code ${POSTAL_CODE}...`);
  const allFlyers = await fetchJSON(
    `https://backflipp.wishabi.com/flipp/flyers?locale=en-ca&postal_code=${POSTAL_CODE}`
  );

  // Filter to our merchants and pick the most recent flyer per merchant
  const merchantIds = Object.keys(MERCHANTS).map(Number);
  const ourFlyers = allFlyers.filter(f => merchantIds.includes(f.merchant_id));

  // Group by merchant, pick the one with the latest valid_from
  const latestByMerchant = {};
  for (const flyer of ourFlyers) {
    const mid = flyer.merchant_id;
    if (!latestByMerchant[mid] || flyer.valid_from > latestByMerchant[mid].valid_from) {
      latestByMerchant[mid] = flyer;
    }
  }

  console.log(`Found ${Object.keys(latestByMerchant).length} merchant flyers out of ${merchantIds.length} configured.\n`);

  // Step 2: Look up source_id for each merchant from the database
  const db = new Database(DB_PATH);
  const sourcesByName = {};
  const sources = db.prepare("SELECT id, name, url FROM sources WHERE type = 'flyer' AND active = 1").all();
  for (const s of sources) {
    sourcesByName[s.name.toLowerCase()] = s;
  }
  db.close();

  // Step 3: Fetch items for each flyer
  const results = [];

  for (const [midStr, merchantName] of Object.entries(MERCHANTS)) {
    const mid = Number(midStr);
    const flyer = latestByMerchant[mid];

    if (!flyer) {
      console.log(`[${merchantName}] No current flyer found, skipping.`);
      results.push({
        source_id: null,
        source_url: `https://flipp.com/en-ca/flyers/${merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        success: false,
        error: 'No current flyer found on Flipp',
        items: [],
      });
      continue;
    }

    process.stdout.write(`[${merchantName}] Flyer ${flyer.id} (${flyer.valid_from} to ${flyer.valid_to}) ... `);

    try {
      const flyerData = await fetchJSON(
        `https://backflipp.wishabi.com/flipp/flyers/${flyer.id}`
      );

      const items = (flyerData.items || [])
        .filter(item => item.name && item.name.trim()) // skip unnamed items
        .map(item => ({
          item_name: item.name || '',
          brand: item.brand || null,
          description: null, // bulk API doesn't include descriptions
          sale_price: item.price ? `$${item.price}` : (item.discount ? `${item.discount}% off` : 'See flyer'),
          regular_price: item.original_price ? `$${item.original_price}` : null,
          unit: null,
          category: categorizeItem(item.name, item.brand),
          sale_start: flyer.valid_from ? flyer.valid_from.split('T')[0] : null,
          sale_end: flyer.valid_to ? flyer.valid_to.split('T')[0] : null,
          item_url: item.ttm_url || null,
          image_url: item.cutout_image_url || null,
        }));

      console.log(`${items.length} items`);

      // Try to find the matching source in the DB
      const nameLower = merchantName.toLowerCase();
      const source = sourcesByName[nameLower] || null;

      results.push({
        source_id: source ? source.id : null,
        source_url: source ? source.url : `https://backflipp.wishabi.com/flipp/flyers/${flyer.id}`,
        success: true,
        error: null,
        store_name: merchantName,
        sale_start: flyer.valid_from ? flyer.valid_from.split('T')[0] : null,
        sale_end: flyer.valid_to ? flyer.valid_to.split('T')[0] : null,
        items,
      });
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      results.push({
        source_id: null,
        source_url: `https://backflipp.wishabi.com/flipp/flyers/${flyer.id}`,
        success: false,
        error: err.message,
        items: [],
      });
    }
  }

  // Step 4: Write batch file
  const batch = { results };
  writeFileSync(OUTPUT_FILE, JSON.stringify(batch, null, 2));

  const succeeded = results.filter(r => r.success).length;
  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
  console.log(`\nDone: ${succeeded} merchants fetched, ${totalItems} total items`);
  console.log(`Batch written to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
