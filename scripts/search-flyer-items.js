#!/usr/bin/env node
// Search raw flyer batch for a keyword
import { readFileSync } from 'fs';

const keyword = process.argv[2]?.toLowerCase();
if (!keyword) { console.error('Usage: node search-flyer-items.js <keyword>'); process.exit(1); }

const batch = JSON.parse(readFileSync('/tmp/eventfinder-flyer-batch-flipp.json', 'utf8'));
const SKIP_STORES = new Set(['Canadian Tire', 'London Drugs', 'Shoppers Drug Mart', 'Co-op Wine Spirits Beer', 'Sobeys & Safeway Liquor', 'Sobeys']);

for (const store of batch) {
  if (SKIP_STORES.has(store.store_name)) continue;
  const hits = store.items.filter(i => i.name?.toLowerCase().includes(keyword) || i.brand?.toLowerCase().includes(keyword));
  for (const i of hits) {
    const orig = i.original_price ? ` [was ${i.original_price}]` : '';
    const brand = i.brand ? ` (${i.brand})` : '';
    console.log(`${store.store_name}: ${i.name}${brand} — $${i.price}${orig}`);
  }
}
