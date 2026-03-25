#!/usr/bin/env node
// Fetches a URL using Browserless.io (if BROWSERLESS_TOKEN is set) or plain fetch.
// Returns the rendered page content as plain text / HTML to stdout.
//
// Usage: node scripts/fetch-page.js <url>

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/fetch-page.js <url>');
  process.exit(1);
}

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
    throw new Error(`Browserless error ${response.status}: ${text}`);
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

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

try {
  const html = token
    ? await fetchWithBrowserless(url)
    : await fetchPlain(url);

  process.stdout.write(html);
} catch (err) {
  console.error(`Error fetching ${url}: ${err.message}`);
  process.exit(1);
}
