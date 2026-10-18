#!/usr/bin/env node
// Show all Calgary Co-op items from candidates, grouped by category
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('/tmp/eventfinder-flyer-candidates.json', 'utf8'));

for (const [cat, items] of Object.entries(data.categories)) {
  const coopItems = items.filter(i => i.store === 'Calgary Co-op');
  if (coopItems.length === 0) continue;
  console.log(`\n${cat}:`);
  coopItems.forEach(i => {
    const orig = i.original_price ? ` [was ${i.original_price}]` : '';
    const brand = i.brand ? ` (${i.brand})` : '';
    const unit = i.price_unit ? ` ${i.price_unit}` : '';
    console.log(`  ${i.name}${brand} — $${i.price}${unit}${orig}`);
  });
}
