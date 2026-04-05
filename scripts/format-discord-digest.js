import fs from 'fs';

// Music keywords for categorization
const MUSIC_KEYWORDS = [
  'concert', 'band', 'music', 'jazz', 'blues', 'rock', 'pop', 'hip-hop', 'hiphop',
  'folk', 'country', 'reggae', 'metal', 'electronic', 'dj', 'live music', 'performer',
  'singer', 'artist', 'album', 'tour', 'festival', 'session', 'jam session'
];

const ARTS_KEYWORDS = [
  'gallery', 'exhibition', 'exhibit', 'art', 'theater', 'theatre', 'play', 'film',
  'cinema', 'movie', 'poetry', 'reading', 'literary', 'dance', 'ballet', 'opera',
  'talk', 'lecture', 'discussion', 'panel', 'screening'
];

const WORKSHOP_KEYWORDS = [
  'workshop', 'class', 'course', 'lesson', 'training', 'session', 'tutorial',
  'seminar', 'craft', 'hands-on', 'learn', 'instruction', 'masterclass', 'webinar'
];

function categorizeEvent(event) {
  const text = `${event.title} ${event.description || ''}`.toLowerCase();

  // Check for music keywords
  for (const keyword of MUSIC_KEYWORDS) {
    if (text.includes(keyword)) {
      return 'music';
    }
  }

  // Check for arts keywords
  for (const keyword of ARTS_KEYWORDS) {
    if (text.includes(keyword)) {
      return 'arts';
    }
  }

  // Check for workshop keywords
  for (const keyword of WORKSHOP_KEYWORDS) {
    if (text.includes(keyword)) {
      return 'workshop';
    }
  }

  return 'other';
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const min = parseInt(minutes);

  let period = 'AM';
  let displayHour = hour;

  if (hour >= 12) {
    period = 'PM';
    if (hour > 12) displayHour = hour - 12;
  } else if (hour === 0) {
    displayHour = 12;
  }

  return `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[date.getUTCDay()];
  const dateNum = date.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getUTCMonth()];

  return { day, month, dateNum };
}

function buildGoogleCalendarURL(event) {
  const dateStr = event.instance_date;
  const timeStr = formatTime(event.instance_time);

  let startDate, endDate;
  if (timeStr) {
    // Time is known, use YYYYMMDDTHHmmSS format
    const [year, month, day] = dateStr.split('-');
    const [displayHour, minPeriod] = timeStr.split(':');
    const minutes = minPeriod.split(' ')[0];
    const period = minPeriod.split(' ')[1];
    let hour = parseInt(displayHour);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    startDate = `${year}${month}${day}T${String(hour).padStart(2, '0')}${minutes}00`;
    const endHour = (hour + 2) % 24;
    endDate = `${year}${month}${day}T${String(endHour).padStart(2, '0')}${minutes}00`;
  } else {
    // No time, use YYYYMMDD/YYYYMMDD format
    const [year, month, day] = dateStr.split('-');
    startDate = `${year}${month}${day}`;
    endDate = `${year}${month}${day}`;
  }

  const text = encodeURIComponent(event.title);
  const details = event.event_url ? encodeURIComponent(event.event_url) : '';
  const location = encodeURIComponent(event.venue || '');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
}

function buildTicketSaleCalendarURL(event) {
  if (!event.ticket_sale_date) return null;

  const [year, month, day] = event.ticket_sale_date.split('-');
  const startDate = `${year}${month}${day}`;
  const endDate = `${year}${month}${day}`;

  const text = encodeURIComponent(`🎫 Tickets on sale: ${event.title}`);
  const location = encodeURIComponent(event.venue || '');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startDate}/${endDate}&location=${location}`;
}

function buildYouTubeSearchURL(artistName) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(artistName)}`;
}

function formatEventLine(event) {
  const dateObj = formatDate(event.instance_date);
  const timeStr = formatTime(event.instance_time);

  let dateTime = `${dateObj.day} ${dateObj.month} ${dateObj.dateNum}`;
  if (timeStr) {
    dateTime += ` at ${timeStr}`;
  }

  let line = `📅 ${dateTime}`;

  if (event.venue) {
    line += ` · 📍 ${event.venue}`;
  }

  if (event.price) {
    line += ` · 💰 ${event.price}`;
  }

  return line;
}

function formatEvent(event, category) {
  const lines = [];
  lines.push(`**${event.title}**`);

  // Main event details line
  lines.push(formatEventLine(event));

  // Build links line
  const links = [];

  // Add ticket URL if available (and different from event_url)
  if (event.ticket_url && event.ticket_url !== event.event_url) {
    links.push(`🎫 [Tickets](${event.ticket_url})`);
  }

  // Add event URL
  if (event.event_url) {
    links.push(`🔗 [Event](${event.event_url})`);
  }

  // Add calendar link
  const calendarURL = buildGoogleCalendarURL(event);
  links.push(`[📆 Add event](${calendarURL})`);

  // Add ticket sale date link
  if (event.ticket_sale_date) {
    const ticketSaleURL = buildTicketSaleCalendarURL(event);
    const saleDate = formatDate(event.ticket_sale_date);
    links.push(`[🔔 Tickets ${saleDate.month} ${saleDate.dateNum}](${ticketSaleURL})`);
  }

  // Add YouTube search for music events
  if (category === 'music') {
    const youtubeURL = buildYouTubeSearchURL(event.title);
    links.push(`[🎧 Listen](${youtubeURL})`);
  }

  lines.push(links.join(' · '));

  return lines.join('\n');
}

function createCategoryMessages(events, category) {
  const categoryEmoji = category === 'music' ? '🎵' :
                       category === 'arts' ? '🎨' :
                       category === 'workshop' ? '🛠️' : '📅';

  const categoryDisplay = category === 'music' ? 'Music' :
                         category === 'arts' ? 'Arts & Culture' :
                         category === 'workshop' ? 'Workshops' : 'Other';

  const header = `${categoryEmoji} **${categoryDisplay}** — ${events.length} new event${events.length !== 1 ? 's' : ''}`;

  const eventTexts = events.map(e => formatEvent(e, category));

  // Build messages respecting 1950 char limit
  const messages = [];
  let current = header;

  for (const eventText of eventTexts) {
    const candidate = current + '\n\n' + eventText;
    if (candidate.length > 1950) {
      messages.push(current);
      current = `${categoryEmoji} **${categoryDisplay}** (continued)\n\n${eventText}`;
    } else {
      current = candidate;
    }
  }

  if (current !== header) {
    messages.push(current);
  }

  return messages;
}

// Main execution
try {
  const data = JSON.parse(fs.readFileSync('/tmp/pending-events.json', 'utf8'));

  if (!Array.isArray(data) || data.length === 0) {
    console.log('No pending events found');
    fs.writeFileSync('/tmp/discord-digest.json', JSON.stringify({
      total_events: 0,
      instance_ids: [],
      messages: []
    }, null, 2));
    process.exit(0);
  }

  // Categorize events
  const categorized = {
    music: [],
    arts: [],
    workshop: [],
    other: []
  };

  const instanceIds = [];

  for (const event of data) {
    const category = categorizeEvent(event);
    categorized[category].push(event);
    instanceIds.push(event.instance_id);
  }

  // Format messages for each category
  const allMessages = [];
  const categoryOrder = ['music', 'arts', 'workshop', 'other'];

  for (const category of categoryOrder) {
    const events = categorized[category];
    if (events.length === 0) continue;

    const messages = createCategoryMessages(events, category);
    allMessages.push(...messages);
  }

  // Write output
  const output = {
    total_events: data.length,
    instance_ids: instanceIds,
    messages: allMessages
  };

  fs.writeFileSync('/tmp/discord-digest.json', JSON.stringify(output, null, 2));

  const categoryCount = Object.values(categorized).filter(arr => arr.length > 0).length;
  console.log(`Digest formatted: ${data.length} events across ${categoryCount} categories, ${allMessages.length} messages total. Written to /tmp/discord-digest.json`);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
