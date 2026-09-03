#!/usr/bin/env node

// Read stdin for events
let input = '';
process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  const events = JSON.parse(input);

  // Helper function to format date-time for Google Calendar URL
  function formatGoogleCalendarTime(date, time) {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00Z');
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');

    if (!time) {
      return `${year}${month}${day}/${year}${month}${day}`;
    }

    const [h, m] = time.split(':');
    const startTime = `${year}${month}${day}T${h}${m}00`;
    // Default 2-hour duration
    const endHour = String(parseInt(h) + 2).padStart(2, '0');
    const endTime = `${year}${month}${day}T${endHour}${m}00`;
    return `${startTime}/${endTime}`;
  }

  // Helper to format 12-hour time
  function format12Hour(time) {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  }

  // Helper to format date
  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[d.getUTCDay()];
    return `${dayName} ${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  // Helper to determine category
  function categorizeEvent(event) {
    const title = (event.title || '').toLowerCase();
    const venue = (event.venue || '').toLowerCase();
    const desc = (event.description || '').toLowerCase();

    const musicKeywords = ['music', 'concert', 'band', 'live', 'festival', 'jazz', 'rock', 'blues', 'soundtrack', 'beethoven', 'singer'];
    const workshopKeywords = ['workshop', 'class', 'training', 'professional development', 'course'];
    const artKeywords = ['theater', 'theatre', 'art', 'exhibition', 'gallery', 'film', 'poetry', 'story', 'talk', 'speaker', 'photography', 'musical'];

    const fullText = title + ' ' + venue + ' ' + desc;

    for (const keyword of workshopKeywords) {
      if (fullText.includes(keyword)) return 'workshop';
    }

    for (const keyword of musicKeywords) {
      if (fullText.includes(keyword)) return 'music';
    }

    for (const keyword of artKeywords) {
      if (fullText.includes(keyword)) return 'arts';
    }

    return 'other';
  }

  // Group events by category
  const grouped = { music: [], arts: [], workshop: [], other: [] };
  const uniqueInstanceIds = new Set();

  for (const event of events) {
    const category = categorizeEvent(event);
    grouped[category].push(event);
    uniqueInstanceIds.add(event.instance_id);
  }

  // Format event into Discord message lines
  function formatEvent(event) {
    const timeStr = event.instance_time ? ` at ${format12Hour(event.instance_time)}` : '';
    const dateStr = formatDate(event.instance_date);

    let line = `**${event.title}**\n`;

    // First line: date, time, venue, price
    let metaLine = `📅 ${dateStr}${timeStr}`;
    if (event.venue) metaLine += ` · 📍 ${event.venue}`;
    if (event.price) metaLine += ` · 💰 ${event.price}`;
    line += metaLine + '\n';

    // Links and actions
    let linksLine = '';

    // Add ticket URL if different from event_url
    if (event.ticket_url && event.ticket_url !== event.event_url && event.ticket_url.startsWith('http')) {
      linksLine += `🎫 <${event.ticket_url}> · `;
    }

    // Add event URL
    if (event.event_url && event.event_url.startsWith('http')) {
      linksLine += `🔗 <${event.event_url}> · `;
    }

    // Add Google Calendar link
    const dates = formatGoogleCalendarTime(event.instance_date, event.instance_time);
    if (dates) {
      const encoded = encodeURIComponent(event.title);
      const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encoded}&dates=${dates}&details=${encodeURIComponent(event.event_url || '')}&location=${encodeURIComponent(event.venue || '')}`;
      linksLine += `📆 <${calUrl}|Add to calendar> · `;
    }

    // Add YouTube search for music events
    if (categorizeEvent(event) === 'music') {
      const artist = event.title.split(' - ')[0].trim();
      const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(artist)}`;
      linksLine += `🎧 <${ytUrl}|Listen>`;
    }

    // Add ticket sale date if present
    if (event.ticket_sale_date) {
      linksLine += ` · 🔔 Tickets on sale ${formatDate(event.ticket_sale_date)}`;
    }

    // Clean up trailing separators
    linksLine = linksLine.replace(/ · $/, '');

    if (linksLine) {
      line += linksLine + '\n';
    }

    return line;
  }

  // Build messages by category
  const messages = [];

  // Header
  const totalEvents = events.length;
  messages.push(`🗓️ **EventFinder Digest** — ${totalEvents} new events · September 3, 2026`);

  // Category icons and names
  const categoryNames = {
    music: '🎵 Music',
    arts: '🎨 Arts & Culture',
    workshop: '🛠️ Workshops',
    other: '📅 Other'
  };

  const categoryOrder = ['music', 'arts', 'workshop', 'other'];

  for (const cat of categoryOrder) {
    if (grouped[cat].length === 0) continue;

    const eventsInCat = grouped[cat];
    let categoryMsg = `\n${categoryNames[cat]} — ${eventsInCat.length} new event${eventsInCat.length !== 1 ? 's' : ''}\n\n`;

    for (const event of eventsInCat) {
      const eventFormatted = formatEvent(event);

      // Check if adding this event would exceed Discord limit
      if ((categoryMsg + eventFormatted).length > 1950) {
        messages.push(categoryMsg.trim());
        categoryMsg = `${categoryNames[cat]} (continued)\n\n${eventFormatted}`;
      } else {
        categoryMsg += eventFormatted + '\n';
      }
    }

    if (categoryMsg.trim()) {
      messages.push(categoryMsg.trim());
    }
  }

  // Build output
  const output = {
    total_events: totalEvents,
    instance_ids: Array.from(uniqueInstanceIds),
    messages: messages
  };

  console.log(JSON.stringify(output, null, 2));
});
