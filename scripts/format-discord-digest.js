#!/usr/bin/env node

import fs from 'fs';

// Read the events from stdin
const rawData = fs.readFileSync(0, 'utf-8');
const events = JSON.parse(rawData);

// Categorize events
function categorizeEvent(event) {
  const title = event.title.toLowerCase();
  const desc = (event.description || '').toLowerCase();

  // Music events
  if (title.match(/jazz|concert|band|music|performer|live music|jam session|singer|song|blues|rock|hip.?hop|funk|symphony|philharmonic|composer|guitar|drum|orchestra/i) ||
      desc.match(/jazz|concert|band|music|performer|live music|jam|singer|song|blues|rock/i)) {
    return 'Music';
  }

  // Workshop/craft events
  if (title.match(/workshop|class|craft|learn|hands.?on|weaving|clay|keychain|course/i) ||
      desc.match(/workshop|class|craft|learn|hands.?on|taught by/i)) {
    return 'Workshops';
  }

  // Arts & Culture
  if (title.match(/exhibition|gallery|art|theater|theatre|film|cinema|movie|talk|reading|book|poetry|performance|showcase|opening|cultural/i) ||
      desc.match(/exhibition|gallery|art|theater|theatre|film|cinema|movie|talk|cultural/i)) {
    return 'Arts & Culture';
  }

  return 'Other';
}

// Format time
function formatTime(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const m = parseInt(minutes);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  return `${displayHours}:${m.toString().padStart(2, '0')} ${period}`;
}

// Format date for Google Calendar
function formatDateForCalendar(dateStr, timeStr, endDate) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const startDateTime = `${year}${month}${day}T${hours}${minutes}00`;

    // End time: if end_date provided, use that; otherwise add 2 hours
    if (endDate && endDate !== dateStr) {
      const endDt = new Date(endDate);
      const endYear = endDt.getFullYear();
      const endMonth = String(endDt.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDt.getDate()).padStart(2, '0');
      return `${startDateTime}/${endYear}${endMonth}${endDay}T${hours}${minutes}00`;
    } else {
      const endHours = (parseInt(hours) + 2) % 24;
      return `${startDateTime}/${year}${month}${day}T${String(endHours).padStart(2, '0')}${minutes}00`;
    }
  } else {
    // All-day event
    const endDate2 = endDate ? new Date(endDate) : date;
    const endYear = endDate2.getFullYear();
    const endMonth = String(endDate2.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDate2.getDate() + 1).padStart(2, '0');
    return `${year}${month}${day}/${endYear}${endMonth}${endDay}`;
  }
}

// URL encode function
function urlEncode(str) {
  if (!str) return '';
  return encodeURIComponent(str);
}

// Format day of week
function formatDayOfWeek(dateStr) {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

// Group events by category
const categorized = {};
events.forEach(event => {
  const category = categorizeEvent(event);
  if (!categorized[category]) {
    categorized[category] = [];
  }
  categorized[category].push(event);
});

// Sort categories
const categoryOrder = ['Music', 'Arts & Culture', 'Workshops', 'Other'];
const sortedCategories = categoryOrder.filter(c => categorized[c]);

// Build messages
const messages = [];

// Header message
const totalEvents = events.length;
messages.push(`🗓️ **EventFinder Digest** — ${totalEvents} new events · August 17, 2026`);

// Process each category
sortedCategories.forEach(category => {
  const categoryEvents = categorized[category];
  const categoryEmojis = {
    'Music': '🎵',
    'Arts & Culture': '🎨',
    'Workshops': '🛠️',
    'Other': '📅'
  };

  const emoji = categoryEmojis[category];
  let categoryMessage = `\n${emoji} **${category}** — ${categoryEvents.length} new event${categoryEvents.length > 1 ? 's' : ''}`;

  categoryEvents.forEach(event => {
    let eventLine = `\n**${event.title}**`;

    // Date/time line
    let dateTimeLine = '';
    const dayOfWeek = formatDayOfWeek(event.instance_date);
    const date = new Date(event.instance_date);
    const dateNum = date.getDate();

    dateTimeLine += `📅 ${dayOfWeek} ${String(dateNum).padStart(2, '0')}`;

    const formattedTime = formatTime(event.instance_time);
    if (formattedTime) {
      dateTimeLine += ` at ${formattedTime}`;
    }

    if (event.venue) {
      dateTimeLine += ` · 📍 ${event.venue}`;
    }

    if (event.price) {
      dateTimeLine += ` · 💰 ${event.price}`;
    }

    eventLine += '\n' + dateTimeLine;

    // Links line
    let linksLine = '';

    // Ticket URL if different from event URL
    if (event.ticket_url && event.ticket_url !== event.event_url) {
      linksLine += `🎫 <${event.ticket_url}> · `;
    }

    // Event URL
    if (event.event_url) {
      linksLine += `🔗 <${event.event_url}> · `;
    }

    // Google Calendar add link
    const calendarDates = formatDateForCalendar(event.instance_date, event.instance_time, event.end_date);
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${urlEncode(event.title)}&dates=${calendarDates}&details=${urlEncode(event.event_url || '')}&location=${urlEncode(event.venue || '')}`;
    linksLine += `📆 <${calendarUrl}|Add event>`;

    // Listen link for music events
    if (category === 'Music') {
      linksLine += ` · 🎧 <https://www.youtube.com/results?search_query=${urlEncode(event.title)}|Listen>`;
    }

    // Ticket sale date
    if (event.ticket_sale_date) {
      const ticketDate = new Date(event.ticket_sale_date);
      const ticketDay = ticketDate.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const ticketMonth = months[ticketDate.getMonth()];
      const formattedTicketTime = event.ticket_sale_time ? ' ' + formatTime(event.ticket_sale_time) : '';
      linksLine += `\n🔔 Tickets on sale ${ticketMonth} ${ticketDay}${formattedTicketTime}`;
    }

    eventLine += '\n' + linksLine;

    // Check if adding this event would exceed 1950 char limit
    if ((categoryMessage + eventLine).length > 1900) {
      messages.push(categoryMessage);
      categoryMessage = `${emoji} **${category}** (continued)\n**${event.title}**\n${dateTimeLine}\n${linksLine}`;
    } else {
      categoryMessage += eventLine;
    }
  });

  messages.push(categoryMessage);
});

// Collect all instance IDs
const instanceIds = events.map(e => e.instance_id);

// Output JSON
const output = {
  total_events: totalEvents,
  instance_ids: instanceIds,
  messages: messages
};

console.log(JSON.stringify(output, null, 2));
