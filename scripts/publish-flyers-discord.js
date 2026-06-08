#!/usr/bin/env node
/**
 * Phase 3 — Publish curated flyer deals to Discord.
 * Reads /tmp/eventfinder-flyer-curated.json and posts formatted embeds.
 * Posting order: header → low-priority → mid → high → highlights (seen first).
 */

import { readFileSync } from 'fs';

const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;
if (!WEBHOOK_URL) {
  console.warn('DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync('/tmp/eventfinder-flyer-curated.json', 'utf8'));

const CATEGORY_META = {
  'Beverages':     { emoji: '🥤', color: 3447003  },
  'Pantry':        { emoji: '🥫', color: 10181046 },
  'Bakery':        { emoji: '🍞', color: 15105570 },
  'Frozen':        { emoji: '🧊', color: 1752220  },
  'Dairy':         { emoji: '🧀', color: 16777215 },
  'Produce':       { emoji: '🥬', color: 3066993  },
  'Meat & Seafood':{ emoji: '🥩', color: 15158332 },
};

// Posting order: lowest priority first (they end up at top of channel)
const POST_ORDER = [
  'Beverages', 'Pantry', 'Bakery', 'Frozen',
  'Dairy', 'Produce',
  'Meat & Seafood',
];

function fmtItem(item) {
  const name = item.name;
  const brand = item.brand && item.brand !== item.name && !item.name.includes(item.brand)
    ? ` (${item.brand})`
    : '';
  const price = item.price ? `**${item.price}**` : '';
  const orig = item.original_price ? ` ~~${item.original_price}~~` : '';
  const store = ` @ ${item.store}`;
  const also = item.also_at ? ` · also ${item.also_at}` : '';
  return `• ${name}${brand} — ${price}${orig}${store}${also}`;
}

function fmtHighlight(item) {
  const name = item.name;
  const price = item.price ? `**${item.price}**` : '';
  const orig = item.original_price ? ` ~~${item.original_price}~~` : '';
  const store = ` @ ${item.store}`;
  const disc = item.discount_pct ? ` (${item.discount_pct}% off)` : '';
  return `• ${name} — ${price}${orig}${store}${disc}`;
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
  // Rate-limit: Discord allows ~5 req/s on webhooks; be safe
  await new Promise(r => setTimeout(r, 500));
}

// Count total items and unique stores
const totalItems = Object.values(curated.categories).reduce((s, v) => s + v.length, 0);
const stores = new Set();
for (const items of Object.values(curated.categories)) {
  for (const i of items) stores.add(i.store);
}

// 1. Header message
console.log('Posting header…');
await post({
  content: `🛒 **Flyer Deals** — ${totalItems} deals from ${stores.size} stores · ${curated.date}`,
});

// 2–4. Category embeds in posting order
for (const cat of POST_ORDER) {
  const items = curated.categories[cat];
  if (!items || items.length === 0) continue;

  const meta = CATEGORY_META[cat] || { emoji: '📦', color: 8421504 };
  const lines = items.map(fmtItem);

  // Split if description would exceed 4096 chars
  const chunks = [];
  let current = [];
  let len = 0;
  for (const line of lines) {
    if (len + line.length + 1 > 4000) {
      chunks.push(current);
      current = [line];
      len = line.length;
    } else {
      current.push(line);
      len += line.length + 1;
    }
  }
  if (current.length) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    const title = chunks.length > 1
      ? `${meta.emoji} ${cat} (${i + 1}/${chunks.length})`
      : `${meta.emoji} ${cat}`;
    console.log(`Posting ${title}…`);
    await post({
      embeds: [{
        title,
        color: meta.color,
        description: chunks[i].join('\n'),
      }],
    });
  }
}

// 5. Highlights — best staple + highest-discount items
const allItems = Object.values(curated.categories).flat();
const stapleItems = allItems.filter(i => i.staple);
const discountItems = allItems
  .filter(i => !i.staple && i.discount_pct)
  .sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0))
  .slice(0, 5);

// Also add top 3 meat deals by absolute price drop (staples or not)
const meatDeals = (curated.categories['Meat & Seafood'] || [])
  .filter(i => !i.staple)
  .slice(0, 3);

const highlightCandidates = [...stapleItems, ...discountItems, ...meatDeals];
// Deduplicate
const seen = new Set();
const highlights = [];
for (const item of highlightCandidates) {
  const key = item.name + item.store;
  if (!seen.has(key)) {
    seen.add(key);
    highlights.push(item);
  }
}

const highlightLines = highlights.slice(0, 10).map(fmtHighlight);

if (highlightLines.length > 0) {
  console.log('Posting highlights…');
  await post({
    embeds: [{
      title: '⭐ Highlights — This Week\'s Best Deals',
      color: 16766720,
      description: highlightLines.join('\n'),
    }],
  });
}

console.log(`✅ Posted to Discord: header + ${POST_ORDER.filter(c => curated.categories[c]?.length).length} categories + highlights`);
