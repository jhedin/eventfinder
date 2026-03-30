#!/usr/bin/env node
/**
 * post-flyer-curated-discord.js
 *
 * Reads /tmp/eventfinder-flyer-curated.json and posts a rich embed digest
 * to Discord via DISCORD_FLYERS_WEBHOOK_URL.
 *
 * Discord limits: 10 embeds/message, 4096 chars/embed description.
 * Splits into multiple messages if needed.
 */

import { readFileSync } from 'fs';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY ||
                 process.env.http_proxy  || process.env.HTTP_PROXY;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

const INPUT       = '/tmp/eventfinder-flyer-curated.json';
const WEBHOOK_URL = process.env.DISCORD_FLYERS_WEBHOOK_URL;

const CATEGORY_EMOJI = {
  'Meat & Seafood': '🥩',
  'Produce':        '🥬',
  'Dairy & Eggs':   '🧀',
  'Bakery':         '🍞',
  'Frozen':         '🧊',
  'Pantry':         '🥫',
  'Beverages':      '🥤',
  'Alcohol':        '🍺',
};

// Discord embed colours per category
const CATEGORY_COLOR = {
  'Meat & Seafood': 0xE74C3C,
  'Produce':        0x2ECC71,
  'Dairy & Eggs':   0xF1C40F,
  'Bakery':         0xE67E22,
  'Frozen':         0x3498DB,
  'Pantry':         0x95A5A6,
  'Beverages':      0x1ABC9C,
  'Alcohol':        0x9B59B6,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLine(item) {
  const namePart   = item.name;
  const pricePart  = item.price  ? `**${item.price}**`          : '';
  const origPart   = item.original_price ? ` ~~${item.original_price}~~` : '';
  const brandPart  = item.brand  ? ` *(${item.brand})*`         : '';
  const storePart  = ` @ ${item.store}`;
  return `• ${namePart}${brandPart} — ${pricePart}${origPart}${storePart}`;
}

function chunkEmbed(title, color, lines, maxChars = 4000) {
  // May need to split one category across multiple embeds if very long
  const embeds = [];
  let current = [];
  let len = 0;

  for (const line of lines) {
    const addition = line + '\n';
    if (len + addition.length > maxChars && current.length > 0) {
      embeds.push({ title, color, description: current.join('\n') });
      current = [line];
      len = addition.length;
      title = title + ' (cont.)';
    } else {
      current.push(line);
      len += addition.length;
    }
  }
  if (current.length > 0) {
    embeds.push({ title, color, description: current.join('\n') });
  }
  return embeds;
}

async function postPayload(payload) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const resp = await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (resp.status === 429) {
      const body = await resp.json().catch(() => ({}));
      const waitMs = Math.ceil((body.retry_after || 1) * 1000) + 300;
      console.log(`  Rate limited — waiting ${waitMs}ms…`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Discord POST failed HTTP ${resp.status}: ${text}`);
    }
    await new Promise(r => setTimeout(r, 1200)); // 5 req/2s webhook limit
    return;
  }
  throw new Error('Discord POST failed after 5 attempts (rate limited)');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!WEBHOOK_URL) {
    console.warn('⚠️  DISCORD_FLYERS_WEBHOOK_URL not set — skipping Discord post.');
    process.exit(0);
  }

  const { date, categories } = JSON.parse(readFileSync(INPUT, 'utf8'));

  // Collect all embeds in order
  const allEmbeds = [];
  for (const [cat, items] of Object.entries(categories)) {
    if (!items || items.length === 0) continue;
    const emoji = CATEGORY_EMOJI[cat] || '📦';
    const color = CATEGORY_COLOR[cat] || 0x95A5A6;
    const lines = items.map(formatLine);
    const embedsForCat = chunkEmbed(`${emoji} ${cat}`, color, lines);
    allEmbeds.push(...embedsForCat);
  }

  // Count totals for header
  const totalDeals  = Object.values(categories).reduce((s, arr) => s + arr.length, 0);
  const storeSet    = new Set();
  for (const items of Object.values(categories)) {
    for (const i of items) storeSet.add(i.store);
  }
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // Header message (plain content)
  const headerContent = `🛒 **Flyer Deals** — ${totalDeals} deals from ${storeSet.size} stores · ${formattedDate}`;

  // Split embeds into batches respecting:
  //   - 10 embeds per message
  //   - 6000 total characters across all embed descriptions per message
  const MAX_EMBEDS   = 10;
  const MAX_TOTAL    = 5800; // leave headroom
  const batches      = [];
  let currentBatch   = [];
  let currentTotal   = 0;

  for (const embed of allEmbeds) {
    const descLen = (embed.description || '').length + (embed.title || '').length;
    const wouldExceed = currentTotal + descLen > MAX_TOTAL;
    const wouldOverflow = currentBatch.length >= MAX_EMBEDS;

    if ((wouldExceed || wouldOverflow) && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTotal = 0;
    }
    currentBatch.push(embed);
    currentTotal += descLen;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  console.log(`Posting header + ${batches.length} embed batch(es) (${allEmbeds.length} embeds, ${totalDeals} deals)…`);

  // First message: header + first batch of embeds
  const firstPayload = { content: headerContent, embeds: batches[0] || [] };
  await postPayload(firstPayload);
  console.log(`  [1/${batches.length}] posted`);

  for (let i = 1; i < batches.length; i++) {
    await postPayload({ embeds: batches[i] });
    console.log(`  [${i + 1}/${batches.length}] posted`);
  }

  console.log(`\n✅ Posted to Discord: ${totalDeals} deals across ${allEmbeds.length} embeds in ${batches.length} message(s).`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
