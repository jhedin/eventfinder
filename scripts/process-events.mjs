#!/usr/bin/env node
/**
 * Process scraped events: deduplicate, evaluate relevance, insert into DB.
 * Usage: node scripts/process-events.mjs <events_json_file>
 */

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function computeHash(title, venue) {
  const combined = normalize(title) + normalize(venue);
  return createHash('sha256').update(combined).digest('hex');
}

function evaluateRelevance(title, venue, description, sourceUrl) {
  const t = [title, venue, description, sourceUrl].join(' ').toLowerCase();

  // Hard exclusions
  const exclusions = [
    ['sports', ['hockey', 'flames', 'stampeders', 'football', 'baseball', 'soccer']],
    ['nightclub_edm', ['edm night', 'dj night', 'rave', 'electronic dance', 'house music', 'techno night', 'nora en pure', 'sick individuals', 'kolsch haus']],
    ['country', ['country music', 'country night', 'country dance', 'whiskey rose saloon']],
    ['fitness', ['fitness class', 'boot camp', 'yoga class', 'crossfit', 'workout class']],
    ['corporate', ['networking mixer', 'business mixer', 'professional development', 'chamber of commerce', 'pwhl takeover', 'pre-game']],
    ['heavy_metal', ['heavy metal', 'death metal', 'black metal', 'slaughter', 'methedrone', 'banzai', 'languid', 'hazzerd', 'alestorm', 'dayseeker', 'coheed and cambria']],
    ['game_show', ['price is right', 'game show']],
    ['trivia', ['trivia night', 'pub quiz', 'quiz night', 'radio retro trivia', 'this is the quiz']],
    ['graduation', ['graduation', 'convocation', 'heritage college graduation']],
    ['beer_event', ['sundaze', 'kolsch haus', 'hazy sundaze', 'beer pairing', 'brisket', 'flies & foam', 'fly shop', 'builders and brews', 'growler launch']],
    ['comedy_show', ['stand-up', 'stand up comedian', 'comedy tour', 'sooshi mango', 'josh johnson', 'michael blaustein', 'jonathan van ness', 'blaustein']],
    ['pop_artists', ['yelawolf', 'that mexican ot', 'farhan saeed', 'asim azhar', 'harkirat sangha']],
    ['sporties', ['sporties.yyc', 'pwhl']],
    ['wax_poetic', ['wax poetic']],
    ['cjsw_film', ['cjsw film night']],  // beer & film at brewery
  ];

  for (const [reason, keywords] of exclusions) {
    for (const kw of keywords) {
      if (t.includes(kw)) {
        return { matches: false, reason: `Excluded: '${kw}' (${reason})` };
      }
    }
  }

  // Positive matches
  const positives = [
    ['jazz', ['jazz', 'big band', 'bebop', 'swing band', 'kawa jam', 'jazzyyc', 'candlelight jazz', 'malissa rush', 'mitchell prentice', 'jonny chavez quartet', 'jazz night', 'live jazz', 'midnight blue jazz', 'blue moon marquee']],
    ['blues', ['blues', 'bluesfest', 'blue mules', 'tom phillips', 'jc smith band', 'shawn kellerman', 'du-rite', 'lovebullies', 'kenny blues', 'donald ray johnson', 'paul kype', 'texas flood', 'mojo philter', 'black cherry perry', 'wine soaked preachers', 'mark sadlier', 'shamelful hussies', 'shayes lounge', 'greg albright', 'dwayne dueck', 'steve pineo', 'ralph boyd', 'elliot lorne', 'raoul bhaneja', 'ray charles tribute']],
    ['folk', ['folk', 'singer-songwriter', 'songwriter', 'songsmith', 'acoustic afternoon', 'folk fest', 'jenn grant', 'kim churchill', 'city and colour', 'bros. landreth', 'whitehorse', 'bahamas', 'open mic', 'yyc songwriter', 'voices of canada', 'folk music awards', 'iron & wine']],
    ['indie_rock', ['indie', 'alternative', 'wolf parade', 'barr brothers', 'sunglaciers', 'the fray', 'album release', 'the national', 'sufjan', 'cadence', 'run the plank', 'garret t. willie', 'local menace']],
    ['roots_americana', ['roots', 'americana', 'd.b. cooper', 'saint whiskey', 'jade elephant', 'ashley garrett', 'eric kane', 'roman clarke', 'cassie and maggie', 'paul woida', 'sammy volkov', 'happy hour with', 'acoustic afternoon', 'carter felker', 'melyssa lee', 'mandi leigh', 'karac hendriks', 'michela sheedy', 'stark sky', 'ninth avenue band', 'sliding stones', 'reed alton', 'jon burden', 'ross fizzard', 'big d', 'corleones', 'brett cassidy', 'earl morgan', 'redhead mack', 'matt beatty', 'joey pringle', 'jim baxter', 'everlae', 'smoking aces', 'fonzie scheme', 'eclipse acoustic', 'jamie allanach', 'toni ver', 'klave latin']],
    ['classical_opera', ['orchestra', 'philharmonic', 'opera', 'ballet', 'chamber music', 'barber of seville', 'notre dame de paris', 'video games in concert', 'star wars in concert']],
    ['theatre', ['theatre', 'theater', 'wildwoman', 'stardust: a diamond heist', 'mamma mia', 'cabaret']],
    ['arts_culture', ['gallery', 'exhibition', 'art show', 'opening night', 'documentary', 'film festival', 'poetry', 'spoken word', 'book launch', 'author talk', 'mapping history', 'queer history artist', 'indigenous art', 'celebration for the arts', 'beltline gay history', 'orff the wall', 'better together', 'carifest', 'steel pan']],
    ['studio_bell', ['nmc tours', 'national music centre', 'studio bell', 'nmc presents', 'nmc &', 'heartstrings and honky tonks', 'nmc and canadian folk', 'gateway events, nmc', 'candlelight: tribute']],
    ['indigenous', ['moonstone creation', 'moccasin', 'beadwork', 'talking stick', 'quillwork', 'medicine wheel', 'indigenous', 'cree elder']],
    ['craft_workshop', ['pottery', 'ceramics', 'printmaking', 'woodworking', 'stained glass', 'felt wall art', 'matchbook art', 'collage art', 'photography workshop', 'darkroom', 'creative writing workshop', 'drawing class', 'painting class', 'worn studio', 'workshop studios']],
    ['textile_arts', ['knit', 'weave', 'cross stitch', 'brioche', 'macrame', 'embroidery', 'fibre arts', 'crochet']],
    ['songwriter_event', ['songwriter showdown']],
    ['lougheed', ['lougheed house', 'afternoon tea', 'heritage house', 'lougheed']],
    ['folk_venue', ['festival hall']],
    ['swing_dance', ['swing into spring', 'wnbb']],
    ['latin_music', ['klave latin band']],
    ['sheldon_zandboer', ['sheldon zandboer']],  // jazz/roots musician
    ['redline_trio', ['redline trio']],  // jazz trio
    ['chinook_music', ['chinook school of music']],  // music school performances - interesting
  ];

  for (const [reason, keywords] of positives) {
    for (const kw of keywords) {
      if (t.includes(kw)) {
        return { matches: true, reason: `Matches interest: ${reason} ('${kw}')` };
      }
    }
  }

  return { matches: false, reason: 'No match to user interests' };
}

// Load events
const eventsFile = process.argv[2];
if (!eventsFile) {
  console.error('Usage: node scripts/process-events.mjs <events_json_file>');
  process.exit(1);
}

const allSources = JSON.parse(readFileSync(eventsFile, 'utf8'));

// Open DB
const db = new Database(DB_PATH);

// Get existing hashes
const existingHashes = new Set(
  db.prepare('SELECT event_hash FROM events').all().map(r => r.event_hash)
);
console.error(`Existing events in DB: ${existingHashes.size}`);

// Prepare statements
const insertEvent = db.prepare(`
  INSERT INTO events (event_hash, title, venue, description, price, event_url, ticket_url, source_id, source_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertInstance = db.prepare(`
  INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone, ticket_sale_date, ticket_sale_time)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertSentStatus = db.prepare(`
  INSERT INTO sent_events (event_id, instance_id, status, reason)
  VALUES (?, ?, ?, ?)
`);

const getInstances = db.prepare('SELECT id FROM event_instances WHERE event_id = ?');

// Process all events in a transaction
const processAll = db.transaction(() => {
  const stats = {
    total_raw: 0,
    duplicates_skipped: 0,
    new_events: 0,
    matched: 0,
    excluded: 0,
    errors: 0,
  };

  const newMatchedEvents = [];

  for (const sourceResult of allSources) {
    const sourceId = sourceResult.source_id;
    const sourceUrl = sourceResult.source_url || '';
    const events = sourceResult.events || [];

    for (const event of events) {
      stats.total_raw++;
      const title = event.title || '';
      const venue = event.venue || '';

      const eventHash = computeHash(title, venue);

      if (existingHashes.has(eventHash)) {
        stats.duplicates_skipped++;
        continue;
      }
      existingHashes.add(eventHash);

      const { matches, reason } = evaluateRelevance(
        title, venue, event.description || '', sourceUrl
      );

      try {
        const result = insertEvent.run(
          eventHash,
          title,
          venue,
          event.description || '',
          event.price || '',
          event.event_url || '',
          event.ticket_url || '',
          sourceId,
          sourceUrl
        );

        const eventId = result.lastInsertRowid;
        stats.new_events++;

        const instanceIds = [];
        for (const inst of event.instances || []) {
          const instResult = insertInstance.run(
            eventId,
            inst.date || '',
            inst.time ?? null,
            inst.end_date ?? null,
            'America/Edmonton',
            inst.ticket_sale_date ?? null,
            inst.ticket_sale_time ?? null
          );
          instanceIds.push(instResult.lastInsertRowid);
        }

        // Mark relevance for all instances
        const status = matches ? 'pending' : 'excluded';
        for (const instanceId of instanceIds) {
          insertSentStatus.run(eventId, instanceId, status, reason);
        }

        if (matches) {
          stats.matched++;
          newMatchedEvents.push({
            title,
            venue,
            price: event.price || '',
            event_url: event.event_url || '',
            ticket_url: event.ticket_url || '',
            instances: event.instances || [],
            reason,
            event_id: Number(eventId),
            instance_ids: instanceIds.map(Number),
          });
          console.error(`  ✓ MATCH: ${title} @ ${venue} — ${reason}`);
        } else {
          stats.excluded++;
          // Uncomment for debugging:
          // console.error(`  ✗ SKIP: ${title} — ${reason}`);
        }

      } catch (err) {
        stats.errors++;
        console.error(`  ERROR inserting "${title}": ${err.message}`);
      }
    }
  }

  return { stats, newMatchedEvents };
});

const { stats, newMatchedEvents } = processAll();

console.log(JSON.stringify({ stats, newMatchedEvents }, null, 2));
