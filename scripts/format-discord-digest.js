#!/usr/bin/env node
import fs from 'fs';

// Helper to create Google Calendar URL
function createCalendarUrl(event) {
  const {
    title,
    venue,
    instance_date,
    instance_time,
    end_date,
    event_url
  } = event;

  if (!title || !instance_date) return null;

  let startDate, endDate;
  
  if (instance_time) {
    const timeMatch = instance_time.match(/(\d{2}):(\d{2})/);
    const hour = timeMatch ? timeMatch[1] : '00';
    const minute = timeMatch ? timeMatch[2] : '00';
    startDate = instance_date.replace(/-/g, '') + 'T' + hour + minute + '00';
    
    const endHour = String(Math.min(parseInt(hour) + 2, 23)).padStart(2, '0');
    endDate = instance_date.replace(/-/g, '') + 'T' + endHour + minute + '00';
  } else {
    startDate = instance_date.replace(/-/g, '');
    endDate = end_date ? end_date.replace(/-/g, '') : startDate;
  }

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', title);
  params.set('dates', `${startDate}/${endDate}`);
  params.set('details', event_url || '');
  params.set('location', venue || '');

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Categorize event based on title/description
function categorizeEvent(event) {
  const { title, description } = event;
  const text = (title + ' ' + (description || '')).toLowerCase();

  // Music events - includes "live music", "concert", "band", specific genres
  if (text.match(/concert|band|live music|musician|artist|jam|blues|jazz|rock|pop|indie|folk|reggae|electronic|dj|performance|singer|performer|music venue/)) {
    return 'music';
  }

  // Arts & Culture - broader than workshops
  if (text.match(/art|gallery|theater|theatre|film|cinema|movie|play|exhibition|cultural|indigenous|aboriginal|native|poetry|spoken word|talk|lecture|symposium|conference|opening|festival|awards|book|author|dance|ballet|comedy|show/)) {
    return 'arts';
  }

  // Workshops
  if (text.match(/workshop|class|training|course|hands-on|craft|learn/)) {
    return 'workshop';
  }

  return 'other';
}

// Format single event for Discord
function formatEventForDiscord(event) {
  const {
    title,
    venue,
    price,
    event_url,
    ticket_url,
    instance_date,
    instance_time,
    ticket_sale_date
  } = event;

  // Parse date
  const dateObj = new Date(instance_date + 'T00:00:00');
  const dayName = dateObj.toLocaleString('en-US', { weekday: 'short' });
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleString('en-US', { month: 'short' });

  let timestamp = `📅 ${dayName} ${monthName} ${dayNum}`;
  
  if (instance_time) {
    const timeMatch = instance_time.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      timestamp += ` at ${displayHour}:${minute} ${ampm}`;
    }
  }

  // Build details line
  const details = [];
  details.push(timestamp);
  if (venue) details.push(`📍 ${venue}`);
  if (price) details.push(`💰 ${price}`);

  let eventLine = `**${title}**\n${details.join(' · ')}`;

  // Add links
  const links = [];
  
  if (ticket_url && ticket_url !== event_url) {
    links.push(`🎫 [Tickets](${ticket_url})`);
  }
  
  if (event_url && !event_url.startsWith('/')) {
    links.push(`🔗 [Event](${event_url})`);
  }

  // Add calendar link
  const calUrl = createCalendarUrl(event);
  if (calUrl) {
    links.push(`📆 [Add to Calendar](${calUrl})`);
  }

  // Add YouTube search for music events
  const category = categorizeEvent(event);
  if (category === 'music') {
    const artistMatch = title.match(/^(.+?)\s+(?:with|and|&|featuring|\+)/i);
    if (artistMatch) {
      const artist = artistMatch[1].trim();
      const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(artist)}`;
      links.push(`🎧 [Listen](${ytUrl})`);
    }
  }

  if (links.length > 0) {
    eventLine += '\n' + links.join(' · ');
  }

  // Add ticket sale date if present
  if (ticket_sale_date) {
    const saleDate = new Date(ticket_sale_date + 'T00:00:00');
    const saleDateStr = saleDate.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    eventLine += `\n🔔 Tickets on sale ${saleDateStr}`;
  }

  return eventLine;
}

// Split messages to fit Discord limit (1950 chars)
function splitMessages(messages) {
  const result = [];
  let current = '';

  for (const msg of messages) {
    if (!current) {
      current = msg;
    } else if ((current + '\n\n' + msg).length <= 1950) {
      current += '\n\n' + msg;
    } else {
      result.push(current);
      current = msg;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

// Main formatting logic
function formatDigest(events) {
  // Group by category
  const byCategory = {
    music: [],
    arts: [],
    workshop: [],
    other: []
  };

  for (const event of events) {
    const category = categorizeEvent(event);
    byCategory[category].push(event);
  }

  // Collect all instance IDs
  const allInstanceIds = events.map(e => e.instance_id);

  // Header message
  const today = new Date(2026, 8, 19); // Sep 19, 2026
  const dateStr = today.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const totalEvents = events.length;
  const headerMsg = `🗓️ **EventFinder Digest** — ${totalEvents} new events · ${dateStr}`;

  // Format by category
  const categoryEmoji = {
    music: '🎵',
    arts: '🎨',
    workshop: '🛠️',
    other: '📅'
  };

  const categoryName = {
    music: 'Music',
    arts: 'Arts & Culture',
    workshop: 'Workshops',
    other: 'Other'
  };

  const messageGroups = [];

  for (const [category, catEvents] of Object.entries(byCategory)) {
    if (catEvents.length === 0) continue;

    const catHeader = `${categoryEmoji[category]} **${categoryName[category]}** — ${catEvents.length} new event${catEvents.length > 1 ? 's' : ''}`;
    messageGroups.push(catHeader);

    for (const event of catEvents) {
      const formatted = formatEventForDiscord(event);
      messageGroups.push(formatted);
    }
  }

  // Split into Discord-size messages
  const bodyMessages = splitMessages(messageGroups);

  return {
    total_events: totalEvents,
    instance_ids: allInstanceIds,
    messages: [headerMsg, ...bodyMessages]
  };
}

// Process events from stdin
const inputData = await new Promise((resolve, reject) => {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { data += chunk; });
  process.stdin.on('end', () => resolve(data));
  process.stdin.on('error', reject);
});

const events = JSON.parse(inputData);
const digest = formatDigest(events);

// Write output
fs.writeFileSync('/tmp/discord-digest.json', JSON.stringify(digest, null, 2));
console.log(`Digest formatted: ${digest.total_events} events, ${digest.messages.length} messages. Written to /tmp/discord-digest.json`);
