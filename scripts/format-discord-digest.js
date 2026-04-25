#!/usr/bin/env node

import fs from 'fs';

// Read events data from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const events = JSON.parse(input);
    const digest = formatDiscordDigest(events);
    fs.writeFileSync('/tmp/discord-digest.json', JSON.stringify(digest, null, 2));
    console.log(`Digest formatted: ${digest.total_events} events, ${digest.messages.length} messages. Written to /tmp/discord-digest.json`);
  } catch (err) {
    console.error('Error formatting digest:', err.message);
    process.exit(1);
  }
});

function formatDiscordDigest(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      total_events: 0,
      instance_ids: [],
      messages: ["🗓️ **EventFinder Digest** — No new events · April 19, 2026"]
    };
  }

  const instanceIds = events.map(e => e.instance_id);
  const categorized = categorizeEvents(events);

  const messages = [];

  // Header with current date
  const today = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  messages.push(`🗓️ **EventFinder Digest** — ${events.length} new events · ${dateStr}`);

  // Categories in order
  const categoryOrder = ['🎵 Music', '🎨 Arts & Culture', '🛠️ Workshops', '📅 Other'];
  for (const categoryLabel of categoryOrder) {
    const category = categoryLabel.split(' ')[1];
    if (!categorized[category] || categorized[category].length === 0) continue;

    const catEvents = categorized[category];
    const categoryMessages = [];
    const categoryHeader = `${categoryLabel} — ${catEvents.length} new event${catEvents.length !== 1 ? 's' : ''}`;
    categoryMessages.push(categoryHeader);

    for (const event of catEvents) {
      const eventStr = formatEvent(event, category);
      const currentMsgLength = categoryMessages.join('\n\n').length;

      // Check if adding this event exceeds 1900 char limit
      if (currentMsgLength > 0 && (currentMsgLength + 2 + eventStr.length) > 1900) {
        // Push current accumulated message
        messages.push(categoryMessages.join('\n\n'));
        // Start new message with category header and "(continued)"
        categoryMessages.length = 0;
        categoryMessages.push(`(continued) ${categoryHeader}`);
      }
      categoryMessages.push(eventStr);
    }

    // Push final category message
    if (categoryMessages.length > 1) {
      messages.push(categoryMessages.join('\n\n'));
    }
  }

  return {
    total_events: events.length,
    instance_ids: instanceIds,
    messages
  };
}

function categorizeEvents(events) {
  const categorized = {
    'Music': [],
    'Arts & Culture': [],
    'Workshops': [],
    'Other': []
  };

  const musicKeywords = ['jazz', 'concert', 'band', 'live music', 'indie performance', 'performance program', 'quartet', 'quintet', 'tribute', 'music hall', 'dm', 'singer', 'rolling stones', 'liner notes'];
  const artsKeywords = ['theatre', 'theater', 'gallery', 'film', 'poetry', 'talk', 'opera', 'art', 'exhibit', 'opening', 'dance'];
  const workshopsKeywords = ['workshop', 'class', 'carving', 'hands-on', 'craft'];

  for (const event of events) {
    const title = (event.title || '').toLowerCase();
    const desc = (event.description || '').toLowerCase();
    const combined = title + ' ' + desc;

    let category = 'Other';

    if (musicKeywords.some(kw => combined.includes(kw))) {
      category = 'Music';
    } else if (artsKeywords.some(kw => combined.includes(kw))) {
      category = 'Arts & Culture';
    } else if (workshopsKeywords.some(kw => combined.includes(kw))) {
      category = 'Workshops';
    }

    categorized[category].push(event);
  }

  return categorized;
}

function formatEvent(event, category) {
  let result = `**${event.title}**\n`;

  const parts = [];

  // Date and time
  const dateStr = formatDate(event.instance_date, event.instance_time);
  parts.push(`📅 ${dateStr}`);

  // Venue
  if (event.venue) {
    parts.push(`📍 ${event.venue}`);
  }

  // Price
  if (event.price) {
    parts.push(`💰 ${event.price}`);
  }

  result += parts.join(' · ');
  result += '\n';

  // Links and actions
  const actions = [];

  // Ticket URL (if different from event_url)
  if (event.ticket_url && event.ticket_url !== event.event_url) {
    actions.push(`🎫 <${event.ticket_url}>`);
  }

  // Event URL
  if (event.event_url) {
    actions.push(`🔗 <${event.event_url}>`);
  }

  // Add to calendar
  const calendarUrl = buildGoogleCalendarUrl(event);
  actions.push(`📆 <${calendarUrl}>`);

  // Listen (music only)
  if (category === 'Music') {
    const youtubeUrl = buildYoutubeSearchUrl(event.title);
    actions.push(`🎧 <${youtubeUrl}>`);
  }

  // Ticket sale date
  if (event.ticket_sale_date) {
    actions.push(`🔔 Tickets on sale ${formatDate(event.ticket_sale_date, event.ticket_sale_time)}`);
  }

  if (actions.length > 0) {
    result += actions.join(' · ');
  }

  return result;
}

function formatDate(dateStr, timeStr) {
  if (!dateStr) return '';

  const date = new Date(dateStr + 'T00:00:00');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = dayNames[date.getUTCDay()];
  const day = date.getUTCDate();
  const month = monthNames[date.getUTCMonth()];

  let result = `${dayName} ${month} ${day}`;

  // Add time if present and not 00:00:00
  if (timeStr && timeStr !== '00:00:00') {
    const [hours, minutes] = timeStr.split(':');
    let hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    const min = parseInt(minutes, 10);
    result += ` at ${hour}:${min.toString().padStart(2, '0')} ${ampm}`;
  }

  return result;
}

function buildGoogleCalendarUrl(event) {
  const title = encodeURIComponent(event.title);
  const venue = encodeURIComponent(event.venue || '');
  const eventUrl = encodeURIComponent(event.event_url || '');

  // Build dates in YYYYMMDDTHHMMSS format
  const date = event.instance_date.replace(/-/g, '');
  let startTime = '000000';
  let endTime = '020000'; // Default 2 hours later

  if (event.instance_time && event.instance_time !== '00:00:00') {
    const [h, m, s] = event.instance_time.split(':');
    startTime = h + m + s;
    const endHour = (parseInt(h, 10) + 2) % 24;
    endTime = endHour.toString().padStart(2, '0') + m + s;
  }

  const start = `${date}T${startTime}`;
  const end = `${date}T${endTime}`;
  const dates = `${start}/${end}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${eventUrl}&location=${venue}`;
}

function buildYoutubeSearchUrl(title) {
  // Extract artist/band name (usually first part before descriptors)
  const parts = title.split(' ');
  const query = encodeURIComponent(parts.slice(0, Math.min(3, parts.length)).join('+'));
  return `https://www.youtube.com/results?search_query=${query}`;
}
