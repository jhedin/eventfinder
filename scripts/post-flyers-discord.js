#!/usr/bin/env node
// Post curated flyer deals to Discord

import { readFileSync } from 'fs';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('Warning: DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));

const STAPLES = [
  'chicken thigh', 'classico', 'scotch bonnet', 'bell pepper', 'pepper',
  'jalapeño', 'jalapeno', 'milk', 'egg', 'butter', "siggi", "gorgonzola",
  'balderson', 'swiss delice', 'que pasa', 'flour'
];

function isStaple(name, brand) {
  const text = `${name} ${brand || ''}`.toLowerCase();
  return STAPLES.some(s => text.includes(s));
}

const CATEGORY_EMOJI = {
  'Beverages': '🥤',
  'Pantry': '🥫',
  'Bakery': '🍞',
  'Frozen': '🧊',
  'Dairy': '🧀',
  'Produce': '🥬',
  'Meat & Seafood': '🥩',
};

const CATEGORY_COLOR = {
  'Beverages': 3447003,    // blue
  'Pantry': 10181046,      // purple
  'Bakery': 15844367,      // yellow
  'Frozen': 1752220,       // light blue
  'Dairy': 16776960,       // gold
  'Produce': 3066993,      // green
  'Meat & Seafood': 15158332, // red
};

const POST_ORDER = ['Beverages', 'Pantry', 'Bakery', 'Frozen', 'Dairy', 'Produce', 'Meat & Seafood'];

function formatItem(item) {
  let line = `• **${item.name}**`;
  if (item.brand) line += ` _(${item.brand})_`;
  line += ` — **${item.price}**`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  line += ` @ ${item.store}`;
  if (item.alts && item.alts.length > 0) {
    line += ` (also ${item.alts.slice(0, 2).join(', ')})`;
  }
  return line;
}

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

async function post(payload) {
  const resp = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Discord POST failed ${resp.status}: ${text}`);
  }
  // Rate limit: Discord allows ~5 req/2s per webhook
  await new Promise(r => setTimeout(r, 500));
}

// Count total items and stores
const allItems = Object.values(curated.categories).flat();
const storeSet = new Set(allItems.map(i => i.store));
const totalItems = allItems.length;
const totalStores = storeSet.size;

async function run() {
  // 1. Header
  await post({
    content: `🛒 **Flyer Deals** — ${totalItems} deals from ${totalStores} stores · ${curated.date}`,
  });
  console.log('Posted header');

  // 2-4. Categories in posting order (low → high priority)
  for (const cat of POST_ORDER) {
    const items = curated.categories[cat];
    if (!items || items.length === 0) continue;

    const emoji = CATEGORY_EMOJI[cat] || '📦';
    const color = CATEGORY_COLOR[cat] || 0;
    const lines = items.map(formatItem);

    // Split into chunks of 4096 chars max per embed description
    const chunks = [];
    let current = [];
    let currentLen = 0;
    for (const line of lines) {
      if (currentLen + line.length + 1 > 4000 && current.length > 0) {
        chunks.push(current);
        current = [line];
        currentLen = line.length;
      } else {
        current.push(line);
        currentLen += line.length + 1;
      }
    }
    if (current.length > 0) chunks.push(current);

    for (let i = 0; i < chunks.length; i++) {
      const title = i === 0 ? `${emoji} ${cat}` : `${emoji} ${cat} (cont.)`;
      await post({
        embeds: [{
          title,
          color,
          description: chunks[i].join('\n'),
        }],
      });
    }
    console.log(`Posted ${cat} (${items.length} items)`);
  }

  // 5. Highlights embed — best deals on staples
  const highlights = allItems
    .filter(i => isStaple(i.name, i.brand) && i.original_price)
    .sort((a, b) => b.discount_pct - a.discount_pct)
    .slice(0, 10);

  // Also include highest-discount non-staples if we don't have 5 staples
  if (highlights.length < 5) {
    const extras = allItems
      .filter(i => !isStaple(i.name, i.brand) && i.original_price && i.discount_pct >= 20)
      .sort((a, b) => b.discount_pct - a.discount_pct)
      .slice(0, 10 - highlights.length);
    highlights.push(...extras);
  }

  if (highlights.length > 0) {
    await post({
      embeds: [{
        title: '⭐ Highlights — This Week\'s Best Deals',
        color: 16766720,
        description: highlights.map(formatHighlightItem).join('\n'),
      }],
    });
    console.log(`Posted highlights (${highlights.length} items)`);
  }

  console.log('Discord posting complete');
}

run().catch(err => {
  console.error('Discord post error:', err.message);
  process.exit(1);
});
