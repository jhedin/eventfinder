#!/usr/bin/env node
// Phase 3: Post curated flyer deals to Discord.

import { readFileSync } from 'fs';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('⚠️  DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));

// ── Category metadata ──────────────────────────────────────────────────────
const CAT_META = {
  'Beverages':    { emoji: '🥤', color: 3447003,  priority: 1 },
  'Pantry':       { emoji: '🥫', color: 10181046, priority: 2 },
  'Bakery':       { emoji: '🍞', color: 15105570, priority: 3 },
  'Frozen':       { emoji: '🧊', color: 8900331,  priority: 4 },
  'Dairy':        { emoji: '🧀', color: 16776960, priority: 5 },
  'Produce':      { emoji: '🥬', color: 3066993,  priority: 6 },
  'Meat & Seafood': { emoji: '🥩', color: 15158332, priority: 7 },
};

function formatItem(item) {
  let line = `• **${item.price}** ${item.name}`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  if (item.discount) line += ` (${item.discount}% off)`;
  line += ` @ ${item.store}`;
  if (item.alt_stores && item.alt_stores.length > 0) {
    const alts = item.alt_stores.map(a => `${a.store} ${a.price}`).join(', ');
    line += ` (also: ${alts})`;
  }
  return line;
}

async function postToDiscord(payload) {
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
  await new Promise(r => setTimeout(r, 1000));
}

function chunkText(lines, maxChars = 4000) {
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + '\n' + line).length > maxChars) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// ── Sort categories by posting order (low priority first = appears at top) ──
const sortedCats = Object.entries(curated.categories)
  .filter(([cat]) => CAT_META[cat])
  .sort(([a], [b]) => (CAT_META[a]?.priority ?? 99) - (CAT_META[b]?.priority ?? 99));

const totalItems = Object.values(curated.categories).reduce((s, v) => s + v.length, 0);
const storeCount = new Set(
  Object.values(curated.categories).flat().map(i => i.store)
).size;

// ── 1. Header message ──────────────────────────────────────────────────────
await postToDiscord({
  content: `🛒 **Flyer Deals** — ${totalItems} deals from ${storeCount} stores · ${curated.date}`,
});
console.log('Posted header');

// ── 2. Category embeds (low → high priority) ──────────────────────────────
for (const [cat, items] of sortedCats) {
  const meta = CAT_META[cat];
  const lines = items.map(formatItem);
  const chunks = chunkText(lines);

  for (let i = 0; i < chunks.length; i++) {
    const title = i === 0 ? `${meta.emoji} ${cat}` : `${meta.emoji} ${cat} (cont.)`;
    await postToDiscord({
      embeds: [{
        title,
        color: meta.color,
        description: chunks[i],
      }],
    });
  }
  console.log(`Posted ${cat} (${items.length} items)`);
}

// ── 3. Highlights embed (last = appears first in channel) ─────────────────
const allStaples = Object.entries(curated.categories)
  .flatMap(([, items]) => items.filter(i => i.staple));

if (allStaples.length > 0) {
  // Sort by discount desc, then items without discount by relevance
  allStaples.sort((a, b) => {
    const da = a.discount || 0;
    const db2 = b.discount || 0;
    return db2 - da;
  });

  const highlightLines = allStaples.slice(0, 10).map(item => {
    let line = `• ${item.name} — **${item.price}**`;
    if (item.original_price) line += ` ~~${item.original_price}~~`;
    if (item.discount) line += ` (${item.discount}% off)`;
    line += ` @ ${item.store}`;
    return line;
  });

  await postToDiscord({
    embeds: [{
      title: '⭐ Highlights — This Week\'s Best Deals',
      color: 16766720,
      description: highlightLines.join('\n'),
    }],
  });
  console.log(`Posted highlights (${Math.min(allStaples.length, 10)} items)`);
} else {
  console.log('No staple items found for highlights');
}

// ── Summary ────────────────────────────────────────────────────────────────
const catCount = sortedCats.length;
console.log(`\nPhase 3 — Publish: ✅ posted to Discord (${totalItems} items, ${catCount} categories)`);
