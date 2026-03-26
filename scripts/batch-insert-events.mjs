#!/usr/bin/env node
// Batch event insertion with deduplication and relevance matching.
// Reads events from stdin as JSON, deduplicates against DB, inserts new ones.

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');
const db = new Database(DB_PATH);

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '') // remove punctuation/spaces
    .trim();
}

function eventHash(title, venue) {
  const key = normalize(title) + normalize(venue);
  return createHash('sha256').update(key).digest('hex');
}

// All events from all batches - read from file path argument
import { readFileSync } from 'fs';
const allResults = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const stmtCheckHash = db.prepare('SELECT id FROM events WHERE event_hash = ?');
const stmtCheckFuzzy = db.prepare(`
  SELECT e.id, e.title, e.venue FROM events e
  JOIN event_instances ei ON e.id = ei.event_id
  WHERE e.venue LIKE ? AND ei.instance_date BETWEEN ? AND ?
  LIMIT 5
`);
const stmtInsertEvent = db.prepare(`
  INSERT INTO events (event_hash, title, venue, description, price, event_url, ticket_url, source_id, source_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtInsertInstance = db.prepare(`
  INSERT INTO event_instances (event_id, instance_date, instance_time, end_date, timezone, ticket_sale_date, ticket_sale_time)
  VALUES (?, ?, ?, ?, 'America/Edmonton', ?, ?)
`);
const stmtInsertSentEvent = db.prepare(`
  INSERT INTO sent_events (event_id, instance_id, status, reason)
  SELECT ?, id, ?, ? FROM event_instances WHERE event_id = ?
`);

let newEvents = 0;
let duplicatesSkipped = 0;
let matched = 0;
let excluded = 0;
const insertedDetails = [];

// Relevance matching based on user preferences
function matchesPreferences(title, venue, description, sourceDesc) {
  const t = (title || '').toLowerCase();
  const v = (venue || '').toLowerCase();
  const d = (description || '').toLowerCase();
  const s = (sourceDesc || '').toLowerCase();
  const all = t + ' ' + v + ' ' + d;

  // HARD EXCLUDES
  const hardExcludes = [
    /heavy metal/i, /\bedm\b/i, /electronic dance/i, /nightclub/i,
    /hockey/i, /football/i, /\bnfl\b/i, /\bnhl\b/i, /flames game/i,
    /corporate.*network/i, /networking.*mixer/i, /fitness/i, /boot camp/i,
    /religious/i, /gospel/i, /christian.*award/i, /selah.*award/i,
    /\bcountry music\b/i,
    // Metal bands from context
    /napalm death/i, /archspire/i, /extensive slaughter/i, /vomit stomp/i,
    /methedrone/i, /languid.*apprehension/i, /alestorm/i,
    /fit for a king/i, /chiodos/i, /\bwasp\b.*headless/i,
    /\bkids\b.*rave/i, /toddler.*rave/i, /toddler.*techno/i,
    // EDM
    /sick individuals/i, /last heroes.*edm/i, /wilkinson.*edm/i,
    /nora en pure/i, /borgeous/i, /dion timmer/i, /spag heddy/i,
    /yookie/i, /avello/i, /sodown/i, /ownboss/i, /effin.*palace/i,
    /parra for cuva/i,
    // Sports
    /stick it to cancer.*hockey/i, /saddledome/i, /home away.*dome/i,
    /cgy vs /i, /euchre tournament/i,
    // Food/cooking
    /beer.*cheese.*pairing/i, /matcha workshop/i, /cooking class/i,
    // Game show / TV
    /price is right/i,
    // Not music types user likes
    /\btop 40\b/i, /pop brunch/i,
    // Corporate/grad
    /graduation 2026/i, /heritage college grad/i, /corporate/i,
    // Country
    /\bnashville nights\b/i, /whiskey rose.*saloon/i,
    /honky.?tonk tuesday/i, /kölsch haus/i, /sundaze.*$6 pint/i,
    /radio retro trivia/i,
    // Musicals
    /mamma mia/i, /beauty and the beast.*musical/i, /mrs.*doubtfire.*musical/i,
    /hamilton.*musical/i, /\bjuliet\b.*musical/i, /movicals/i,
  ];

  for (const re of hardExcludes) {
    if (re.test(all)) {
      return { matches: false, reason: `Excluded: matches "${re.source}"` };
    }
  }

  // Venue-based excludes
  if (/whiskey rose saloon/i.test(v)) {
    return { matches: false, reason: 'Excluded: Whiskey Rose Saloon is a country music venue' };
  }
  if (/commonwealth.*yyc/i.test(v)) {
    return { matches: false, reason: 'Excluded: Commonwealth YYC is a nightclub' };
  }

  // STRONG MATCHES - music
  if (/jazz/i.test(all)) return { matches: true, reason: 'Jazz music — user loves jazz' };
  if (/blues can/i.test(v)) return { matches: true, reason: 'The Blues Can is a dedicated blues venue' };
  if (/\bblues\b/i.test(all) && !/news/i.test(all)) return { matches: true, reason: 'Blues music — user loves blues' };
  if (/folk/i.test(all) && !/folklore/i.test(all)) return { matches: true, reason: 'Folk music — user loves folk' };
  if (/indie rock|indie pop|indie folk|indie.*music/i.test(all)) return { matches: true, reason: 'Indie music — user loves indie rock/pop/folk' };
  if (/classical|orchestra|philharmonic|symphony|opera|ballet/i.test(all)) return { matches: true, reason: 'Classical/orchestral music or ballet — user interested' };
  if (/candlelight/i.test(all)) return { matches: true, reason: 'Candlelight concert series — intimate music format user enjoys' };
  if (/singer.?songwriter|acoustic/i.test(all)) return { matches: true, reason: 'Singer-songwriter/acoustic — matches folk interest' };

  // Specific artists user likes
  const likedArtists = [
    'the national', 'sufjan stevens', 'iron & wine', 'norah jones',
    'gregory porter', 'chet baker', 'ray charles', 'bonnie raitt',
    'city and colour', 'metric', 'broken social scene', 'stars',
    'wolf parade', 'wintersleep', 'bahamas', 'caamp', 'big thief',
    'cat power', 'the barr brothers', 'arkells', 'black country new road',
    'john butler', 'thee sacred souls', 'joyce manor',
    'sunglaciers', 'blue mules', 'wailers', 'creedence',
    'leonard cohen', 'joni mitchell', 'the fray', 'sexsmith', 'lightfoot',
    'blue moon marquee',
  ];
  for (const artist of likedArtists) {
    if (all.includes(artist)) return { matches: true, reason: `Features or relates to ${artist} — artist user enjoys` };
  }

  // Arts & culture
  if (/gallery|exhibition|opening.*art|art.*opening/i.test(all)) return { matches: true, reason: 'Gallery/art opening — user interested in contemporary art' };
  if (/documentary|film festival|independent cinema|indie.*film/i.test(all)) return { matches: true, reason: 'Documentary or independent film — user interested' };
  if (/indigenous.*art|indigenous.*culture|beadwork|moccasin|quillwork|talking stick|medicine wheel|story robe/i.test(all)) return { matches: true, reason: 'Indigenous art/culture — user specifically interested' };
  if (/poetry|spoken word/i.test(all)) return { matches: true, reason: 'Poetry/spoken word — user interested' };
  if (/book launch|author talk|literary/i.test(all)) return { matches: true, reason: 'Book launch or literary event — user interested' };
  if (/sideways.*documentary|documentary.*screening/i.test(all)) return { matches: true, reason: 'Documentary screening — user interested in documentary film' };

  // Theater (not musicals)
  if (/\btheatre\b|\btheater\b|\bplay\b/i.test(all) && !/musical/i.test(all) && !/graduation/i.test(all)) {
    return { matches: true, reason: 'Theater/play — user enjoys theater (not musicals)' };
  }

  // Workshops user wants
  if (/woodwork|woodturning|wood carv|woodworking|lathe|turning.*chisel|skew chisel|coffee table.*workshop|chair.*build/i.test(all)) {
    return { matches: true, reason: 'Woodworking workshop — user explicitly wants to learn woodworking' };
  }
  if (/pottery|ceramic/i.test(all)) return { matches: true, reason: 'Pottery/ceramics — user interested in pottery workshops' };
  if (/printmaking|linocut|screen print/i.test(all)) return { matches: true, reason: 'Printmaking — user interested' };
  if (/photography|darkroom/i.test(all)) return { matches: true, reason: 'Photography workshop — user interested' };
  if (/creative writing/i.test(all)) return { matches: true, reason: 'Creative writing workshop — user interested' };
  if (/drawing|painting.*class|art.*class|life drawing/i.test(all)) return { matches: true, reason: 'Drawing/painting class — user interested' };
  if (/steel pan.*workshop|carifest/i.test(all)) return { matches: true, reason: 'Steel pan music workshop — hands-on music learning' };
  if (/natural.*dy|dyeing/i.test(all)) return { matches: true, reason: 'Natural dye workshop — textile/craft arts' };
  if (/matchbook.*art/i.test(all)) return { matches: true, reason: 'Matchbook art workshop — visual arts craft at Worn Studio' };
  if (/tapestry.*weav|weaving/i.test(all)) return { matches: true, reason: 'Weaving/tapestry — textile arts craft' };

  // History/culture talks (author-talk adjacent)
  if (/lougheed house/i.test(v)) return { matches: true, reason: 'Lougheed House cultural event — heritage/arts programming' };

  // Live music at breweries/bars that aren't hard excluded
  if (/live.*music/i.test(all) && !/country/i.test(all)) {
    return { matches: true, reason: 'Live music event matching general interest' };
  }

  // Concert/music events without genre info - include per "when in doubt include"
  if (/album release|concert|live performance/i.test(all) && !/metal/i.test(all) && !/country/i.test(all)) {
    return { matches: true, reason: 'Music concert/album release — included per "when in doubt, include" preference' };
  }

  // Arts workshops broadly
  if (/workshop/i.test(all) && !/cooking/i.test(all) && !/fitness/i.test(all) && !/business/i.test(all) && !/professional.*dev/i.test(all) && !/beer/i.test(all) && !/cheese/i.test(all) && !/matcha/i.test(all)) {
    return { matches: true, reason: 'Creative workshop — user interested in hands-on learning' };
  }

  return { matches: false, reason: 'Does not match user interests (no jazz/folk/indie/blues/classical/arts/workshops)' };
}

const insertTx = db.transaction(() => {
  for (const sourceResult of allResults) {
    if (!sourceResult.success || !sourceResult.events || sourceResult.events.length === 0) continue;

    const sourceId = sourceResult.source_id;
    const sourceUrl = sourceResult.source_url;

    for (const event of sourceResult.events) {
      const hash = eventHash(event.title, event.venue);

      // Check exact duplicate
      const existing = stmtCheckHash.get(hash);
      if (existing) {
        duplicatesSkipped++;
        continue;
      }

      // Fuzzy check skipped for efficiency since we trust the hash
      // (titles/venues are specific enough)

      // Insert event
      const result = stmtInsertEvent.run(
        hash,
        event.title || '',
        event.venue || '',
        event.description || '',
        event.price || '',
        event.event_url || '',
        event.ticket_url || '',
        sourceId,
        sourceUrl
      );
      const eventId = result.lastInsertRowid;

      // Insert instances
      for (const inst of (event.instances || [])) {
        stmtInsertInstance.run(
          eventId,
          inst.date,
          inst.time || null,
          inst.end_date || null,
          inst.ticket_sale_date || null,
          inst.ticket_sale_time || null
        );
      }

      // Match to preferences
      const { matches, reason } = matchesPreferences(event.title, event.venue, event.description, '');
      const status = matches ? 'pending' : 'excluded';

      stmtInsertSentEvent.run(eventId, status, reason, eventId);

      newEvents++;
      if (matches) {
        matched++;
        insertedDetails.push({ title: event.title, venue: event.venue, date: event.instances?.[0]?.date, status: 'pending', reason });
      } else {
        excluded++;
        insertedDetails.push({ title: event.title, venue: event.venue, date: event.instances?.[0]?.date, status: 'excluded', reason });
      }
    }
  }
});

insertTx();

console.log(JSON.stringify({
  newEvents,
  duplicatesSkipped,
  matched,
  excluded,
  insertedDetails
}, null, 2));

db.close();
