#!/usr/bin/env node

import { readFileSync } from 'fs';

const CURATED_FILE = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('Warning: DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync(CURATED_FILE, 'utf8'));

async function post(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord post failed: ${res.status} ${text}`);
  }
  // Discord rate-limits: wait 1s between posts
  await new Promise(r => setTimeout(r, 1000));
}

function formatItem(item) {
  let line = `• ${item.name}`;
  if (item.brand) line += ` *(${item.brand})*`;
  line += ` — **${item.price}**`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  line += ` @ ${item.store}`;
  if (item.also_at && item.also_at.length) {
    line += ` *(also: ${item.also_at.slice(0, 2).join(', ')})*`;
  }
  return line;
}

function chunkDescription(items, maxLen = 4000) {
  const chunks = [];
  let current = '';
  for (const item of items) {
    const line = formatItem(item) + '\n';
    if (current.length + line.length > maxLen) {
      chunks.push(current.trimEnd());
      current = '';
    }
    current += line;
  }
  if (current.trim()) chunks.push(current.trimEnd());
  return chunks;
}

const CAT_ICONS = {
  'Meat & Seafood': '🥩',
  'Produce': '🥬',
  'Dairy': '🧀',
  'Bakery': '🍞',
  'Frozen': '🧊',
  'Pantry': '🥫',
  'Beverages': '🥤',
};

const CAT_COLORS = {
  'Meat & Seafood': 15158332,  // red
  'Produce': 5763719,          // green
  'Dairy': 16776960,           // yellow
  'Bakery': 15844367,          // orange
  'Frozen': 3447003,           // blue
  'Pantry': 10181046,          // purple
  'Beverages': 1752220,        // teal
};

// Posting order: low priority → high priority (Discord shows bottom first)
const POST_ORDER = [
  'Beverages', 'Pantry', 'Bakery', 'Frozen',  // low priority
  'Dairy', 'Produce',                           // mid priority
  'Meat & Seafood',                             // high priority
];

// Count totals
const allItems = Object.values(curated.categories).flat();
const totalDeals = allItems.length;
const stores = new Set(allItems.map(i => i.store));
const totalStores = stores.size;
const dateStr = curated.date;

// --- Phase 3 begin ---

// 1. Header message (posted first → appears at top)
await post({
  content: `🛒 **Flyer Deals** — ${totalDeals} deals from ${totalStores} stores · ${dateStr}`,
});
console.log('Posted header');

// 2–4. Category embeds in posting order
for (const cat of POST_ORDER) {
  const items = curated.categories[cat];
  if (!items || items.length === 0) continue;

  const icon = CAT_ICONS[cat] || '📦';
  const color = CAT_COLORS[cat] || 0;
  const title = `${icon} ${cat}`;
  const chunks = chunkDescription(items);

  for (let i = 0; i < chunks.length; i++) {
    const embedTitle = i === 0 ? title : `${title} (cont.)`;
    await post({ embeds: [{ title: embedTitle, color, description: chunks[i] }] });
  }
  console.log(`Posted ${cat} (${items.length} items)`);
}

// 5. Highlights embed (posted last → appears at bottom, seen first)
// Pick top deals: staples with discounts first, then biggest discount %
const STAPLES_KEYWORDS = [
  'chicken thigh', 'boneless skinless',
  'classico', 'tomato sauce', 'pasta sauce',
  'scotch bonnet', 'pepper',
  'milk', 'eggs', 'egg', 'butter',
  'siggi', 'yogurt',
  'gorgonzola', 'balderson', 'cheddar',
  'swiss delice', 'dark chocolate',
  'que pasa', 'corn chip',
  'flour',
];

function isStaple(item) {
  const text = (item.name + ' ' + (item.brand || '')).toLowerCase();
  return STAPLES_KEYWORDS.some(kw => text.includes(kw));
}

const highlights = allItems
  .filter(i => i.discount_pct || i.original_price)
  .sort((a, b) => {
    const aStaple = isStaple(a) ? 1 : 0;
    const bStaple = isStaple(b) ? 1 : 0;
    if (bStaple !== aStaple) return bStaple - aStaple;
    return (b.discount_pct || 0) - (a.discount_pct || 0);
  })
  .slice(0, 10);

if (highlights.length > 0) {
  const lines = highlights.map(item => {
    let line = `• ${item.name}`;
    if (item.brand) line += ` *(${item.brand})*`;
    line += ` — **${item.price}**`;
    if (item.original_price) line += ` ~~${item.original_price}~~`;
    if (item.discount_pct) line += ` (${item.discount_pct}% off)`;
    line += ` @ ${item.store}`;
    return line;
  }).join('\n');

  await post({
    embeds: [{
      title: '⭐ Highlights — This Week\'s Best Deals',
      color: 16766720,
      description: lines,
    }],
  });
  console.log(`Posted highlights (${highlights.length} items)`);
}

console.log('✅ Discord posting complete');
