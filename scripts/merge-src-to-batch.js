#!/usr/bin/env node
// Merges all /tmp/eventfinder-src-*.json files into a single /tmp/eventfinder-batch-merged.json
// This bridges the gap between subagent per-source output and import-batch-results.js expectations.

import { readdirSync, readFileSync, writeFileSync } from 'fs';

const TMP_DIR = '/tmp';
const SRC_PATTERN = /^eventfinder-src-\d+\.json$/;

const srcFiles = readdirSync(TMP_DIR)
  .filter(f => SRC_PATTERN.test(f))
  .map(f => `${TMP_DIR}/${f}`)
  .sort();

if (srcFiles.length === 0) {
  console.error('No eventfinder-src-*.json files found in /tmp');
  process.exit(1);
}

const allResults = [];
for (const filePath of srcFiles) {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    for (const result of (data.results || [])) {
      allResults.push(result);
    }
  } catch (err) {
    console.error(`Failed to parse ${filePath}: ${err.message}`);
  }
}

const output = { results: allResults };
const outPath = `${TMP_DIR}/eventfinder-batch-merged.json`;
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Merged ${srcFiles.length} files (${allResults.length} sources) → ${outPath}`);
