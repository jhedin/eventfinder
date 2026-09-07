#!/usr/bin/env node
// Phase 3: Post curated flyer deals to Discord in priority order.
import { readFileSync } from 'fs';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('WARNING: DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));

// Category emoji map
const CAT_EMOJI = {
  'Meat & Seafood': '🥩',
  'Produce': '🥬',
  'Dairy': '🧀',
  'Bakery': '🍞',
  'Frozen': '🧊',
  'Pantry': '🥫',
  'Beverages': '🥤',
};

// Category colors (decimal)
const CAT_COLOR = {
  'Meat & Seafood': 15158332,  // red
  'Produce': 3066993,          // green
  'Dairy': 16776960,           // yellow
  'Bakery': 15844367,          // peach/orange
  'Frozen': 3447003,           // blue
  'Pantry': 10181046,          // purple
  'Beverages': 1752220,        // teal
};

function formatItem(item) {
  const store = item.store;
  const also = item.also ? ` *(${item.also})*` : '';
  const brand = item.brand ? ` *(${item.brand})*` : '';
  let price = item.price ? `**${item.price}**` : '';
  if (item.original_price) price += ` ~~${item.original_price}~~`;
  return `• ${item.name.slice(0, 80)}${brand} — ${price} @ ${store}${also}`;
}

function formatHighlight(item) {
  const discStr = item.discount_pct ? ` (${item.discount_pct}% off)` : '';
  let price = item.price ? `**${item.price}**` : '';
  if (item.original_price) price += ` ~~${item.original_price}~~`;
  return `• ${item.name.slice(0, 70)} — ${price} @ ${item.store}${discStr}`;
}

async function post(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord ${res.status}: ${text}`);
  }
  // Rate limit buffer
  await new Promise(r => setTimeout(r, 1000));
}

function buildCategoryEmbed(catName, items) {
  const emoji = CAT_EMOJI[catName] || '🛒';
  const color = CAT_COLOR[catName] || 7506394;
  const lines = items.map(formatItem);
  // Split if too long
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > 4000) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((desc, i) => ({
    title: i === 0 ? `${emoji} ${catName}` : `${emoji} ${catName} (cont.)`,
    color,
    description: desc,
  }));
}

// Collect all items flat for highlights
const allItems = [];
for (const [cat, items] of Object.entries(curated.categories)) {
  for (const item of items) {
    allItems.push({ ...item, category: cat });
  }
}

// Highlights: staple items with discounts first, then highest discount %
const highlights = allItems
  .filter(i => i.staple || i.discount_pct > 20)
  .sort((a, b) => {
    if (a.staple !== b.staple) return (b.staple ? 1 : 0) - (a.staple ? 1 : 0);
    return (b.discount_pct || 0) - (a.discount_pct || 0);
  })
  .slice(0, 10);

// Count totals
const totalItems = allItems.length;
const storeSet = new Set(allItems.map(i => i.store));
const totalStores = storeSet.size;
const dateStr = curated.date;

// Posting order (top = first posted = seen last in channel)
const POSTING_ORDER = [
  'Beverages',
  'Pantry',
  'Bakery',
  'Frozen',
  'Dairy',
  'Produce',
  'Meat & Seafood',
];

console.log('Posting to Discord...');

// 1. Header message
await post({
  content: `🛒 **Flyer Deals** — ${totalItems} deals from ${totalStores} stores · ${dateStr}`,
});
console.log('  ✓ Header posted');

// 2. Category embeds (low → high priority)
for (const catName of POSTING_ORDER) {
  const items = curated.categories[catName];
  if (!items || items.length === 0) continue;

  const embeds = buildCategoryEmbed(catName, items);
  // Post in chunks of max 10 embeds
  for (let i = 0; i < embeds.length; i += 10) {
    await post({ embeds: embeds.slice(i, i + 10) });
  }
  console.log(`  ✓ ${catName} posted (${items.length} items)`);
}

// 3. Highlights embed (last posted = seen first)
if (highlights.length > 0) {
  const highlightLines = highlights.map(formatHighlight);
  await post({
    embeds: [{
      title: '⭐ Highlights — This Week\'s Best Deals',
      color: 16766720,
      description: highlightLines.join('\n'),
    }],
  });
  console.log(`  ✓ Highlights posted (${highlights.length} items)`);
}

console.log('Done — all messages posted to Discord.');
