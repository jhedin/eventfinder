#!/usr/bin/env node
/**
 * Post curated flyer deals to Discord.
 * Reads: /tmp/eventfinder-flyer-curated.json
 */

import fs from 'fs';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('Warning: DISCORD_FLYERS_WEBHOOK_URL not set. Skipping Discord post.');
  process.exit(0);
}

const curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));

// Staples list for highlights detection
const STAPLES = [
  'chicken thigh', 'classico', 'scotch bonnet', 'bell pepper', 'pepper',
  'milk', 'egg', 'butter', 'siggi', 'gorgonzola', 'balderson', 'cheddar',
  'swiss delice', 'que pasa', 'corn chip', 'no name flour', 'flour',
];

function isStaple(item) {
  const text = (item.name + ' ' + (item.brand || '')).toLowerCase();
  return STAPLES.some(s => text.includes(s));
}

function formatItem(item, includeDiscount = false) {
  let line = `• ${item.name}`;
  if (item.brand) line += ` *(${item.brand})*`;
  line += ` — **${item.price || '?'}**`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  line += ` @ ${item.store}`;
  if (includeDiscount && item.discount_pct) line += ` (${item.discount_pct}% off)`;
  if (item.also_at) line += `\n  *(also: ${item.also_at})*`;
  return line;
}

function countItems() {
  return Object.values(curated.categories).reduce((sum, items) => sum + items.length, 0);
}

function countStores() {
  const stores = new Set();
  for (const items of Object.values(curated.categories)) {
    for (const item of items) stores.add(item.store);
  }
  return stores.size;
}

async function post(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord error ${res.status}: ${text}`);
  }
  // Rate limit: wait between posts
  await new Promise(r => setTimeout(r, 500));
}

const CATEGORY_ICONS = {
  'Meat & Seafood': '🥩',
  'Produce': '🥬',
  'Dairy': '🧀',
  'Bakery': '🍞',
  'Frozen': '🧊',
  'Pantry': '🥫',
  'Beverages': '🥤',
};

const CATEGORY_COLORS = {
  'Meat & Seafood': 15158332,  // red
  'Produce': 5763719,          // green
  'Dairy': 16776960,           // yellow
  'Bakery': 15844367,          // orange
  'Frozen': 3447003,           // blue
  'Pantry': 10181046,          // purple
  'Beverages': 1752220,        // teal
};

// Post order: header, then low→high priority
const POST_ORDER = ['Beverages', 'Pantry', 'Bakery', 'Frozen', 'Dairy', 'Produce', 'Meat & Seafood'];

(async () => {
  const totalItems = countItems();
  const totalStores = countStores();
  const date = curated.date;

  // 1. Header message
  await post({
    content: `🛒 **Flyer Deals** — ${totalItems} deals from ${totalStores} stores · ${date}`,
  });
  console.log('Posted: header');

  // 2. Category embeds (low → high priority)
  for (const cat of POST_ORDER) {
    const items = curated.categories[cat];
    if (!items || items.length === 0) continue;

    const icon = CATEGORY_ICONS[cat] || '📦';
    const color = CATEGORY_COLORS[cat] || 7506394;

    // Build description, splitting if needed
    const lines = items.map(item => formatItem(item));
    const chunks = [];
    let current = '';
    for (const line of lines) {
      if ((current + '\n' + line).length > 4000) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    }
    if (current) chunks.push(current);

    for (let i = 0; i < chunks.length; i++) {
      const title = i === 0 ? `${icon} ${cat}` : `${icon} ${cat} (cont'd)`;
      await post({
        embeds: [{ title, color, description: chunks[i] }],
      });
    }
    console.log(`Posted: ${cat} (${items.length} items)`);
  }

  // 3. Highlights embed (best preference-matching deals)
  const allItems = Object.values(curated.categories).flat();
  const highlights = allItems
    .filter(item => isStaple(item) || (item.discount_pct && item.discount_pct >= 25))
    .sort((a, b) => {
      if (a.staple !== b.staple) return b.staple ? 1 : -1;
      return (b.discount_pct || 0) - (a.discount_pct || 0);
    })
    .slice(0, 10);

  if (highlights.length > 0) {
    const description = highlights.map(item => formatItem(item, true)).join('\n');
    await post({
      embeds: [{
        title: '⭐ Highlights — This Week\'s Best Deals',
        color: 16766720,
        description,
      }],
    });
    console.log(`Posted: highlights (${highlights.length} items)`);
  }

  console.log('\nAll Discord messages posted successfully.');
})().catch(err => {
  console.error('Discord posting failed:', err.message);
  process.exit(1);
});
