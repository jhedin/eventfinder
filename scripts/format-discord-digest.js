#!/usr/bin/env node

import fs from 'fs';

// Read the events from stdin or file
const eventsJson = fs.readFileSync(0, 'utf8');
const events = JSON.parse(eventsJson);

// Helper: format date/time
function formatDateTime(date, time) {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00Z');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = dayNames[d.getUTCDay()];
  const month = monthNames[d.getUTCMonth()];
  const day = d.getUTCDate();

  if (!time) {
    return `${dayName} ${month} ${day}`;
  }

  const [hours, mins] = time.split(':');
  const h = parseInt(hours);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  return `${dayName} ${month} ${day} at ${displayHours}:${mins} ${period}`;
}

// Helper: categorize event
function categorizeEvent(event) {
  const title = event.title.toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const combined = title + ' ' + desc;

  // Music: Concerts, live music, band performances, DJ, jazz, etc
  const musicKeywords = ['concert', 'live', 'performance', 'band', 'music', 'jazz', 'artist', 'singer', 'musician', 'dj', 'party', 'music awards', 'candlelight jazz', 'the jazz room'];
  if (musicKeywords.some(kw => combined.includes(kw))) {
    return 'music';
  }

  // Workshops: Classes, hands-on learning, craft sessions, workshops
  const workshopKeywords = ['workshop', 'class', 'hands-on', 'learn', 'craft', 'finger weaving', 'jingle cone'];
  if (workshopKeywords.some(kw => combined.includes(kw))) {
    return 'workshop';
  }

  // Arts & Culture: Gallery, theater, film, exhibition, art, talks
  const artsKeywords = ['gallery', 'theater', 'theatre', 'film', 'movie', 'exhibition', 'art', 'tale', 'classics & crafts', 'how true', 'drop-in art', 'opens', 'opening', 'studio', 'talk', 'grease', 'fun home', 'candlelight', 'public art', 'reel talk'];
  if (artsKeywords.some(kw => combined.includes(kw))) {
    return 'arts';
  }

  // Default to other
  return 'other';
}

// Helper: URL encode for Google Calendar
function encodeCalendarParam(text) {
  if (!text) return '';
  return encodeURIComponent(text);
}

// Helper: format event for Discord
function formatEvent(event, isMusic = false) {
  const title = event.title;
  const venue = event.venue;
  const price = event.price;
  const eventUrl = event.event_url;
  const ticketUrl = event.ticket_url;
  const instanceDate = event.instance_date;
  const instanceTime = event.instance_time;
  const ticketSaleDate = event.ticket_sale_date;
  const ticketSaleTime = event.ticket_sale_time;

  // Format date/time
  const dateTime = formatDateTime(instanceDate, instanceTime);

  // Build line 1: **Title**
  let output = `**${title}**\n`;

  // Build line 2: metadata
  let metadata = [];
  if (dateTime) metadata.push(`📅 ${dateTime}`);
  if (venue) metadata.push(`📍 ${venue}`);
  if (price) metadata.push(`💰 ${price}`);
  output += metadata.join(' · ') + '\n';

  // Build line 3: links
  let links = [];
  if (ticketUrl && ticketUrl !== eventUrl) {
    links.push(`🎫 ${ticketUrl}`);
  }
  if (eventUrl) {
    links.push(`🔗 ${eventUrl}`);
  }

  // Google Calendar link
  const calendarUrl = buildCalendarUrl(title, instanceDate, instanceTime, venue, eventUrl);
  if (calendarUrl) {
    links.push(`📆 ${calendarUrl}`);
  }

  if (isMusic) {
    links.push(`🎧 https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`);
  }

  if (links.length > 0) {
    output += links.map(l => {
      if (l.includes(' http')) {
        const firstSpace = l.indexOf(' ');
        const emoji = l.substring(0, firstSpace);
        const url = l.substring(firstSpace + 1);
        return `${emoji} ${url}`;
      }
      return l;
    }).join(' · ') + '\n';
  }

  // Add ticket sale date if present
  if (ticketSaleDate) {
    const saleDate = formatDateTime(ticketSaleDate, ticketSaleTime);
    output += `🔔 Tickets on sale ${saleDate}\n`;
  }

  return output;
}

// Helper: build Google Calendar URL
function buildCalendarUrl(title, date, time, venue, eventUrl) {
  if (!date) return '';
  let startDate = date.replace(/-/g, '');
  
  // If no time, use all-day format
  if (!time) {
    const endDate = startDate;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeCalendarParam(title)}&dates=${startDate}/${endDate}&details=${encodeCalendarParam(eventUrl || '')}&location=${encodeCalendarParam(venue || '')}`;
  }

  // If time, add 2 hours for end time
  const [hours, mins, secs] = time.split(':');
  let endHours = parseInt(hours) + 2;
  let endDate = date;
  
  if (endHours >= 24) {
    endHours = endHours - 24;
    const d = new Date(date + 'T00:00:00Z');
    d.setDate(d.getDate() + 1);
    endDate = d.toISOString().split('T')[0];
  }
  
  const startTime = hours + mins + (secs || '00');
  const endTime = String(endHours).padStart(2, '0') + mins + (secs || '00');
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeCalendarParam(title)}&dates=${startDate}T${startTime}00/${endDate}T${endTime}00&details=${encodeCalendarParam(eventUrl || '')}&location=${encodeCalendarParam(venue || '')}`;
}

// Group events by category
const grouped = {
  music: [],
  arts: [],
  workshop: [],
  other: []
};

const instanceIds = new Set();
for (const event of events) {
  const category = categorizeEvent(event);
  grouped[category].push(event);
  instanceIds.add(event.instance_id);
}

// Build messages
const messages = [];

// Header message
const total = events.length;
messages.push(`🗓️ **EventFinder Digest** — ${total} new events · August 21, 2026`);

// Music events
if (grouped.music.length > 0) {
  let categoryMsg = `\n🎵 **Music** — ${grouped.music.length} new events\n`;
  for (const event of grouped.music) {
    categoryMsg += '\n' + formatEvent(event, true);
  }
  messages.push(categoryMsg);
}

// Arts & Culture events
if (grouped.arts.length > 0) {
  let categoryMsg = `\n🎨 **Arts & Culture** — ${grouped.arts.length} new events\n`;
  let currentMsg = '';
  for (const event of grouped.arts) {
    const formatted = '\n' + formatEvent(event, false);
    if ((currentMsg + formatted).length > 1950 && currentMsg.length > 0) {
      categoryMsg += currentMsg;
      messages.push(categoryMsg);
      categoryMsg = `🎨 **Arts & Culture** (continued)\n`;
      currentMsg = formatted;
    } else {
      currentMsg += formatted;
    }
  }
  categoryMsg += currentMsg;
  if (categoryMsg.trim().length > 0) {
    messages.push(categoryMsg);
  }
}

// Workshop events
if (grouped.workshop.length > 0) {
  let categoryMsg = `\n🛠️ **Workshops** — ${grouped.workshop.length} new events\n`;
  for (const event of grouped.workshop) {
    categoryMsg += '\n' + formatEvent(event, false);
  }
  messages.push(categoryMsg);
}

// Other events
if (grouped.other.length > 0) {
  let categoryMsg = `\n📅 **Other** — ${grouped.other.length} new events\n`;
  for (const event of grouped.other) {
    categoryMsg += '\n' + formatEvent(event, false);
  }
  messages.push(categoryMsg);
}

// Output
const output = {
  total_events: total,
  instance_ids: Array.from(instanceIds).sort((a, b) => a - b),
  messages: messages
};

console.log(JSON.stringify(output, null, 2));
