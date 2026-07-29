let inputData = '';
process.stdin.on('data', chunk => { inputData += chunk; });
process.stdin.on('end', () => {
  const events = JSON.parse(inputData);

  // Categorize events
  const categories = {
    '🎵 Music': [],
    '🛠️ Workshops': [],
    '🎨 Arts & Culture': [],
    '📅 Other': []
  };

  // Categorization logic
  function categorizeEvent(event) {
    const title = (event.title || '').toLowerCase();
    const desc = (event.description || '').toLowerCase();
    const combined = `${title} ${desc}`;

    // Music: concerts, live music, bands, jazz, soul, performances
    if (combined.includes('jazz') || combined.includes('concert') ||
        combined.includes('live') || combined.includes('music') ||
        combined.includes('band') || combined.includes('soul') ||
        combined.includes('blues') || combined.includes('rock') ||
        combined.includes('singer') || combined.includes('artist') ||
        combined.includes('performance') || combined.includes('jam') ||
        combined.includes('bluegrass') || combined.includes('classical') ||
        combined.includes('candlelight') || combined.includes('tenor')) {
      return '🎵 Music';
    }

    // Workshops: classes, hands-on, workshops, craft
    if (combined.includes('workshop') || combined.includes('class') ||
        combined.includes('hands-on') || combined.includes('craft') ||
        combined.includes('embroidery') || combined.includes('tie dye')) {
      return '🛠️ Workshops';
    }

    // Arts & Culture: gallery, theater, film, poetry, talks, trivia, history
    if (combined.includes('gallery') || combined.includes('theater') ||
        combined.includes('theatre') || combined.includes('film') ||
        combined.includes('poetry') || combined.includes('talk') ||
        combined.includes('trivia') || combined.includes('history')) {
      return '🎨 Arts & Culture';
    }

    return '📅 Other';
  }

  // Sort events by date
  events.sort((a, b) => {
    return new Date(a.instance_date) - new Date(b.instance_date);
  });

  // Categorize
  events.forEach(event => {
    const category = categorizeEvent(event);
    categories[category].push(event);
  });

  // Utility functions
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function formatTime(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const min = parseInt(m);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(min).padStart(2, '0')} ${ampm}`;
  }

  function buildGoogleCalendarUrl(event) {
    const title = event.title || 'Event';
    const venue = event.venue || '';
    const eventUrl = event.event_url || event.description || '';

    const [year, month, day] = event.instance_date.split('-');

    let dates;
    if (event.instance_time) {
      const [h, m] = event.instance_time.split(':');
      const startTime = `${year}${month}${day}T${h}${m}00`;
      let endTime;
      if (event.end_date && event.end_date !== event.instance_date) {
        endTime = `${event.end_date.split('-').join('')}T${h}${m}00`;
      } else {
        const endHour = parseInt(h) + 2;
        endTime = `${year}${month}${day}T${String(endHour).padStart(2, '0')}${m}00`;
      }
      dates = `${startTime}/${endTime}`;
    } else {
      dates = `${year}${month}${day}/${year}${month}${day}`;
    }

    const params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text', title);
    params.set('dates', dates);
    params.set('details', eventUrl);
    params.set('location', venue);

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  // Format events
  function formatEvent(event) {
    let line = `**${event.title}**\n`;

    // Build details line
    const details = [];

    if (event.instance_date) {
      const dateStr = formatDate(event.instance_date);
      if (event.instance_time) {
        const timeStr = formatTime(event.instance_time);
        details.push(`📅 ${dateStr} at ${timeStr}`);
      } else {
        details.push(`📅 ${dateStr}`);
      }
    }

    if (event.venue) {
      details.push(`📍 ${event.venue}`);
    }

    if (event.price) {
      details.push(`💰 ${event.price}`);
    }

    if (details.length > 0) {
      line += details.join(' · ') + '\n';
    }

    // Build links line
    const links = [];

    if (event.ticket_url && event.ticket_url !== event.event_url) {
      links.push(`🎫 [Tickets](${event.ticket_url})`);
    }

    if (event.event_url) {
      links.push(`🔗 [Event](${event.event_url})`);
    }

    if (event.instance_date) {
      const calUrl = buildGoogleCalendarUrl(event);
      links.push(`📆 [Add event](${calUrl})`);
    }

    // Add YouTube link for music events
    const category = categorizeEvent(event);
    if (category === '🎵 Music') {
      const artist = event.title.split(' - ')[0].split('Feat.')[0].trim();
      if (artist) {
        const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(artist)}`;
        links.push(`🎧 [Listen](${ytUrl})`);
      }
    }

    if (event.ticket_sale_date) {
      links.push(`🔔 Tickets on sale ${formatDate(event.ticket_sale_date)}`);
    }

    if (links.length > 0) {
      line += links.join(' · ') + '\n';
    }

    return line.trim() + '\n';
  }

  // Build messages
  const messages = [];

  // Header message
  const today = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentDate = `${monthNames[today.getUTCMonth()]} ${today.getUTCDate()}, ${today.getUTCFullYear()}`;
  messages.push(`🗓️ **EventFinder Digest** — ${events.length} new events · ${currentDate}`);

  // Add category messages
  Object.entries(categories).forEach(([category, evts]) => {
    if (evts.length === 0) return;

    const header = `${category} — ${evts.length} new event${evts.length !== 1 ? 's' : ''}`;
    let currentMessage = header + '\n\n';

    evts.forEach(event => {
      const formatted = formatEvent(event);

      if ((currentMessage + formatted).length > 1950) {
        messages.push(currentMessage.trim());
        currentMessage = `${category} (continued)\n\n${formatted}`;
      } else {
        currentMessage += formatted;
      }
    });

    if (currentMessage.trim() !== header) {
      messages.push(currentMessage.trim());
    }
  });

  // Collect all instance IDs
  const instanceIds = events.map(e => e.instance_id);

  // Output
  const output = {
    total_events: events.length,
    instance_ids: instanceIds,
    messages: messages
  };

  console.log(JSON.stringify(output, null, 2));
});
