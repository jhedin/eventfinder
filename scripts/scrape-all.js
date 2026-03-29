#!/usr/bin/env node
// Fetches all active sources from the DB using Browserless.io (or plain curl fallback).
// Writes HTML files to /tmp and a manifest JSON for extraction subagents.
//
// Usage: node scripts/scrape-all.js
// Output: /tmp/eventfinder-fetch-manifest.json
//         /tmp/eventfinder-page-{id}.html  (one per successful source)

import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');
const token = process.env.BROWSERLESS_TOKEN;

// Use curl so HTTP_PROXY / HTTPS_PROXY env vars are respected automatically.
function fetchWithBrowserless(targetUrl) {
  const body = JSON.stringify({
    url: targetUrl,
    rejectResourceTypes: ['image', 'stylesheet', 'font', 'media'],
    gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
    bestAttempt: true,
  });
  return execFileSync('curl', [
    '-sf', '--max-time', '60',
    '-X', 'POST',
    '-H', 'Content-Type: application/json',
    '-d', body,
    `https://production-sfo.browserless.io/content?token=${token}`,
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function fetchPlain(targetUrl) {
  return execFileSync('curl', [
    '-sfL', '--max-time', '30',
    '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    targetUrl,
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

const db = new Database(DB_PATH);
const sources = db.prepare('SELECT id, url, name FROM sources WHERE active = 1 ORDER BY last_checked_at ASC').all();
db.close();

console.log(`Fetching ${sources.length} active sources (Browserless.io: ${token ? 'YES' : 'NO — plain curl fallback'})...\n`);

const results = [];

for (const source of sources) {
  const htmlFile = `/tmp/eventfinder-page-${source.id}.html`;
  process.stdout.write(`[${source.id}] ${source.url} ... `);
  try {
    const html = token ? fetchWithBrowserless(source.url) : fetchPlain(source.url);
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
