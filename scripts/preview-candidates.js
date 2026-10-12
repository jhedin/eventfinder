#!/usr/bin/env node
// Preview candidate items per category for LLM curation
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('/tmp/eventfinder-flyer-candidates.json', 'utf8'));

for (const [cat, items] of Object.entries(data.categories)) {
  console.log(`\n=== ${cat} (${items.length} items) ===`);
  items.forEach(i => {
    const disc = i.original_price ? ` [was ${i.original_price}]` : '';
    const brand = i.brand ? ` (${i.brand})` : '';
    const unit = i.price_unit ? ` ${i.price_unit}` : '';
    console.log(`  ${i.store}: ${i.name}${brand} — ${i.price}${unit}${disc}`);
  });
}
