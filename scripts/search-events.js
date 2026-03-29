#!/usr/bin/env node
// Full-text search over the events database using FTS5.
//
// Usage:
//   node scripts/search-events.js <query> [--limit N] [--from YYYY-MM-DD] [--all]
//
// Options:
//   --limit N          Max results (default: 20)
//   --from YYYY-MM-DD  Only show events on or after this date (default: today)
//   --all              Include past events
//   --json             Output raw JSON instead of formatted text
//
// FTS5 query syntax:
//   jazz               Match "jazz" (porter-stemmed: matches "jazzy" too)
//   jazz blues         Implicit AND: both terms must appear
//   "big band"         Phrase match
//   jazz OR blues      Either term
//   jazz NOT metal     jazz without metal
//   wood*              Prefix match: woodturning, woodcarving, etc.
//
// Examples:
//   node scripts/search-events.js jazz
//   node scripts/search-events.js "cat power"
//   node scripts/search-events.js "wood*" --limit 10
//   node scripts/search-events.js blues --from 2026-05-01

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

// --- Parse args ---
const args = process.argv.slice(2);
const flagIdx = args.findIndex(a => a.startsWith('--'));
const queryParts = flagIdx === -1 ? args : args.slice(0, flagIdx);
const flags = flagIdx === -1 ? [] : args.slice(flagIdx);

if (queryParts.length === 0) {
  console.error('Usage: node scripts/search-events.js <query> [--limit N] [--from YYYY-MM-DD] [--all] [--json]');
  process.exit(1);
}

const query = queryParts.join(' ');
const limitIdx = flags.indexOf('--limit');
const fromIdx = flags.indexOf('--from');
const limit = limitIdx !== -1 ? parseInt(flags[limitIdx + 1], 10) : 20;
const fromDate = fromIdx !== -1 ? flags[fromIdx + 1] : new Date().toISOString().slice(0, 10);
const includeAll = flags.includes('--all');
const jsonOutput = flags.includes('--json');

// --- Query ---
const db = new Database(DB_PATH, { readonly: true });

let results;
try {
  // Step 1: FTS match — get ranked IDs (auxiliary functions only work in direct FTS queries)
  const matches = db.prepare(`
    SELECT rowid AS event_id, rank
    FROM events_fts
    WHERE events_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit * 3); // over-fetch to allow date filtering

  if (matches.length === 0) {
    results = [];
  } else {
    // Step 2: Fetch full event details for matched IDs, filtering by date
    const ids = matches.map(m => m.event_id);
    const rankMap = Object.fromEntries(matches.map(m => [m.event_id, m.rank]));
    const placeholders = ids.map(() => '?').join(',');
    const dateFilter = includeAll ? '' : `AND ei.instance_date >= '${fromDate}'`;

    const rows = db.prepare(`
      SELECT
        e.id,
        e.title,
        e.venue,
        e.price,
        e.event_url,
        e.ticket_url,
        MIN(ei.instance_date) AS next_date,
        MIN(ei.instance_time) AS next_time,
        ei.end_date,
        COUNT(DISTINCT ei.id) AS instance_count,
        MAX(se.status) AS sent_status
      FROM events e
      JOIN event_instances ei ON ei.event_id = e.id
      LEFT JOIN sent_events se ON se.event_id = e.id
      WHERE e.id IN (${placeholders})
        ${dateFilter}
      GROUP BY e.id
    `).all(...ids);

    // Re-apply rank order and apply limit
    results = rows
      .sort((a, b) => (rankMap[a.id] ?? 0) - (rankMap[b.id] ?? 0))
      .slice(0, limit);
  }
} catch (err) {
  if (err.message.includes('fts5: syntax error')) {
    console.error(`Invalid FTS5 query syntax: "${query}"\nTip: Use * for prefix match, "quotes" for phrases, OR/NOT for logic`);
    process.exit(1);
  }
  throw err;
} finally {
  db.close();
}

// --- Output ---
if (jsonOutput) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

if (results.length === 0) {
  console.log(`No upcoming events found for: "${query}"`);
  process.exit(0);
}

function fmtDate(dateStr, timeStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const ds = d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!timeStr) return ds;
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${ds} at ${h12}:${m} ${ampm}`;
}

console.log(`🔍 "${query}" — ${results.length} result${results.length !== 1 ? 's' : ''}\n`);
for (const r of results) {
  const dateStr = r.end_date && r.end_date !== r.next_date
    ? `${fmtDate(r.next_date)} – ${fmtDate(r.end_date)}`
    : fmtDate(r.next_date, r.next_time);
  const multi = r.instance_count > 1 ? ` (${r.instance_count} dates)` : '';
  const price = r.price ? ` · ${r.price}` : '';
  const status = r.sent_status === 'sent' ? ' ✓sent' : r.sent_status === 'pending' ? ' 🔔pending' : '';
  const url = r.event_url || r.ticket_url || '';

  console.log(`**${r.title}**`);
  console.log(`${dateStr}${multi} · ${r.venue || 'Venue TBD'}${price}${status}`);
  if (url) console.log(url);
  console.log();
}
