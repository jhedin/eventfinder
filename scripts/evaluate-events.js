#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read events from stdin
let eventsData = '';
process.stdin.on('data', chunk => {
  eventsData += chunk;
});

process.stdin.on('end', () => {
  try {
    const events = JSON.parse(eventsData);
    const preferences = fs.readFileSync(path.join(__dirname, '../data/user-preferences.md'), 'utf-8');

    const decisions = events.map(event => {
      const decision = evaluateEvent(event, preferences);
      return decision;
    });

    console.log(JSON.stringify(decisions, null, 2));
  } catch (err) {
    console.error('Error processing events:', err.message);
    process.exit(1);
  }
});

function evaluateEvent(event, preferences) {
  const { id, title, venue, description, price } = event;
  const text = `${title} ${venue || ''} ${description || ''}`.toLowerCase();

  // Quick checks for excluded categories
  const excludedKeywords = [
    'sports', 'hockey', 'football', 'basketball', 'soccer', 'baseball',
    'trivia night', 'fitness', 'zumba', 'boot camp', 'nightclub',
    'edm', 'electronic dance', 'top 40', 'heavy metal', 'metal festival',
    'corporate', 'networking', 'business', 'religious', 'church',
    'knit', 'crochet', 'spinning', 'weaving', 'embroidery', 'sewing',
    'cooking class', 'cook',
    'country music', 'country soul'
  ];

  for (const keyword of excludedKeywords) {
    if (text.includes(keyword)) {
      return {
        event_id: id,
        status: 'excluded',
        reason: `Excluded category: ${keyword}`
      };
    }
  }

  // Included categories
  const includedKeywords = [
    // Jazz
    { keywords: ['jazz', 'bebop', 'vocal jazz'], category: 'Jazz interest' },
    // Indie/folk
    { keywords: ['indie', 'folk', 'singer-songwriter', 'acoustic'], category: 'Indie/folk interest' },
    // Blues
    { keywords: ['blues', 'blues club'], category: 'Blues interest' },
    // Classical
    { keywords: ['classical', 'symphony', 'orchestra', 'philharmonic', 'chamber'], category: 'Classical interest' },
    // Arts & culture
    { keywords: ['gallery', 'art', 'exhibition', 'photography', 'film', 'theatre', 'theater', 'play', 'poetry', 'spoken word', 'book', 'author', 'documentary'], category: 'Arts & culture interest' },
    // Workshops
    { keywords: ['pottery', 'ceramic', 'printmaking', 'woodworking', 'workshop', 'class'], category: 'Workshop interest' },
    // Indigenous culture
    { keywords: ['indigenous', 'first nations', 'blackfoot', 'métis', 'aboriginal'], category: 'Indigenous culture interest' },
    // Specific artists (user love)
    { keywords: ['the national', 'sufjan stevens', 'iron & wine', 'norah jones', 'gregory porter', 'chet baker'], category: 'Specific artist interest' },
    // Known good venues
    { keywords: ['blue note', 'ironwood', 'king eddy', 'jazz club'], category: 'Favorite venue' },
  ];

  for (const match of includedKeywords) {
    for (const keyword of match.keywords) {
      if (text.includes(keyword)) {
        return {
          event_id: id,
          status: 'pending',
          reason: `${match.category}: ${title}`
        };
      }
    }
  }

  // Special handling for ambiguous events
  // If venue is a known music venue or cultural space, be inclusive
  if (venue) {
    const venueKeywords = ['stage', 'concert', 'theatre', 'gallery', 'studio', 'hall', 'auditorium', 'club', 'bar', 'cafe', 'coffee'];
    if (venueKeywords.some(v => venue.toLowerCase().includes(v))) {
      // If it's a performance/cultural venue and NOT explicitly excluded, include it
      return {
        event_id: id,
        status: 'pending',
        reason: `Cultural venue: ${venue}`
      };
    }
  }

  // If we have no description at all, and it's not clearly excluded, mark as pending
  if (!description || description.trim().length < 10) {
    if (!title.match(/free|closing|party|event|night/i)) {
      return {
        event_id: id,
        status: 'pending',
        reason: `Limited information available for: ${title}`
      };
    }
  }

  // Default to excluded for unclear events
  return {
    event_id: id,
    status: 'excluded',
    reason: `No clear match to user interests for: ${title}`
  };
}
