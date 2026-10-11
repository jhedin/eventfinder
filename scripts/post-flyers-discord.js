#!/usr/bin/env node
/**
 * Posts curated flyer deals to Discord via webhook.
 * Posting order: header → low-priority → mid-priority → high-priority → highlights
 * (Discord shows bottom of channel first, so most important content is seen first)
 */

import { readFileSync } from 'fs';

const CURATED_FILE = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('⚠️  DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync(CURATED_FILE, 'utf8'));

const CATEGORY_CONFIG = {
  'Beverages': { emoji: '🥤', color: 3447003 },      // blue
  'Pantry':    { emoji: '🥫', color: 10070709 },     // brown
  'Bakery':    { emoji: '🍞', color: 16744272 },     // orange
  'Frozen':    { emoji: '🧊', color: 5592575 },      // light blue
  'Dairy':     { emoji: '🧀', color: 16766720 },     // yellow
  'Produce':   { emoji: '🥬', color: 5763719 },      // green
  'Meat & Seafood': { emoji: '🥩', color: 15158332 }, // red
};

function formatItem(item) {
  let line = `• **${item.name}**`;
  if (item.brand && !item.name.toLowerCase().includes(item.brand.toLowerCase())) {
    line += ` (${item.brand})`;
  }
  line += ` — **${item.price}** @ ${item.store}`;
  if (item.original_price) {
    line += ` ~~${item.original_price}~~`;
  }
  if (item.alt_stores) {
    line += `  *(${item.alt_stores})*`;
  }
  if (item.note) {
    line += ` ⭐`;
  }
  return line;
}

async function postToDiscord(payload) {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API error ${response.status}: ${text}`);
  }

  // Discord rate limit: 5 requests per 2 seconds per webhook
  await new Promise(r => setTimeout(r, 600));
}

function buildCategoryEmbed(category, items) {
  const config = CATEGORY_CONFIG[category] || { emoji: '🛒', color: 7506394 };
  const lines = items.map(formatItem);

  // Discord embed description max 4096 chars — split if needed
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

  return chunks.map((desc, i) => ({
    title: i === 0 ? `${config.emoji} ${category}` : `${config.emoji} ${category} (cont.)`,
    color: config.color,
    description: desc,
  }));
}

// Count total items and stores
const totalItems = Object.values(curated.categories).flat().length;
const allStores = [...new Set(Object.values(curated.categories).flat().map(i => i.store))];
const date = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

// Build highlights (staples + best deals)
const staples = Object.values(curated.categories).flat().filter(i => i.note === 'staple');
const highlights = [
  ...staples,
  // Add a few high-value meat deals
  ...curated.categories['Meat & Seafood'].filter(i =>
    /salmon|chicken.*thigh|chinook/i.test(i.name) && !staples.includes(i)
  ).slice(0, 3),
].slice(0, 10);

const highlightLines = highlights.map(item => {
  let line = `• **${item.name}**`;
  if (item.brand && !item.name.toLowerCase().includes(item.brand.toLowerCase())) {
    line += ` (${item.brand})`;
  }
  line += ` — **${item.price}** @ ${item.store}`;
  if (item.original_price) {
    line += ` ~~${item.original_price}~~`;
  }
  return line;
}).join('\n');

const highlightsEmbed = {
  title: '⭐ Highlights — This Week\'s Best Deals',
  color: 16766720,
  description: highlightLines,
  footer: { text: `Week of ${curated.date} · ${totalItems} deals from ${allStores.length} stores` },
};

// Posting order: header first, then categories low→high priority, then highlights last
const POSTING_ORDER = ['Beverages', 'Pantry', 'Bakery', 'Frozen', 'Dairy', 'Produce', 'Meat & Seafood'];

async function main() {
  console.log(`Posting to Discord: ${totalItems} items from ${allStores.length} stores`);

  // 1. Header message
  await postToDiscord({
    content: `🛒 **Flyer Deals** — ${totalItems} deals from ${allStores.length} stores · ${date}`,
  });
  console.log('✅ Posted header');

  // 2-8. Categories in posting order
  for (const category of POSTING_ORDER) {
    const items = curated.categories[category];
    if (!items || items.length === 0) continue;

    const embeds = buildCategoryEmbed(category, items);
    // Discord: max 10 embeds per message
    for (let i = 0; i < embeds.length; i += 10) {
      await postToDiscord({ embeds: embeds.slice(i, i + 10) });
    }
    console.log(`✅ Posted ${category} (${items.length} items)`);
  }

  // 9. Highlights (bottom = seen first in Discord)
  await postToDiscord({ embeds: [highlightsEmbed] });
  console.log('✅ Posted highlights embed');

  console.log('\nDone — all messages posted to Discord.');
}

main().catch(err => {
  console.error('Discord posting failed:', err.message);
  process.exit(1);
});
