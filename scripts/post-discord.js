#!/usr/bin/env node
// Reads /tmp/discord-digest.json and posts all messages to Discord webhook.
// Handles rate limiting (HTTP 429) with exponential backoff.
//
// Usage: node scripts/post-discord.js

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const DIGEST_FILE = '/tmp/discord-digest.json';
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DELAY_MS = 800; // between posts to avoid rate limits

if (!WEBHOOK_URL) {
  console.warn('DISCORD_WEBHOOK_URL not set — skipping Discord post');
  process.exit(0);
}

let digest;
try {
  digest = JSON.parse(readFileSync(DIGEST_FILE, 'utf8'));
} catch (e) {
  console.error(`Failed to read ${DIGEST_FILE}: ${e.message}`);
  process.exit(1);
}

const messages = digest.messages ?? [];
if (messages.length === 0) {
  console.log('No messages to post.');
  process.exit(0);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const TMP = '/tmp/discord_post_msg.json';
let passed = 0;
let failed = 0;

for (let i = 0; i < messages.length; i++) {
  writeFileSync(TMP, JSON.stringify({ content: messages[i] }));

  let code = '000';
  for (let attempt = 1; attempt <= 3; attempt++) {
    code = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" -d @${TMP} "${WEBHOOK_URL}"`
    ).toString().trim();

    if (code === '204') break;
    if (attempt < 3) {
      const backoff = attempt * 2000;
      console.warn(`Message ${i + 1}: got ${code}, retrying in ${backoff}ms...`);
      sleep(backoff);
    }
  }

  if (code === '204') {
    passed++;
  } else {
    failed++;
    console.error(`Message ${i + 1}: failed after 3 attempts (last: ${code})`);
  }

  if (i < messages.length - 1) sleep(DELAY_MS);
}

console.log(`Discord: ${passed}/${messages.length} posted, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
