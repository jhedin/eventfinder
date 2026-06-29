#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const MAX_LEN = 1950;
const digest = JSON.parse(readFileSync('/tmp/discord-digest.json', 'utf8'));

const newMessages = [];
for (const msg of digest.messages) {
  if (msg.length <= MAX_LEN) {
    newMessages.push(msg);
    continue;
  }
  // Split at event boundaries (double newline before **)
  const parts = msg.split(/\n(?=\*\*)/);
  let current = '';
  for (const part of parts) {
    const sep = current ? '\n' : '';
    if ((current + sep + part).length > MAX_LEN) {
      if (current) newMessages.push(current.trim());
      current = part;
    } else {
      current += sep + part;
    }
  }
  if (current.trim()) newMessages.push(current.trim());
}

digest.messages = newMessages;
writeFileSync('/tmp/discord-digest.json', JSON.stringify(digest, null, 2));
console.log(`Split into ${newMessages.length} messages`);
newMessages.forEach((m, i) => console.log(`  msg ${i + 1}: ${m.length} chars`));
