#!/usr/bin/env node
// Formats pending flyer items and posts a digest to Discord via webhook.
// Reads from the DB (sent_flyer_items WHERE status='pending') and posts
// grouped-by-category messages, splitting at Discord's 2000-char limit.
//
// Usage: node scripts/post-flyer-discord.js
// Env:   DISCORD_FLYERS_WEBHOOK_URL (required)

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY ||
                 process.env.http_proxy  || process.env.HTTP_PROXY;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

const CATEGORY_EMOJI = {
  'Meat & Seafood': '🥩',
  'Produce':        '🥬',
  'Dairy':          '🧀',
  'Bakery':         '🍞',
  'Frozen':         '🧊',
  'Pantry':         '🥫',
  'Beverages':      '🥤',
  'Personal Care':  '🧴',
  'Household':      '🏠',
  'Non-Food':       '🛠️',
  'Other':          '📦',
};

// Preferred category order for the digest
const CATEGORY_ORDER = [
  'Meat & Seafood', 'Produce', 'Dairy', 'Bakery', 'Frozen',
  'Pantry', 'Beverages', 'Personal Care', 'Household', 'Non-Food', 'Other',
];

async function postToDiscord(content) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const resp = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (resp.status === 429) {
      const body = await resp.json().catch(() => ({}));
      const waitMs = Math.ceil((body.retry_after || 1) * 1000) + 200;
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Discord POST failed: HTTP ${resp.status} — ${text}`);
    }
    // Respect Discord rate limits (5 req/2s per webhook)
    await new Promise(r => setTimeout(r, 1200));
    return;
  }
  throw new Error('Discord POST failed after 5 attempts (rate limited)');
}

function formatItem(item) {
  const brandPart = item.brand ? ` (${item.brand})` : '';
  const pricePart = item.regular_price
    ? `**${item.sale_price}** ~~${item.regular_price}~~`
    : `**${item.sale_price}**`;
  return `• ${item.item_name}${brandPart} — ${pricePart} @ ${item.store_name}`;
}

async function main() {
  if (!WEBHOOK_URL) {
    console.warn('DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post.');
    process.exit(0);
  }

  const db = new Database(DB_PATH);

  const rows = db.prepare(`
    SELECT fi.item_name, fi.brand, fi.sale_price, fi.regular_price,
           fi.category, fi.sale_end, s.name as store_name
    FROM flyer_items fi
    JOIN sources s ON s.id = fi.source_id
    JOIN sent_flyer_items sfi ON sfi.flyer_item_id = fi.id
    WHERE sfi.status = 'pending'
    ORDER BY fi.category, fi.item_name, s.name
  `).all();
  db.close();

  if (rows.length === 0) {
    console.log('No pending items — skipping Discord post.');
    process.exit(0);
  }

  // Group by category
  const byCategory = {};
  for (const row of rows) {
    const cat = row.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(row);
  }

  const storeSet = new Set(rows.map(r => r.store_name));
  const date = new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  const header = `🛒 **Flyer Deals** — ${rows.length} deals from ${storeSet.size} stores · ${date}\n\n`;

  // Build lines grouped by category
  const allLines = [];
  const categories = CATEGORY_ORDER.filter(c => byCategory[c]);
  // Add any unlisted categories at the end
  for (const cat of Object.keys(byCategory)) {
    if (!categories.includes(cat)) categories.push(cat);
  }

  for (const cat of categories) {
    const items = byCategory[cat];
    const emoji = CATEGORY_EMOJI[cat] || '📦';
    allLines.push(`${emoji} **${cat}**`);
    for (const item of items) {
      allLines.push(formatItem(item));
    }
    allLines.push('');
  }

  // Split into ≤2000-char messages
  const MAX_LEN = 2000;
  const messages = [];
  let current = messages.length === 0 ? header : '';

  for (const line of allLines) {
    const addition = line + '\n';
    if ((current + addition).length > MAX_LEN) {
      if (current.trim()) messages.push(current.trimEnd());
      current = addition;
    } else {
      current += addition;
    }
  }
  if (current.trim()) messages.push(current.trimEnd());

  console.log(`Posting ${messages.length} message(s) to Discord (${rows.length} deals)...`);

  let postedCount = 0;
  for (const msg of messages) {
    await postToDiscord(msg);
    postedCount++;
    process.stdout.write(`  [${postedCount}/${messages.length}]\r`);
  }
  console.log(`\nPosted ${messages.length} message(s) to Discord.`);

  return { deals: rows.length, stores: storeSet.size, messages: messages.length };
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
