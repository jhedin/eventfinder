#!/usr/bin/env node
// Fetches a URL using Browserless.io (if BROWSERLESS_TOKEN is set) or plain curl.
// Returns the rendered page content as plain text / HTML to stdout.
// Uses curl so HTTP_PROXY / HTTPS_PROXY env vars are respected automatically.
//
// Usage: node scripts/fetch-page.js <url>

import { execFileSync } from 'child_process';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/fetch-page.js <url>');
  process.exit(1);
}

const token = process.env.BROWSERLESS_TOKEN;

function fetchWithBrowserless(targetUrl) {
  const body = JSON.stringify({
    url: targetUrl,
    rejectResourceTypes: ['image', 'stylesheet', 'font', 'media'],
    gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
    bestAttempt: true,
  });
  const result = execFileSync('curl', [
    '-sf', '--max-time', '60',
    '-X', 'POST',
    '-H', 'Content-Type: application/json',
    '-d', body,
    `https://production-sfo.browserless.io/content?token=${token}`,
  ], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
  return result;
}

function fetchPlain(targetUrl) {
  return execFileSync('curl', [
    '-sfL', '--max-time', '30',
    '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    targetUrl,
  ], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
}

try {
  const html = token ? fetchWithBrowserless(url) : fetchPlain(url);
  process.stdout.write(html);
} catch (err) {
  console.error(`Error fetching ${url}: ${err.stderr?.toString() || err.message}`);
  process.exit(1);
}
