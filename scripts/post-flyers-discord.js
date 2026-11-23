#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnv();

const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;
if (!WEBHOOK_URL) {
  console.warn('WARNING: DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(readFileSync('/tmp/eventfinder-flyer-curated.json', 'utf8'));

// Category config: emoji, color, priority order for posting (lowest first)
const CATEGORY_CONFIG = {
  'Beverages': { emoji: '🥤', color: 3447003 },
  'Pantry':    { emoji: '🥫', color: 10070709 },
  'Bakery':    { emoji: '🍞', color: 16744272 },
  'Frozen':    { emoji: '🧊', color: 5592575 },
  'Dairy':     { emoji: '🧀', color: 16766720 },
  'Produce':   { emoji: '🥬', color: 5763719 },
  'Meat & Seafood': { emoji: '🥩', color: 15158332 },
};

// Staple keywords for highlights
const STAPLE_PATTERNS = [
  /chicken thigh/i, /boneless skinless/i, /classico/i, /tomato sauce/i,
  /scotch bonnet/i, /\bpepper\b/i, /\bmilk\b/i, /\beggs\b/i, /\bbutter\b/i,
  /siggi/i, /gorgonzola/i, /balderson/i, /swiss delice/i, /dark chocolate/i,
  /que pasa/i, /corn chip/i, /no name flour/i, /\bflour\b/i,
];

function formatItem(item) {
  let line = `• **${item.name}**`;
  if (item.brand) line += ` (${item.brand})`;
  line += ` — **${item.price}**`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  line += ` @ ${item.store}`;
  if (item.alternatives && item.alternatives.length > 0) {
    const alts = item.alternatives.slice(0, 2).map(a => `${a.price} @ ${a.store}`).join(', ');
    line += ` (also ${alts})`;
  }
  return line;
}

function formatItemHighlight(item) {
  let line = `• **${item.name}**`;
  if (item.brand) line += ` (${item.brand})`;
  line += ` — **${item.price}**`;
  if (item.original_price) line += ` ~~${item.original_price}~~`;
  if (item.discount) {
    line += ` (${item.discount}% off)`;
  }
  line += ` @ ${item.store}`;
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
    throw new Error(`Discord API error ${resp.status}: ${text}`);
  }
  // Rate limit: Discord allows ~5 messages per 2 seconds per webhook
  await new Promise(r => setTimeout(r, 500));
}

// Collect highlights: items matching staples, sorted by discount
const allItems = Object.values(curated.categories).flat();
const highlights = allItems
  .filter(item => item.isStaple || STAPLE_PATTERNS.some(p => p.test(item.name + ' ' + (item.brand || ''))))
  .sort((a, b) => (b.discount || 0) - (a.discount || 0))
  .slice(0, 10);

const totalItems = allItems.length;
const storeSet = new Set(allItems.map(i => i.store));
const totalStores = storeSet.size;

// Phase 3: Post in order (lowest priority first so Discord shows highest last / at top when scrolling up)
let postCount = 0;

// 1. Header message
await postToDiscord({
  content: `🛒 **Flyer Deals** — ${totalItems} deals from ${totalStores} stores · ${curated.date}`,
});
postCount++;

// 2. Category embeds (lowest to highest priority)
const orderedCategories = [
  'Beverages', 'Pantry', 'Bakery', 'Frozen', 'Dairy', 'Produce', 'Meat & Seafood'
];

for (const catName of orderedCategories) {
  const items = curated.categories[catName];
  if (!items || items.length === 0) continue;
  const cfg = CATEGORY_CONFIG[catName] || { emoji: '📦', color: 0 };

  const lines = items.map(item => formatItem(item));
  const MAX_EMBED_CHARS = 4000;
  let chunk = [];
  let chunkLen = 0;

  for (const line of lines) {
    if (chunkLen + line.length + 1 > MAX_EMBED_CHARS && chunk.length > 0) {
      await postToDiscord({
        embeds: [{
          title: cfg.emoji + ' ' + catName,
          color: cfg.color,
          description: chunk.join('\n'),
        }]
      });
      postCount++;
      chunk = [];
      chunkLen = 0;
    }
    chunk.push(line);
    chunkLen += line.length + 1;
  }

  if (chunk.length > 0) {
    await postToDiscord({
      embeds: [{
        title: cfg.emoji + ' ' + catName,
        color: cfg.color,
        description: chunk.join('\n'),
      }]
    });
    postCount++;
  }
}

// 3. Highlights embed (bottom — seen first in Discord)
if (highlights.length > 0) {
  const description = highlights.map(item => formatItemHighlight(item)).join('\n');
  await postToDiscord({
    embeds: [{
      title: '⭐ Highlights — This Week\'s Best Deals',
      color: 16766720,
      description,
    }]
  });
  postCount++;
}

console.log('Posted ' + postCount + ' messages to Discord');
