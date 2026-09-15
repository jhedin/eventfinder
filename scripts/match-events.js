#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Read the events from the database output file
const eventsData = JSON.parse(fs.readFileSync('/root/.claude/projects/-home-user-eventfinder/9532b202-1f0f-58ab-aa4e-b4387806c6fc/tool-results/bnq5q83qh.txt', 'utf8'));

// Read user preferences
const preferencesFile = '/home/user/eventfinder/data/user-preferences.md';
const preferencesText = fs.readFileSync(preferencesFile, 'utf8');

// Parse preferences
const musicGenres = ['jazz', 'indie rock', 'indie pop', 'folk', 'blues', 'classical'];
const excludedGenres = ['heavy metal', 'edm', 'electronic dance music', 'top 40', 'pop music', 'country'];
const artistsLiked = ['the national', 'sufjan stevens', 'iron & wine', 'norah jones', 'gregory porter', 'chet baker'];
const craftTopics = ['pottery', 'ceramics', 'printmaking', 'woodworking', 'photography', 'creative writing', 'drawing', 'painting'];
const artsCulture = ['gallery', 'film festival', 'independent cinema', 'theater', 'poetry', 'spoken word', 'book launch', 'author talk', 'documentary'];
const knownVenues = {
  'jazz': ['blue note', 'ironwood', 'king eddy', 'jazzyyc', 'alcove'],
  'music': ['ironwood stage', 'grey eagle', 'commonwealth bar', 'ship & anchor', 'studio bell'],
  'theater': ['pumphouse theatre', 'knox united church', 'macehall'],
  'art': ['contemporary calgary', 'esker foundation', 'cspace', 'alcove centre'],
  'community': ['confluence', 'lougheed house', 'ckua']
};

function evaluateEvent(event) {
  const title = (event.title || '').toLowerCase();
  const description = (event.description || '').toLowerCase();
  const venue = (event.venue || '').toLowerCase();
  const text = `${title} ${description} ${venue}`.toLowerCase();

  // Rule out explicitly excluded events
  if (text.includes('sports') || text.includes('hockey') || text.includes('football') || text.includes('cavalry')) {
    return { status: 'excluded', reason: 'Sports event' };
  }
  if (text.includes('nightclub') || text.includes('rave') || text.includes('dancefloor')) {
    return { status: 'excluded', reason: 'Nightclub event' };
  }
  if (text.includes('religious') || text.includes('church service')) {
    return { status: 'excluded', reason: 'Religious service' };
  }
  if (text.includes('fitness') || text.includes('zumba') || text.includes('yoga') || text.includes('bootcamp')) {
    return { status: 'excluded', reason: 'Fitness class - not interested' };
  }
  if (text.includes('cooking') || text.includes('brunch') || text.includes('pastry')) {
    return { status: 'excluded', reason: 'Cooking/food event' };
  }

  // Check for excluded music genres
  if (text.includes('heavy metal') || text.includes('metal festival')) {
    return { status: 'excluded', reason: 'Heavy metal - explicitly excluded' };
  }
  if (text.includes('edm') || text.includes('electronic dance') || text.includes('dillstradamus') || text.includes('final drop')) {
    return { status: 'excluded', reason: 'EDM/electronic dance music - explicitly excluded' };
  }

  // Music events - positive matches
  if (text.includes('jazz')) {
    return { status: 'pending', reason: 'Jazz event - strong match to music interests' };
  }
  if (text.includes('mike murley')) {
    return { status: 'pending', reason: 'Jazz saxophonist - excellent match' };
  }
  if (text.includes('branford marsalis') || text.includes('john coltrane')) {
    return { status: 'pending', reason: 'Jazz legend tribute - strong match' };
  }
  if (text.includes('folk') || text.includes('singer-songwriter') || text.includes('acoustic')) {
    return { status: 'pending', reason: 'Folk/acoustic music - matches interests' };
  }
  if (text.includes('blues')) {
    return { status: 'pending', reason: 'Blues music - matches interests' };
  }
  if (text.includes('indie') || text.includes('indie rock') || text.includes('indie pop')) {
    return { status: 'pending', reason: 'Indie rock/pop - matches music interests' };
  }

  // Artist-specific matches
  if (text.includes('big thief')) {
    return { status: 'pending', reason: 'Indie folk band - strong match' };
  }
  if (text.includes('iron & wine') || text.includes('iron wine')) {
    return { status: 'pending', reason: 'Folk/indie artist on interest list' };
  }
  if (text.includes('sufjan')) {
    return { status: 'pending', reason: 'Sufjan Stevens on interest list' };
  }
  if (text.includes('lyle lovett')) {
    return { status: 'pending', reason: 'Eclectic artist blending jazz, folk, country - likely match' };
  }
  if (text.includes('norah jones') || text.includes('gregory porter')) {
    return { status: 'pending', reason: 'Vocal jazz artist on interest list' };
  }

  // Classical/orchestral
  if (text.includes('classical') || text.includes('orchestra') || text.includes('symphon')) {
    return { status: 'pending', reason: 'Classical/orchestral music - matches interests' };
  }
  if (text.includes('calgary philharmonic') || text.includes('calgary phil')) {
    return { status: 'pending', reason: 'Calgary Philharmonic - likely match' };
  }

  // Concert hall performances with specific musicians
  if (venue.includes('jack singer concert hall') || venue.includes('jubilee auditorium')) {
    if (text.includes('concert') || text.includes('symphony') || text.includes('piano') || text.includes('strings')) {
      return { status: 'pending', reason: 'Classical/concert venue with music programming' };
    }
  }

  // Theatre - but not musicals unless well-reviewed
  if (text.includes('theater') || text.includes('theatre')) {
    if (text.includes('musical') && !text.includes('play')) {
      return { status: 'excluded', reason: 'Musical theatre - not primary interest' };
    }
    if (text.includes('play') || text.includes('comedy') || text.includes('experimental') || text.includes('pumphouse')) {
      return { status: 'pending', reason: 'Theatre production - matches arts interests' };
    }
  }

  // Craft/Art workshops - strong match
  if (text.includes('workshop') || text.includes('class')) {
    if (text.includes('pottery') || text.includes('ceramic')) {
      return { status: 'pending', reason: 'Pottery workshop - strong match to interests' };
    }
    if (text.includes('knit') || text.includes('crochet') || text.includes('embroidery') || text.includes('felt') || text.includes('weaving')) {
      return { status: 'pending', reason: 'Fiber arts/craft workshop - matches workshop interests' };
    }
    if (text.includes('print') || text.includes('screen print')) {
      return { status: 'pending', reason: 'Printmaking workshop - matches interests' };
    }
    if (text.includes('drawing') || text.includes('painting') || text.includes('art')) {
      return { status: 'pending', reason: 'Art/drawing workshop - matches interests' };
    }
    if (text.includes('photography')) {
      return { status: 'pending', reason: 'Photography workshop - matches interests' };
    }
    if (text.includes('creative writing')) {
      return { status: 'pending', reason: 'Creative writing workshop - matches interests' };
    }
    if (venue.includes('stash lounge')) {
      return { status: 'pending', reason: 'Craft store workshop - likely hands-on class match' };
    }
  }

  // Art galleries and exhibitions
  if (text.includes('gallery') || text.includes('exhibition') || text.includes('art')) {
    if (text.includes('contemporary') || text.includes('artist') || text.includes('installation') || text.includes('visual')) {
      return { status: 'pending', reason: 'Art gallery/exhibition - matches arts interests' };
    }
  }

  // Indigenous art/culture - specific interest
  if (text.includes('indigenous') || text.includes('reconciliation') || text.includes('blackfoot')) {
    return { status: 'pending', reason: 'Indigenous art/culture programming - specific interest' };
  }

  // Film/documentary
  if (text.includes('film') || text.includes('documentary') || text.includes('cinema')) {
    return { status: 'pending', reason: 'Film screening - matches arts interests' };
  }

  // Poetry and spoken word
  if (text.includes('poetry') || text.includes('spoken word') || text.includes('storytelling')) {
    return { status: 'pending', reason: 'Poetry/spoken word event - matches interests' };
  }

  // Photography exhibitions
  if (text.includes('photography') && (text.includes('exhibition') || text.includes('gallery'))) {
    return { status: 'pending', reason: 'Photography exhibition - matches interests' };
  }

  // Book/author events
  if (text.includes('book') || text.includes('author')) {
    return { status: 'pending', reason: 'Book/author event - matches interests' };
  }

  // Specific known musicians/bands with folk/indie sensibility
  if (text.includes('squidjigger') || text.includes('double suede') || text.includes('kimberlites') ||
      text.includes('amber williams') || text.includes('ribeye cap') || text.includes('abbie thurgood') ||
      text.includes('dark folk') || text.includes('celtic')) {
    return { status: 'pending', reason: 'Folk/indie music band - matches interests' };
  }

  // Trivia nights - community events
  if (text.includes('trivia')) {
    return { status: 'pending', reason: 'Trivia night - community gathering event' };
  }

  // Events at known good venues
  if (venue.includes('ironwood')) {
    if (!text.includes('country') || text.includes('folk') || text.includes('jazz') || text.includes('blues')) {
      return { status: 'pending', reason: 'Ironwood Stage venue - known for music variety' };
    }
  }

  // Market/community events
  if (text.includes('market') || text.includes('festival')) {
    if (!text.includes('top 40') && !text.includes('sports')) {
      return { status: 'pending', reason: 'Community market/festival event' };
    }
  }

  // When in doubt, include it (as per user preferences)
  if ((title.length > 3 && !title.includes('closed') && !title.includes('school of rock') && !title.includes('open mic')) ||
      description.length > 20) {
    return { status: 'pending', reason: 'Interesting event - unclear category, including to avoid missing' };
  }

  return { status: 'excluded', reason: 'Insufficient information or generic event' };
}

// Process all events
const decisions = eventsData
  .map(event => {
    const evaluation = evaluateEvent(event);
    return {
      event_id: event.id,
      status: evaluation.status,
      reason: evaluation.reason
    };
  });

// Count results
const pendingCount = decisions.filter(d => d.status === 'pending').length;
const excludedCount = decisions.filter(d => d.status === 'excluded').length;

// Write decisions file
fs.writeFileSync('/tmp/relevance-decisions.json', JSON.stringify(decisions, null, 2));

console.log(`Relevance complete: ${pendingCount} matched, ${excludedCount} excluded. Written to /tmp/relevance-decisions.json`);
