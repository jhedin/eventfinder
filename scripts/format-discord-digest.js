#!/usr/bin/env node

import fs from 'fs';

// Read events from stdin (piped from db-query.js)
let input = '';
process.stdin.on('data', chunk => input += chunk);

process.stdin.on('end', () => {
  const events = JSON.parse(input);

  // Helper: Format time
  function formatTime(timeStr) {
    if (!timeStr) return null;
    const [hours, mins] = timeStr.split(':');
    const h = parseInt(hours);
    const m = parseInt(mins);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  }

  // Helper: Format date
  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00Z');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[date.getUTCDay()];
    const monthName = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    return `${dayName} ${monthName} ${day}`;
  }

  // Helper: Categorize event
  function categorizeEvent(title, description) {
    const text = (title + ' ' + (description || '')).toLowerCase();

    // Music patterns
    if (text.match(/concert|band|jazz|rock|music|live|performance|festival|tribute|candlelight|synth soundbath|kawa jam|eddy fest|honens|jill barber|jeremy dutcher|mudmen|barra macneils|pretty reckless|incredibly hip|keltonic|danny nix|sargeant|liquor mountain|gbèdu|afro-jazz|keyboard|piano|liner notes|rolling stones/i)) {
      return { emoji: '🎵', category: 'Music' };
    }

    // Workshops
    if (text.match(/workshop|playlab|bow & tell|circuit jam|class|hands-on|learning|interactive|experience|forever young|instrument petting|kitchen party/i)) {
      // Distinction: if it's a music-focused workshop or educational music event
      if (text.match(/music|bow & tell|circuit|playlab|keyboard|violin|piano|instrument/i)) {
        return { emoji: '🎵', category: 'Music' }; // Music educational events
      }
      return { emoji: '🛠️', category: 'Workshops' };
    }

    // Arts & Culture
    if (text.match(/gallery|theater|film|poetry|talk|museum|tour|backstage|nmc tours|sam demma|author|keynote/i)) {
      return { emoji: '🎨', category: 'Arts & Culture' };
    }

    // Default to Music (most events in the list are music-related)
    return { emoji: '🎵', category: 'Music' };
  }

  // Helper: URL encode
  function encodeUrl(str) {
    if (!str) return '';
    return encodeURIComponent(str);
  }

  // Helper: Build Google Calendar URL
  function buildCalendarUrl(title, date, time, endDate, venue, eventUrl) {
    let startDate = date.replace(/-/g, '');
    let endDateStr = endDate || date;
    endDateStr = endDateStr.replace(/-/g, '');

    let dates;
    if (time) {
      const [h, m] = time.split(':');
      const startDateTime = `${startDate}T${h}${m}00`;
      const endHours = parseInt(h) + 2;
      const endDateTime = `${endDateStr}T${endHours.toString().padStart(2, '0')}${m}00`;
      dates = `${startDateTime}/${endDateTime}`;
    } else {
      dates = `${startDate}/${endDateStr}`;
    }

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeUrl(title)}&dates=${dates}&details=${encodeUrl(eventUrl)}&location=${encodeUrl(venue)}`;
  }

  // Helper: Extract artist name for YouTube search
  function extractArtistName(title) {
    // Simple extraction - remove common prefixes/suffixes
    let artist = title
      .replace(/^(Candlelight:|Liner Notes:|NMC Presents:|CIBC Backbeat:|PlayLab:|Synth Soundbath:|Weekly Saturday Kawa Jam|2026 Honens Festival|Forever Young:|Music in the Streets:|NMC Tours:|We've Got The Jazz!|King & NMC Present)\s*/i, '')
      .replace(/—.*$/i, '')
      .replace(/:\s.*/i, '')
      .trim();
    return artist;
  }

  // Group events
  const grouped = {};
  events.forEach(event => {
    const cat = categorizeEvent(event.title, event.description);
    if (!grouped[cat.category]) {
      grouped[cat.category] = [];
    }
    grouped[cat.category].push({
      ...event,
      category: cat.category,
      emoji: cat.emoji
    });
  });

  // Sort categories in order: Music, Arts & Culture, Workshops, Other
  const categoryOrder = ['Music', 'Arts & Culture', 'Workshops', 'Other'];
  const messages = [];
  const allInstanceIds = [];

  // Header
  messages.push(`🗓️ **EventFinder Digest** — ${events.length} new events · August 9, 2026`);

  // Process each category
  categoryOrder.forEach(cat => {
    if (!grouped[cat]) return;

    const categoryEvents = grouped[cat];
    const categoryEmoji = categoryEvents[0].emoji;
    let categoryMessage = `${categoryEmoji} **${cat}** — ${categoryEvents.length} new event${categoryEvents.length !== 1 ? 's' : ''}\n\n`;

    categoryEvents.forEach(event => {
      allInstanceIds.push(event.instance_id);

      const timeStr = event.instance_time ? ` at ${formatTime(event.instance_time)}` : '';
      const dateStr = formatDate(event.instance_date);

      let eventLine = `**${event.title}**\n`;

      // Date/time/venue/price line
      let metaLine = `📅 ${dateStr}${timeStr}`;
      if (event.venue) metaLine += ` · 📍 ${event.venue}`;
      if (event.price) metaLine += ` · 💰 ${event.price}`;
      eventLine += metaLine + '\n';

      // Links and extras
      let linksLine = '';

      // Tickets on sale
      if (event.ticket_sale_date) {
        linksLine += `🔔 Tickets on sale ${formatDate(event.ticket_sale_date)} · `;
      }

      // Ticket URL if different from event URL
      if (event.ticket_url && event.ticket_url !== event.event_url) {
        linksLine += `🎫 <${event.ticket_url}> · `;
      }

      // Event URL
      if (event.event_url) {
        linksLine += `🔗 <${event.event_url}> · `;
      }

      // Calendar link
      const calUrl = buildCalendarUrl(event.title, event.instance_date, event.instance_time, event.end_date, event.venue, event.event_url);
      linksLine += `📆 <${calUrl}|Add event>`;

      // YouTube search for music
      if (event.category === 'Music' && event.title) {
        const artist = extractArtistName(event.title);
        const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeUrl(artist)}`;
        linksLine += ` · 🎧 <${youtubeUrl}|Listen>`;
      }

      eventLine += linksLine + '\n\n';

      // Check if adding this event would exceed message limit
      if ((categoryMessage + eventLine).length > 1950) {
        messages.push(categoryMessage.trim());
        categoryMessage = eventLine;
      } else {
        categoryMessage += eventLine;
      }
    });

    messages.push(categoryMessage.trim());
  });

  // Write output
  const output = {
    total_events: events.length,
    instance_ids: allInstanceIds,
    messages: messages
  };

  fs.writeFileSync('/tmp/discord-digest.json', JSON.stringify(output, null, 2));
  console.log(`Digest formatted: ${events.length} events, ${messages.length} messages. Written to /tmp/discord-digest.json`);
});
