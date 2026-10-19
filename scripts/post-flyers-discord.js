#!/usr/bin/env node
// Post curated flyer deals to Discord
import fs from 'fs';
import https from 'https';
import { URL } from 'url';

const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';

const webhookUrl = process.env.DISCORD_FLYERS_WEBHOOK_URL;
if (!webhookUrl) {
  console.warn('WARNING: DISCORD_FLYERS_WEBHOOK_URL not set, skipping Discord post');
  process.exit(0);
}

const curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));

function postToDiscord(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const body = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, status: res.statusCode });
        } else {
          reject(new Error(`Discord API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const CATEGORY_EMOJI = {
  'Meat & Seafood': '🥩',
  'Produce': '🥬',
  'Dairy': '🧀',
  'Bakery': '🍞',
  'Frozen': '🧊',
  'Pantry': '🥫',
  'Beverages': '🥤',
};

const CATEGORY_COLOR = {
  'Meat & Seafood': 15158332, // red
  'Produce': 5763719,         // green
  'Dairy': 16777215,          // white-ish (use 16119285 = light yellow)
  'Bakery': 15844367,         // warm orange
  'Frozen': 3447003,          // blue
  'Pantry': 10181046,         // purple-ish
  'Beverages': 3066993,       // teal
};
// Fix white to a displayable color
CATEGORY_COLOR['Dairy'] = 16119285;

function formatItem(item) {
  let line = `• ${item.name}`;
  if (item.brand && !item.name.toLowerCase().includes(item.brand.toLowerCase())) {
    line += ` *(${item.brand})*`;
  }
  if (item.price) {
    line += ` — **${item.price}**`;
  }
  if (item.original_price) {
    line += ` ~~${item.original_price}~~`;
  }
  line += ` @ ${item.store}`;
  return line;
}

function discountPct(price, orig) {
  if (!price || !orig) return 0;
  const p = parseFloat(price.replace(/[^0-9.]/g, ''));
  const o = parseFloat(orig.replace(/[^0-9.]/g, ''));
  if (!p || !o || o <= p) return 0;
  return Math.round((o - p) / o * 100);
}

// Count total deals
let totalItems = 0;
for (const items of Object.values(curated.categories)) totalItems += items.length;
const storeCount = new Set(
  Object.values(curated.categories).flat().map(i => i.store)
).size;

// Posting order (lowest priority first = top of channel):
// Header, low-priority cats, mid, high, highlights
const LOW_PRIORITY = ['Beverages', 'Pantry', 'Bakery', 'Frozen'];
const MID_PRIORITY = ['Dairy', 'Produce'];
const HIGH_PRIORITY = ['Meat & Seafood'];

const orderedCats = [...LOW_PRIORITY, ...MID_PRIORITY, ...HIGH_PRIORITY]
  .filter(c => curated.categories[c]);

const STAPLES = [
  'chicken thigh', 'boneless skinless', 'classico', 'scotch bonnet', 'bell pepper', 'peppers',
  'milk', 'eggs', 'egg', 'butter', "siggi", 'gorgonzola', 'balderson',
  'swiss delice', 'dark chocolate', 'que pasa', 'corn chip', 'flour',
];

function isStaple(item) {
  const text = (item.name + ' ' + (item.brand || '')).toLowerCase();
  return STAPLES.some(s => text.includes(s));
}

async function main() {
  // 1. Header message
  console.log('Posting header...');
  await postToDiscord({
    content: `🛒 **Flyer Deals** — ${totalItems} deals from ${storeCount} stores · ${curated.date}`,
  });
  await sleep(600);

  // 2-4. Category embeds in order
  for (const cat of orderedCats) {
    const items = curated.categories[cat];
    if (!items || items.length === 0) continue;

    const emoji = CATEGORY_EMOJI[cat] || '•';
    const color = CATEGORY_COLOR[cat] || 7506394;

    // Split if too long
    const lines = items.map(formatItem);
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
      const title = chunks.length > 1 ? `${emoji} ${cat} (${i + 1}/${chunks.length})` : `${emoji} ${cat}`;
      console.log(`Posting ${title}...`);
      await postToDiscord({
        embeds: [{ title, color, description: chunks[i] }],
      });
      await sleep(600);
    }
  }

  // 5. Highlights embed (posted last = shown first in Discord)
  const highlights = Object.values(curated.categories)
    .flat()
    .filter(item => isStaple(item) && item.original_price)
    .sort((a, b) => discountPct(b.price, b.original_price) - discountPct(a.price, a.original_price))
    .slice(0, 10);

  if (highlights.length > 0) {
    const hlLines = highlights.map(item => {
      const pct = discountPct(item.price, item.original_price);
      let line = `• ${item.name}`;
      if (item.brand && !item.name.toLowerCase().includes(item.brand.toLowerCase())) {
        line += ` *(${item.brand})*`;
      }
      line += ` — **${item.price}**`;
      if (item.original_price) line += ` ~~${item.original_price}~~`;
      line += ` @ ${item.store}`;
      if (pct > 0) line += ` (${pct}% off)`;
      return line;
    });

    console.log('Posting highlights...');
    await postToDiscord({
      embeds: [{
        title: '⭐ Highlights — This Week\'s Best Deals',
        color: 16766720,
        description: hlLines.join('\n'),
      }],
    });
  }

  console.log('✅ Posted to Discord');
}

main().catch(err => {
  console.error('Discord post failed:', err.message);
  process.exit(1);
});
