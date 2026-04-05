#!/usr/bin/env node
// Converts fetched HTML to compact, clean text for LLM event extraction.
//
// Strategy:
//   1. Remove pure noise: stylesheets, external scripts, SVGs, comments, <head>
//   2. Inline <script> blocks: keep ONLY lines that look like data
//      (string assignments, dates, URLs) — strips JS boilerplate
//   3. Parse remaining HTML with cheerio, preferring <main> over full body
//   4. Convert to clean plain text with minimal markdown structure
//
// Result: typically 90-98% smaller than the original HTML, all event data intact.
//
// Usage (CLI):   node scripts/html-to-md.js input.html output.md
// Usage (module): import { htmlToMd } from './scripts/html-to-md.js'

import { readFileSync, writeFileSync } from 'fs';
import { load } from 'cheerio';

// ── Exported conversion function ─────────────────────────────────────────────

export function htmlToMd(html) {
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

const [,, inputFile, outputFile] = process.argv;
if (inputFile && outputFile) {
  const html = readFileSync(inputFile, 'utf8');
  const md   = htmlToMd(html);
  writeFileSync(outputFile, md);
  const pct = Math.round((md.length / html.length) * 100);
  console.log(`${inputFile.split('/').pop()}: ${html.length.toLocaleString()}B → ${md.length.toLocaleString()}B (${pct}%)`);
}
