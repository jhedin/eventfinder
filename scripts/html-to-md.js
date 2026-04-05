#!/usr/bin/env node
// Converts fetched HTML to compact, clean text for LLM event extraction.
//
// Strategy:
//   0. FAST PATHS (structured data extraction — bypasses full HTML parse):
//      a. Shopify product JSON: extract "products":[...] array embedded in page.
//         Workshop sites (Black Forest Wood, Stash Lounge, etc.) encode all
//         sessions as Shopify product variants with full date/time/price.
//         Result: clean product list, ~200 lines vs 600KB HTML.
//   1. Remove pure noise: stylesheets, external scripts, SVGs, comments, <head>
//   2. Inline <script> blocks: keep ONLY lines that look like data
//      (string assignments, dates, URLs) — strips JS boilerplate
//   3. Parse remaining HTML with cheerio, preferring <main> over full body
//   4. Convert to clean plain text with minimal markdown structure
//
// Result: typically 90-98% smaller than the original HTML, all event data intact.
//
// Usage (CLI):   node scripts/html-to-md.js input.html [output.md] [source-url]
// Usage (module): import { htmlToMd } from './scripts/html-to-md.js'
//                 htmlToMd(html, { sourceUrl: 'https://...' })

import { readFileSync, writeFileSync } from 'fs';
import { load } from 'cheerio';

// ── Fast path: Shopify product JSON ──────────────────────────────────────────
// Shopify stores embed all product+variant data in a "products":[...] JSON
// array inside a <script> block. Workshop sites use product variants to
// represent individual class dates (e.g. "Pen Turning - May 9th 2026").
// Extracting this is far cheaper than parsing the full HTML.

function extractShopifyProducts(html, sourceUrl) {
  // Find "products":[ in the raw HTML and extract the full JSON array
  const key = '"products":[';
  const start = html.indexOf(key);
  if (start === -1) return null;

  // Walk forward counting brackets to find the end of the array
  let depth = 0;
  let i = start + key.length - 1; // position at '['
  const end = Math.min(html.length, start + 500_000); // safety cap
  for (; i < end; i++) {
    const c = html[i];
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) break; }
  }

  let products;
  try {
    products = JSON.parse(html.slice(start + key.length - 1, i + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(products) || !products.length) return null;

  // Derive base URL for product links
  let origin = '';
  try { origin = new URL(sourceUrl).origin; } catch { /* ignore */ }

  const lines = ['## Shopify Products / Workshops\n'];
  for (const p of products) {
    if (!p.handle) continue;
    const vars  = Array.isArray(p.variants) ? p.variants : [];
    if (!vars.length) continue;
    const firstVariantName = vars[0]?.name || '';
    const name = firstVariantName.includes(' - ')
      ? firstVariantName.split(' - ')[0].trim()
      : p.handle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const url   = origin ? `${origin}/products/${p.handle}` : '';

    lines.push(`### ${name}`);
    if (url)  lines.push(`URL: ${url}`);

    // Price (stored in cents by Shopify)
    const price = vars[0]?.price;
    if (price) lines.push(`Price: $${(price / 100).toFixed(2)}`);

    // Each variant = one session date
    for (const v of vars) {
      const dateLabel = v.public_title || v.title || '';
      if (!dateLabel) continue;
      // Mark sold-out variants so the LLM can skip them
      const avail = v.available === false ? ' [SOLD OUT]' : '';
      lines.push(`- ${dateLabel}${avail}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Exported conversion function ─────────────────────────────────────────────

export function htmlToMd(html, { sourceUrl = '' } = {}) {
  // ── Phase 0: fast-path structured extraction ───────────────────────────────
  const shopify = extractShopifyProducts(html, sourceUrl);
  if (shopify) return shopify;

  // ── Phase 1: string-level pre-strip (fast, regex) ─────────────────────────
  let t = html;

  // Remove <head> entirely
  t = t.replace(/<head\b[\s\S]*?<\/head>/i, '');
  // Remove HTML comments
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  // Remove base64 data URIs (images encoded inline — always useless for text)
  t = t.replace(/data:[^;]+;base64,[A-Za-z0-9+/=]{50,}/g, '[image]');

  // ── Phase 2: cheerio DOM pass ─────────────────────────────────────────────
  const $ = load(t, { decodeEntities: true });

  // Remove elements that never contain event data
  $('style, link[rel~=stylesheet], noscript, svg, picture, canvas').remove();
  $('img, video, audio, iframe, embed, object').remove();
  $('nav, footer').remove();

  // External script tags — no data, just library loads
  $('script[src]').remove();

  // Inline script blocks: keep only lines that look like data
  $('script:not([src])').each((_, el) => {
    const src = $(el).text();
    const dataLines = src
      .split('\n')
      .filter(line => {
        const s = line.trim();
        if (!s) return false;
        // Keep: string assignments with meaningful content (>12 chars in quotes)
        if (/=\s*["'][^"']{12,}["']/.test(s)) return true;
        // Keep: ISO date strings
        if (/\d{4}-\d{2}-\d{2}/.test(s)) return true;
        // Keep: lines with plain URLs
        if (/https?:\/\/\S{10,}/.test(s)) return true;
        // Keep: lines with apparent event fields
        if (/\bpost\.(name|venue|content|url|t_start|t_end|orange_url|presale)\b/.test(s)) return true;
        return false;
      })
      .join('\n');

    if (dataLines.trim()) {
      $(el).replaceWith(`\n${dataLines}\n`);
    } else {
      $(el).remove();
    }
  });

  // Strip verbose attributes, keep only href and datetime
  $('*').each((_, el) => {
    const attribs = el.attribs || {};
    const keep = {};
    if (attribs.href)     keep.href     = attribs.href;
    if (attribs.datetime) keep.datetime = attribs.datetime;
    el.attribs = keep;
  });

  // ── Phase 3: extract main content area ───────────────────────────────────
  const mainSel = 'main, [role=main], #main, #content, .main-content, article.content, .event-listing';
  const root = $(mainSel).first();
  const working = root.length ? root : $('body');

  // ── Phase 4: convert to plain text with minimal structure ─────────────────
  function toText(el) {
    const tag = el.name?.toLowerCase();
    const children = () => (el.children || []).map(toText).join('');

    if (el.type === 'text') {
      return el.data?.replace(/\s+/g, ' ') ?? '';
    }
    if (!tag) return children();

    switch (tag) {
      case 'h1': return `\n# ${children().trim()}\n`;
      case 'h2': return `\n## ${children().trim()}\n`;
      case 'h3': return `\n### ${children().trim()}\n`;
      case 'h4': case 'h5': case 'h6': return `\n#### ${children().trim()}\n`;
      case 'a': {
        const href = el.attribs?.href || '';
        const txt  = children().trim();
        if (!txt) return href ? `\n${href}\n` : '';
        if (!href || href === txt || href.startsWith('javascript')) return txt;
        return `[${txt}](${href})`;
      }
      case 'strong': case 'b': return `**${children().trim()}**`;
      case 'em':     case 'i': return `_${children().trim()}_`;
      case 'li': return `\n- ${children().trim()}`;
      case 'br': return '\n';
      case 'td': case 'th': return `| ${children().trim()} `;
      case 'tr': return `\n${children()}|`;
      case 'time': {
        const dt  = el.attribs?.datetime || '';
        const txt = children().trim();
        return dt ? `${txt || dt} (${dt})` : txt;
      }
      case 'script': {
        // Already filtered to data lines — surface as preformatted block
        const raw = el.children?.map(c => c.data || '').join('') || '';
        return raw.trim() ? `\n${raw.trim()}\n` : '';
      }
      case 'p': case 'div': case 'section': case 'article':
      case 'main': case 'aside': case 'header': case 'ul': case 'ol':
        return `\n${children()}\n`;
      default:
        return children();
    }
  }

  let text = working
    .toArray()
    .map(toText)
    .join('\n');

  // ── Phase 5: tidy whitespace ──────────────────────────────────────────────
  text = text
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n[ \t]+\n/g, '\n\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  return text;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

const [,, inputFile, outputFile, sourceUrl] = process.argv;
if (inputFile && outputFile) {
  const html = readFileSync(inputFile, 'utf8');
  const md   = htmlToMd(html, { sourceUrl: sourceUrl || '' });
  writeFileSync(outputFile, md);
  const pct = Math.round((md.length / html.length) * 100);
  console.log(`${inputFile.split('/').pop()}: ${html.length.toLocaleString()}B → ${md.length.toLocaleString()}B (${pct}%)`);
}
