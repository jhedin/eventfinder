#!/usr/bin/env node
// Reads /tmp/discord-digest.json, splits any message > MAX_LEN chars at event boundaries,
// and writes the split chunks to a specified output file (default: /tmp/discord-retry.json).
// Only outputs the replacement chunks for oversized messages — not the already-posted ones.
//
// Usage: node scripts/split-discord-messages.js [indices...] [--out FILE]
//   indices: 0-based message indices to split (default: all oversized)
//   --out FILE: output file path (default: /tmp/discord-retry.json)

import { readFileSync, writeFileSync } from 'fs';

const MAX_LEN = 1950;
const DIGEST_FILE = '/tmp/discord-digest.json';

const args = process.argv.slice(2);
let outFile = '/tmp/discord-retry.json';
const outIdx = args.indexOf('--out');
if (outIdx !== -1) {
  outFile = args[outIdx + 1];
  args.splice(outIdx, 2);
}
const targetIndices = args.map(Number).filter(n => !isNaN(n));

const digest = JSON.parse(readFileSync(DIGEST_FILE, 'utf8'));
const messages = digest.messages ?? [];

function splitMessage(msg) {
  if (msg.length <= MAX_LEN) return [msg];

  const chunks = [];
  // Split at event boundaries: "\n\n**" marks the start of each event
  const parts = msg.split(/(?=\n\n\*\*)/);

  let current = '';
  let isFirstChunk = true;

  for (const part of parts) {
    const candidate = current + part;
    if (candidate.length <= MAX_LEN) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      // Start a continuation chunk
      if (!isFirstChunk) {
        current = '(continued)' + part;
      } else {
        current = part;
      }
    }
    isFirstChunk = false;
  }
  if (current) chunks.push(current);
  return chunks;
}

const indicesToSplit = targetIndices.length > 0
  ? targetIndices
  : messages.map((m, i) => m.length > MAX_LEN ? i : -1).filter(i => i >= 0);

if (indicesToSplit.length === 0) {
  console.log('No oversized messages found.');
  process.exit(0);
}

const retryMessages = [];
for (const idx of indicesToSplit) {
  const msg = messages[idx];
  if (!msg) {
    console.warn(`Index ${idx} out of range, skipping`);
    continue;
  }
  console.log(`Message ${idx + 1}: ${msg.length} chars → splitting...`);
  const chunks = splitMessage(msg);
  console.log(`  Split into ${chunks.length} chunks: ${chunks.map(c => c.length + ' chars').join(', ')}`);
  retryMessages.push(...chunks);
}

const retryDigest = {
  total_events: digest.total_events,
  instance_ids: digest.instance_ids,
  messages: retryMessages,
};

writeFileSync(outFile, JSON.stringify(retryDigest, null, 2));
console.log(`Written ${retryMessages.length} messages to ${outFile}`);
