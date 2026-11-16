#!/usr/bin/env node
// Phase 3: Post curated flyer deals to Discord.

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CURATED = '/tmp/eventfinder-flyer-curated.json';

// Load .env manually (dotenv-free)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // no .env file
  }
}

loadEnv();

const webhookUrl = process.env.DISCORD_FLYERS_WEBHOOK_URL;
if (!webhookUrl) {
  console.warn('Warning: DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync(CURATED, 'utf8'));

const CATEGORY_EMOJI = {
  'Meat & Seafood': '🥩',
  'Produce': '🥬',
  'Dairy': '🧀',
  'Bakery': '🍞',
  'Frozen': '🧊',
  'Pantry': '🥫',
  'Beverages': '🥤',
};

// Priority order for posting (lowest first = header; highest last = seen first)
const POST_ORDER = [
  'Beverages',
  'Pantry',
  'Bakery',
  'Frozen',
  'Dairy',
  'Produce',
  'Meat & Seafood',
];

// Embed colors
const CATEGORY_COLOR = {
  'Meat & Seafood': 15158332, // red
  'Produce': 5763719,         // green
  'Dairy': 16776960,          // yellow
  'Bakery': 16744272,         // orange
  'Frozen': 3447003,          // blue
  'Pantry': 10181046,         // purple
  'Beverages': 1752220,       // teal
};

async function post(payload) {
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Discord error ${resp.status}: ${text}`);
  }
  // Rate limit: Discord allows ~5 messages/2s per webhook
  await new Promise(r => setTimeout(r, 600));
}

function formatItem(item) {
  let line = `• ${item.name}`;
  if (item.brand) line += ` *(${item.brand})*`;
  line += ` — **${item.price}**`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  if (item.discount_pct) line += ` (${item.discount_pct}% off)`;
  line += ` @ ${item.store}`;
  if (item.also) line += `\n  ↳ also: ${item.also}`;
  return line;
}

function chunkDescription(items, maxLen = 4000) {
  const chunks = [];
  let current = '';
  for (const item of items) {
    const line = formatItem(item) + '\n';
    if (current.length + line.length > maxLen) {
      chunks.push(current.trim());
      current = '';
    }
    current += line;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Count total items and stores
const allItems = Object.values(curated.categories).flat();
const stores = [...new Set(allItems.map(i => i.store))];
const totalDeals = allItems.length;

// 1. Header message
await post({
  content: `🛒 **Flyer Deals** — ${totalDeals} deals from ${stores.length} stores · ${curated.date}`,
});

// 2. Category embeds (low to high priority)
for (const catName of POST_ORDER) {
  const items = curated.categories[catName];
  if (!items || items.length === 0) continue;

  const emoji = CATEGORY_EMOJI[catName] || '📦';
  const color = CATEGORY_COLOR[catName] || 7506394;
  const chunks = chunkDescription(items);

  for (let i = 0; i < chunks.length; i++) {
    const title = i === 0 ? `${emoji} ${catName}` : `${emoji} ${catName} (cont.)`;
    await post({
      embeds: [{ title, color, description: chunks[i] }],
    });
  }
}

// 3. Highlights embed (bottom — seen first in Discord)
const staples = allItems.filter(i => i.staple && i.price);
// Sort by discount % desc
staples.sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0));
const highlights = staples.slice(0, 10);

if (highlights.length > 0) {
  const desc = highlights.map(item => {
    let line = `• ${item.name}`;
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
      description: desc,
    }],
  });
}

console.log(`Phase 3 — Publish: ✅ posted to Discord (${POST_ORDER.filter(c => curated.categories[c]).length} categories + highlights)`);
