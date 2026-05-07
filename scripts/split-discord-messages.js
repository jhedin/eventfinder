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
  const parts = msg.split('\n\n');
  let current = '';
  for (const part of parts) {
    const sep = current ? '\n\n' : '';
    if ((current + sep + part).length > MAX_LEN) {
      if (current) newMessages.push(current);
      current = part;
    } else {
      current += sep + part;
    }
  }
  if (current) newMessages.push(current);
}

digest.messages = newMessages;
writeFileSync('/tmp/discord-digest.json', JSON.stringify(digest, null, 2));
console.log(`Split into ${newMessages.length} messages`);
newMessages.forEach((m, i) => console.log(`  msg ${i}: ${m.length} chars`));
