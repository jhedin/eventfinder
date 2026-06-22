#!/usr/bin/env node
/**
 * Phase 3 — Post curated flyer deals to Discord.
 * Reads /tmp/eventfinder-flyer-curated.json and posts embeds to DISCORD_FLYERS_WEBHOOK_URL.
 */

import { readFileSync } from 'fs';

const curated = JSON.parse(readFileSync('/tmp/eventfinder-flyer-curated.json', 'utf8'));
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('⚠️  DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

// ── Category emoji map ────────────────────────────────────────────────────────
const CAT_EMOJI = {
  'Meat & Seafood': '🥩',
  Produce: '🥬',
  Dairy: '🧀',
  Bakery: '🍞',
  Frozen: '🧊',
  Pantry: '🥫',
  Beverages: '🥤',
};

// ── Discord colors ────────────────────────────────────────────────────────────
const CAT_COLOR = {
  'Meat & Seafood': 15158332,  // red
  Produce: 3066993,            // green
  Dairy: 16777215,             // white → 0xFFFFFF but Discord caps at 16777215
  Bakery: 15105570,            // orange
  Frozen: 3447003,             // blue
  Pantry: 10181046,            // purple
  Beverages: 1752220,          // teal
};

// ── Format a single item line ─────────────────────────────────────────────────
function fmtItem(item) {
  const pricePart = item.price ? `**${item.price}**` : '';
  const origPart = item.original_price ? ` ~~${item.original_price}~~` : '';
  const discPart = item.discount_pct ? ` (${item.discount_pct}% off)` : '';
  const storePart = item.store ? ` @ ${item.store}` : '';
  const alsoPart = item.also_at ? ` _(also ${item.also_at})_` : '';
  const brandPart = item.brand ? ` (${item.brand})` : '';
  return `• ${item.name}${brandPart} — ${pricePart}${origPart}${discPart}${storePart}${alsoPart}`;
}

// ── Build embed description (max 4096 chars) ──────────────────────────────────
function buildDesc(items) {
  const lines = items.map(fmtItem);
  let desc = '';
  for (const line of lines) {
    if ((desc + '\n' + line).length > 4000) break;
    desc += (desc ? '\n' : '') + line;
  }
  return desc || '_(no items)_';
}

// ── POST helper ───────────────────────────────────────────────────────────────
async function post(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord POST failed ${res.status}: ${text}`);
  }
  // Discord rate-limit: wait 1s between messages
  await new Promise(r => setTimeout(r, 1000));
}

// ── Count totals ──────────────────────────────────────────────────────────────
const totalItems = Object.values(curated.categories).reduce((n, arr) => n + arr.length, 0);
const storeSet = new Set(
  Object.values(curated.categories).flat().map(i => i.store)
);
const storeCount = storeSet.size;
const dateStr = curated.date || new Date().toISOString().split('T')[0];

// ── Posting order (low priority first → high priority last = seen first) ──────
const LOW_PRIORITY = ['Beverages', 'Pantry', 'Bakery', 'Frozen'];
const MID_PRIORITY = ['Dairy', 'Produce'];
const HIGH_PRIORITY = ['Meat & Seafood'];
const ORDER = [...LOW_PRIORITY, ...MID_PRIORITY, ...HIGH_PRIORITY];

// ── 1. Header ─────────────────────────────────────────────────────────────────
await post({
  content: `🛒 **Flyer Deals** — ${totalItems} deals from ${storeCount} stores · ${dateStr}`,
});

// ── 2–4. Category embeds in posting order ────────────────────────────────────
for (const cat of ORDER) {
  const items = curated.categories[cat];
  if (!items || items.length === 0) continue;

  const emoji = CAT_EMOJI[cat] || '🏷️';
  const color = CAT_COLOR[cat] || 7506394;
  const desc = buildDesc(items);

  // Split into chunks of 10 embeds max (though each category is 1 embed here)
  await post({
    embeds: [{
      title: `${emoji} ${cat}`,
      color,
      description: desc,
    }],
  });
}

// ── 5. Highlights embed (posted last = appears at top of Discord channel) ─────
const highlights = curated.highlights || [];

// Also collect all discounted items for a richer highlights list
const allItems = Object.values(curated.categories).flat();
const discounted = allItems
  .filter(i => i.discount_pct && i.discount_pct > 0)
  .sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0))
  .slice(0, 5);

// Merge: staples first, then best discounts (deduplicate by name)
const seen = new Set();
const highlightItems = [];
for (const item of [...highlights, ...discounted]) {
  const key = item.name.toLowerCase();
  if (!seen.has(key)) {
    seen.add(key);
    highlightItems.push(item);
  }
  if (highlightItems.length >= 10) break;
}

if (highlightItems.length > 0) {
  const highlightDesc = highlightItems.map(item => {
    const pricePart = item.price ? `**${item.price}**` : '';
    const origPart = item.original_price ? ` ~~${item.original_price}~~` : '';
    const discPart = item.discount_pct ? ` (${item.discount_pct}% off)` : '';
    const storePart = item.store ? ` @ ${item.store}` : '';
    return `• ${item.name} — ${pricePart}${origPart}${discPart}${storePart}`;
  }).join('\n');

  await post({
    embeds: [{
      title: '⭐ Highlights — This Week\'s Best Deals',
      color: 16766720,
      description: highlightDesc,
    }],
  });
} else {
  await post({
    embeds: [{
      title: '⭐ Highlights — This Week\'s Best Deals',
      color: 16766720,
      description: allItems
        .filter(i => i.staple || i.discount_pct)
        .slice(0, 8)
        .map(fmtItem)
        .join('\n') || '_(Check individual categories above for the best deals this week)_',
    }],
  });
}

console.log('✅ Posted to Discord');
