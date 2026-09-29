#!/usr/bin/env node
/**
 * Phase 3: Post curated flyer deals to Discord
 * Reads /tmp/eventfinder-flyer-curated.json
 * Posts to DISCORD_FLYERS_WEBHOOK_URL
 */

import { readFileSync } from 'fs';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

// Configure proxy if set
if (process.env.HTTPS_PROXY) {
  setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
}

const CATEGORY_CONFIG = {
  'Beverages':    { emoji: '🥤', color: 0x1abc9c, priority: 1 },
  'Pantry':       { emoji: '🥫', color: 0xe67e22, priority: 2 },
  'Bakery':       { emoji: '🍞', color: 0xf39c12, priority: 3 },
  'Frozen':       { emoji: '🧊', color: 0x3498db, priority: 4 },
  'Dairy':        { emoji: '🧀', color: 0x9b59b6, priority: 5 },
  'Produce':      { emoji: '🥬', color: 0x2ecc71, priority: 6 },
  'Meat & Seafood': { emoji: '🥩', color: 0xe74c3c, priority: 7 },
};

async function postToDiscord(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
  // Discord rate limit: wait 1s between posts
  await new Promise(r => setTimeout(r, 1000));
}

function formatItemLine(item) {
  const price = item.price ? `**${item.price}**` : '(price N/A)';
  const orig = item.original_price ? ` ~~${item.original_price}~~` : '';
  const store = ` @ ${item.store}`;
  const brand = item.brand ? ` *(${item.brand})*` : '';
  const alts = item.alternates && item.alternates.length > 0
    ? ` *(also ${item.alternates.map(a => `${a.price} @ ${a.store}`).join(', ')})*`
    : '';
  const name = item.name.length > 60 ? item.name.substring(0, 57) + '…' : item.name;
  return `• ${name}${brand} — ${price}${orig}${store}${alts}`;
}

function buildEmbedDescription(items) {
  return items.map(formatItemLine).join('\n');
}

function chunkEmbeds(embeds, maxPerMsg = 10) {
  const chunks = [];
  for (let i = 0; i < embeds.length; i += maxPerMsg) {
    chunks.push(embeds.slice(i, i + maxPerMsg));
  }
  return chunks;
}

async function main() {
  if (!WEBHOOK_URL) {
    console.warn('⚠️  DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
    process.exit(0);
  }

  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
  const categories = curated.categories;

  // Count totals
  const totalItems = Object.values(categories).reduce((n, arr) => n + arr.length, 0);
  const storeSet = new Set();
  for (const items of Object.values(categories)) {
    for (const item of items) storeSet.add(item.store);
  }
  const numStores = storeSet.size;

  // --- 1. Header message ---
  await postToDiscord({
    content: `🛒 **Flyer Deals** — ${totalItems} deals from ${numStores} stores · ${curated.date}`,
  });
  console.log('Posted header message');

  // --- 2-4. Category embeds in posting order (low → high priority) ---
  const sortedCategories = Object.entries(CATEGORY_CONFIG)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([name]) => name);

  const allCategoryEmbeds = [];

  for (const catName of sortedCategories) {
    const items = categories[catName];
    if (!items || items.length === 0) continue;

    const config = CATEGORY_CONFIG[catName];
    const description = buildEmbedDescription(items);

    // Split if over 4096 chars
    if (description.length <= 4096) {
      allCategoryEmbeds.push({
        title: `${config.emoji} ${catName}`,
        color: config.color,
        description,
      });
    } else {
      // Split into two halves
      const mid = Math.ceil(items.length / 2);
      allCategoryEmbeds.push({
        title: `${config.emoji} ${catName} (1/2)`,
        color: config.color,
        description: buildEmbedDescription(items.slice(0, mid)),
      });
      allCategoryEmbeds.push({
        title: `${config.emoji} ${catName} (2/2)`,
        color: config.color,
        description: buildEmbedDescription(items.slice(mid)),
      });
    }
  }

  // Post each category embed as its own message (Discord 6000-char-per-message limit)
  for (const embed of allCategoryEmbeds) {
    await postToDiscord({ embeds: [embed] });
    console.log(`Posted: ${embed.title}`);
  }

  // --- 5. Highlights embed (last — seen first in Discord) ---
  // Find best staple + high-discount items
  const allItems = Object.values(categories).flat();
  const highlights = allItems
    .filter(item => item.staple || item.discount_pct >= 20)
    .sort((a, b) => {
      // Staples first
      if (a.staple && !b.staple) return -1;
      if (!a.staple && b.staple) return 1;
      // Then by discount %
      const aD = a.discount_pct || 0;
      const bD = b.discount_pct || 0;
      return bD - aD;
    })
    .slice(0, 10);

  if (highlights.length > 0) {
    const highlightLines = highlights.map(item => {
      const price = item.price ? `**${item.price}**` : '(price N/A)';
      const orig = item.original_price ? ` ~~${item.original_price}~~` : '';
      const disc = item.discount_pct ? ` *(${item.discount_pct}% off)*` : '';
      const store = ` @ ${item.store}`;
      const name = item.name.length > 55 ? item.name.substring(0, 52) + '…' : item.name;
      return `• ${name} — ${price}${orig}${disc}${store}`;
    }).join('\n');

    await postToDiscord({
      embeds: [{
        title: '⭐ Highlights — This Week\'s Best Deals',
        color: 0xffb800,
        description: highlightLines,
      }],
    });
    console.log('Posted highlights embed');
  }

  console.log(`\n✅ Posted to Discord: ${totalItems} items across ${Object.keys(categories).length} categories`);
}

main().catch(err => {
  console.error('Discord post failed:', err.message);
  process.exit(1);
});
