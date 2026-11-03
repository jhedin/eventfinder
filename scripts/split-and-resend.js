#!/usr/bin/env node
// One-time use: splits oversized messages in discord-digest.json and reposts
// only the ones that previously failed (identified by 0-based index args).
// Usage: node scripts/split-and-resend.js <index1> [index2 ...]

import { readFileSync, writeFileSync, renameSync } from 'fs';
import { execSync } from 'child_process';

const DIGEST_FILE = '/tmp/discord-digest.json';
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('DISCORD_WEBHOOK_URL not set — skipping');
  process.exit(0);
}

const failedIndices = process.argv.slice(2).map(Number);
if (failedIndices.length === 0) {
  console.error('Usage: node scripts/split-and-resend.js <index1> [index2 ...]');
  process.exit(1);
}

const digest = JSON.parse(readFileSync(DIGEST_FILE, 'utf8'));

function splitMessage(msg) {
  // Split at double-newline boundaries into chunks ≤ 1950 chars
  const parts = msg.split(/\n\n(?=\*\*)/);
  const chunks = [];
  let current = '';
  const header = parts[0].includes('**') && !parts[0].startsWith('**') ? parts.shift() : null;

  for (const part of parts) {
    const candidate = current ? current + '\n\n' + part : (header ? header + '\n\n' + part : part);
    if (candidate.length <= 1950) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = header
        ? (chunks.length === 0 ? part : part)
        : part;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [msg];
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const TMP = '/tmp/discord_post_msg.json';
let passed = 0;
let failed = 0;

for (const idx of failedIndices) {
  const msg = digest.messages[idx];
  if (!msg) {
    console.error(`No message at index ${idx}`);
    continue;
  }

  const chunks = msg.length > 1950 ? splitMessage(msg) : [msg];
  console.log(`Message ${idx}: split into ${chunks.length} chunk(s)`);

  for (const chunk of chunks) {
    console.log(`  Posting chunk (${chunk.length} chars)...`);
    writeFileSync(TMP, JSON.stringify({ content: chunk }));

    let code = '000';
    for (let attempt = 1; attempt <= 3; attempt++) {
      code = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" -d @${TMP} "${WEBHOOK_URL}"`
      ).toString().trim();

      if (code === '204') break;
      if (attempt < 3) {
        const backoff = attempt * 2000;
        console.warn(`  Attempt ${attempt}: got ${code}, retrying in ${backoff}ms...`);
        sleep(backoff);
      }
    }

    if (code === '204') {
      passed++;
      console.log(`  OK`);
    } else {
      failed++;
      console.error(`  Failed after 3 attempts (last: ${code})`);
    }
    sleep(800);
  }
}

console.log(`Done: ${passed} chunks posted, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
