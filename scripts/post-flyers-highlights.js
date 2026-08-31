#!/usr/bin/env node
// Post highlights embed to Discord (staples regardless of discount data availability)

import { readFileSync } from 'fs';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('Warning: DISCORD_FLYERS_WEBHOOK_URL not set');
  process.exit(0);
}

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));

const STAPLES = [
  'chicken thigh', 'classico', 'scotch bonnet', 'bell pepper', 'pepper',
  'jalapeño', 'jalapeno', 'milk', 'egg', 'butter', 'siggi', 'gorgonzola',
  'balderson', 'swiss delice', 'que pasa', 'flour'
];

function isStaple(name, brand) {
  const text = `${name} ${brand || ''}`.toLowerCase();
  return STAPLES.some(s => text.includes(s));
}

const allItems = Object.values(curated.categories).flat();

// Collect staples first, then fill with high-value food items
const staples = allItems.filter(i => isStaple(i.name, i.brand));
const nonStaples = allItems.filter(i => !isStaple(i.name, i.brand));

const highlights = [...staples, ...nonStaples].slice(0, 10);

function formatHighlightItem(item) {
  let line = `• **${item.name}**`;
  if (item.brand) line += ` _(${item.brand})_`;
  line += ` — **${item.price}**`;
  if (item.original_price) {
    line += ` ~~${item.original_price}~~`;
    if (item.discount_pct > 0) line += ` (${item.discount_pct}% off)`;
  }
  line += ` @ ${item.store}`;
  return line;
}

const resp = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    embeds: [{
      title: '⭐ Highlights — Staples & Best Picks This Week',
      color: 16766720,
      description: highlights.map(formatHighlightItem).join('\n'),
    }],
  }),
});

if (!resp.ok) {
  const text = await resp.text();
  throw new Error(`Discord POST failed ${resp.status}: ${text}`);
}

console.log(`Posted highlights (${highlights.length} items, ${staples.length} staples)`);
