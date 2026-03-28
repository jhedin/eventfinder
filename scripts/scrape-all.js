#!/usr/bin/env node
// Fetches all active sources from the DB using Browserless.io (or plain fetch fallback).
// Writes HTML files to /tmp and a manifest JSON for extraction subagents.
//
// Usage: node scripts/scrape-all.js
// Output: /tmp/eventfinder-fetch-manifest.json
//         /tmp/eventfinder-page-{id}.html  (one per successful source)

import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');
const token = process.env.BROWSERLESS_TOKEN;

async function fetchWithBrowserless(targetUrl) {
  const response = await fetch(
    `https://production-sfo.browserless.io/content?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        rejectResourceTypes: ['image', 'stylesheet', 'font', 'media'],
        gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
        bestAttempt: true,
      }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Browserless error ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.text();
}

async function fetchPlain(targetUrl) {
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

const db = new Database(DB_PATH);
const sources = db.prepare('SELECT id, url, name FROM sources WHERE active = 1 ORDER BY last_checked_at ASC').all();
db.close();

console.log(`Fetching ${sources.length} active sources (Browserless.io: ${token ? 'YES' : 'NO — plain fetch fallback'})...\n`);

const results = [];

for (const source of sources) {
  const htmlFile = `/tmp/eventfinder-page-${source.id}.html`;
  process.stdout.write(`[${source.id}] ${source.url} ... `);
  try {
    const html = token ? await fetchWithBrowserless(source.url) : await fetchPlain(source.url);
    writeFileSync(htmlFile, html);
    console.log(`OK (${html.length} bytes)`);
    results.push({ source_id: source.id, source_url: source.url, source_name: source.name, success: true, html_file: htmlFile, error: null });
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    results.push({ source_id: source.id, source_url: source.url, source_name: source.name, success: false, html_file: null, error: err.message });
  }
}

const manifest = { fetched_at: new Date().toISOString(), sources: results };
writeFileSync('/tmp/eventfinder-fetch-manifest.json', JSON.stringify(manifest, null, 2));

const succeeded = results.filter(r => r.success).length;
const failed = results.filter(r => !r.success).length;
console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`);
console.log('Manifest written to /tmp/eventfinder-fetch-manifest.json');
