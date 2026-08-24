#!/usr/bin/env node
/**
 * Post curated flyer deals to Discord.
 * Reads: /tmp/eventfinder-flyer-curated.json
 */

import { readFileSync } from 'fs';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('⚠️  DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));

// Post-hoc filters: skip items that slipped through classification
const ITEM_SKIP = [
  'milk-bone', 'dog biscuit', 'dog treat', 'dog snack', 'cat treat', 'cat food',
  'pet', 'diaper', 'baby',
];

function shouldSkipItem(item) {
  const text = (item.name + ' ' + (item.brand || '')).toLowerCase();
  return ITEM_SKIP.some(k => text.includes(k));
}

function formatItem(item) {
  let line = `• **${item.name}**`;
  if (item.price) line += ` — **${item.price}**`;
  if (item.store) line += ` @ ${item.store}`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  if (item.discount_pct) line += ` (${item.discount_pct}% off)`;
  if (item.brand && !item.name.toLowerCase().includes(item.brand.toLowerCase())) {
    line += ` _(${item.brand})_`;
  }
  if (item.also_at && item.also_at.length) {
    line += `\n  also at: ${item.also_at.join(', ')}`;
  }
  return line;
}

async function postToDiscord(payload) {
  const resp = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Discord post failed: ${resp.status} ${text}`);
  }
  // Respect rate limits
  await new Promise(r => setTimeout(r, 600));
}

function buildEmbed(title, color, items, maxItems = 15) {
  const filtered = items.filter(i => !shouldSkipItem(i)).slice(0, maxItems);
  if (!filtered.length) return null;
  const lines = filtered.map(formatItem);
  // Stay within 4096 char limit
  let desc = '';
  for (const line of lines) {
    if (desc.length + line.length + 1 > 3900) break;
    desc += (desc ? '\n' : '') + line;
  }
  return { title, color, description: desc };
}

const CATEGORY_CONFIG = [
  // Low priority (posted first = lowest on screen)
  { name: 'Beverages', emoji: '🥤', color: 3447003 },
  { name: 'Pantry', emoji: '🥫', color: 10181046 },
  { name: 'Bakery', emoji: '🍞', color: 15105570 },
  { name: 'Frozen', emoji: '🧊', color: 3426654 },
  // Mid priority
  { name: 'Dairy', emoji: '🧀', color: 16776960 },
  { name: 'Produce', emoji: '🥬', color: 3066993 },
  // High priority (posted last = highest on screen)
  { name: 'Meat & Seafood', emoji: '🥩', color: 15158332 },
];

// Count total deals
const totalItems = Object.values(curated.categories)
  .flat()
  .filter(i => !shouldSkipItem(i)).length;
const storeSet = new Set(Object.values(curated.categories).flat().map(i => i.store));
const storeCount = storeSet.size;

// --- Phase 3: Post to Discord ---

console.log('\n=== Phase 3: Publish to Discord ===');

// 1. Header message
await postToDiscord({
  content: `🛒 **Flyer Deals** — ${totalItems} deals from ${storeCount} stores · ${curated.date}`,
});
console.log('✅ Posted header');

// 2. Category embeds (low to high priority)
for (const cat of CATEGORY_CONFIG) {
  const items = curated.categories[cat.name] || [];
  const embed = buildEmbed(`${cat.emoji} ${cat.name}`, cat.color, items);
  if (!embed) { console.log(`  (skipped ${cat.name} — no items)`); continue; }
  await postToDiscord({ embeds: [embed] });
  console.log(`✅ Posted ${cat.name} (${embed.description.split('\n').length} items)`);
}

// 3. Highlights embed (staples + biggest discounts — seen first)
const stapleItems = Object.values(curated.categories)
  .flat()
  .filter(i => i.staple && !shouldSkipItem(i));

// Prioritize: actual preference-matching staples + good discounts
const HIGHLIGHT_PRIORITY = [
  'chicken thigh', 'boneless skinless chicken', 'salmon', 'ground beef',
  'milk', 'egg', 'butter', 'cheddar', 'gorgonzola', 'yogurt',
  'corn chip', 'que pasa', 'classico', 'pasta sauce', 'flour',
];

function highlightScore(item) {
  const text = (item.name + ' ' + (item.brand || '')).toLowerCase();
  const prefMatch = HIGHLIGHT_PRIORITY.findIndex(k => text.includes(k));
  const prefScore = prefMatch === -1 ? 0 : (HIGHLIGHT_PRIORITY.length - prefMatch) * 10;
  const discountScore = (item.discount_pct || 0);
  return prefScore + discountScore;
}

// Mix: best staples + top-discounted items from all categories
const allForHighlights = Object.values(curated.categories).flat().filter(i => !shouldSkipItem(i));
const topByDiscount = [...allForHighlights]
  .sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0))
  .slice(0, 15);

const combinedHighlights = [...stapleItems, ...topByDiscount]
  .filter((v, i, arr) => arr.findIndex(x => x.name === v.name && x.store === v.store) === i)
  .sort((a, b) => highlightScore(b) - highlightScore(a))
  .slice(0, 10);

function formatHighlightItem(item) {
  let line = `• **${item.name}**`;
  if (item.price) line += ` — **${item.price}**`;
  if (item.store) line += ` @ ${item.store}`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  if (item.discount_pct) line += ` (${item.discount_pct}% off)`;
  return line;
}

const highlightDesc = combinedHighlights.map(formatHighlightItem).join('\n');

await postToDiscord({
  embeds: [{
    title: '⭐ Highlights — This Week\'s Best Deals',
    color: 16766720,
    description: highlightDesc || 'No highlights this week.',
  }],
});
console.log(`✅ Posted highlights (${combinedHighlights.length} items)`);

console.log('\n✅ Discord post complete');
