-- EventFinder Database Schema
-- SQLite database for tracking event sources, discovered events, and sent digests

-- =============================================================================
-- SOURCES: Event websites and calendars we monitor
-- =============================================================================

CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Basic info
  url TEXT NOT NULL UNIQUE,           -- Source URL (e.g., https://thepalomino.ca/live-events/)
  name TEXT NOT NULL,                 -- User-friendly name (e.g., "The Palomino Live Events")
  description TEXT,                   -- Optional description for context and relevance matching

  -- Timestamps
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_checked_at TIMESTAMP,          -- Last time we attempted to check this source
  last_success_at TIMESTAMP,          -- Last successful check that found events

  -- Status
  active INTEGER NOT NULL DEFAULT 1,  -- 1=active, 0=disabled
  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  -- Error tracking
  error_message TEXT,                 -- Full error details for debugging
  error_type TEXT,                    -- 'timeout', '404', '500', 'parse_error', 'ssl_error', 'no_events', etc.

  -- Source type
  type TEXT NOT NULL DEFAULT 'event' CHECK (type IN ('event', 'flyer')),

  -- Constraints
  CHECK (active IN (0, 1))
);

CREATE INDEX idx_sources_active ON sources(active);
CREATE INDEX idx_sources_last_checked ON sources(last_checked_at);
CREATE INDEX idx_sources_type ON sources(type);

-- =============================================================================
-- EVENTS: Discovered events with base information
-- =============================================================================

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identity (for duplicate detection)
  event_hash TEXT NOT NULL UNIQUE,    -- hash(title + venue) for deduplication

  -- Basic event info
  title TEXT NOT NULL,                -- Event title
  venue TEXT,                         -- Venue name/location
  description TEXT,                   -- Event description

  -- Pricing
  price TEXT,                         -- Price as text: "$25", "Free", "$15-25", etc.

  -- URLs
  event_url TEXT,                     -- Link to event detail page
  ticket_url TEXT,                    -- Direct ticket purchase link

  -- Source tracking
  source_id INTEGER NOT NULL,         -- Which source discovered this event
  source_url TEXT NOT NULL,           -- URL where we found it (for reference)

  -- Discovery tracking
  discovered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX idx_events_hash ON events(event_hash);
CREATE INDEX idx_events_source ON events(source_id);
CREATE INDEX idx_events_discovered ON events(discovered_at);

-- =============================================================================
-- EVENT_INSTANCES: Specific dates/times for events
-- =============================================================================
-- Handles single events, recurring events, and multi-day events
-- Example: "Christmas Tea" on Nov 30, Dec 7, Dec 21 = 3 instances

CREATE TABLE event_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Link to parent event
  event_id INTEGER NOT NULL,

  -- Date and time
  instance_date DATE NOT NULL,        -- ISO 8601: YYYY-MM-DD
  instance_time TIME,                 -- ISO 8601: HH:MM:SS (null if no specific time)
  end_date DATE,                      -- For multi-day events (null for single-day)

  -- Timezone
  timezone TEXT NOT NULL DEFAULT 'America/Edmonton',  -- IANA timezone

  -- Ticket sale date (if applicable)
  ticket_sale_date DATE,              -- When tickets go on sale
  ticket_sale_time TIME,

  -- Foreign keys
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX idx_instances_event ON event_instances(event_id);
CREATE INDEX idx_instances_date ON event_instances(instance_date);
CREATE INDEX idx_instances_ticket_sale ON event_instances(ticket_sale_date);

-- =============================================================================
-- SENT_EVENTS: Track which events we've notified the user about
-- =============================================================================

CREATE TABLE sent_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Which event instance
  event_id INTEGER NOT NULL,          -- Link to events table
  instance_id INTEGER,                -- Optional: specific instance (if tracking per-date)

  -- Sent tracking
  sent_at TIMESTAMP,                    -- NULL until actually sent

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'excluded', 'skipped'
  reason TEXT,                             -- Why matched/excluded/skipped

  -- Foreign keys
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id) REFERENCES event_instances(id) ON DELETE CASCADE,

  -- Constraints
  CHECK (status IN ('pending', 'sent', 'excluded', 'skipped'))
);

CREATE INDEX idx_sent_events_event ON sent_events(event_id);
CREATE INDEX idx_sent_events_status ON sent_events(status);
CREATE INDEX idx_sent_events_sent_at ON sent_events(sent_at);

-- Prevent duplicate sends of the same event
CREATE UNIQUE INDEX idx_sent_events_unique ON sent_events(event_id, instance_id);

-- =============================================================================
-- VIEWS: Useful queries
-- =============================================================================

-- View: Active sources with their statistics
CREATE VIEW v_sources_stats AS
SELECT
  s.id,
  s.url,
  s.name,
  s.description,
  s.active,
  s.last_checked_at,
  s.last_success_at,
  s.consecutive_failures,
  s.error_message,
  s.error_type,
  COUNT(DISTINCT e.id) as total_events,
  COUNT(DISTINCT CASE
    WHEN ei.instance_date >= date('now', '-30 days')
    THEN e.id
  END) as recent_events
FROM sources s
LEFT JOIN events e ON e.source_id = s.id
LEFT JOIN event_instances ei ON ei.event_id = e.id
GROUP BY s.id;

-- View: Upcoming events that haven't been sent
CREATE VIEW v_unsent_upcoming_events AS
SELECT
  e.id as event_id,
  e.title,
  e.venue,
  e.description,
  e.price,
  e.event_url,
  ei.id as instance_id,
  ei.instance_date,
  ei.instance_time,
  ei.timezone,
  s.name as source_name,
  s.url as source_url
FROM events e
JOIN event_instances ei ON ei.event_id = e.id
JOIN sources s ON s.id = e.source_id
WHERE ei.instance_date >= date('now')  -- Future events only
  AND e.id NOT IN (
    SELECT event_id
    FROM sent_events
    WHERE status = 'sent'
  )
ORDER BY ei.instance_date, ei.instance_time;

-- View: Events sent in last digest
CREATE VIEW v_last_digest AS
SELECT
  e.title,
  e.venue,
  ei.instance_date,
  ei.instance_time,
  se.sent_at,
  s.name as source_name
FROM sent_events se
JOIN events e ON e.id = se.event_id
JOIN event_instances ei ON ei.id = se.instance_id
JOIN sources s ON s.id = e.source_id
WHERE se.status = 'sent'
  AND se.sent_at = (SELECT MAX(sent_at) FROM sent_events WHERE status = 'sent')
ORDER BY ei.instance_date;

-- =============================================================================
-- FULL-TEXT SEARCH (FTS5)
-- =============================================================================
-- Content table referencing events; triggers keep index in sync.
-- Porter stemmer: "jazz" matches "jazzy", "perform" matches "performance", etc.

CREATE VIRTUAL TABLE events_fts USING fts5(
  title,
  description,
  venue,
  content='events',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Populate index from existing rows (no-op on fresh DB)
INSERT INTO events_fts(events_fts) VALUES('rebuild');

-- Keep index in sync with events table
CREATE TRIGGER events_ai AFTER INSERT ON events BEGIN
  INSERT INTO events_fts(rowid, title, description, venue)
  VALUES (new.id, new.title, new.description, new.venue);
END;

CREATE TRIGGER events_ad AFTER DELETE ON events BEGIN
  INSERT INTO events_fts(events_fts, rowid, title, description, venue)
  VALUES ('delete', old.id, old.title, old.description, old.venue);
END;

CREATE TRIGGER events_au AFTER UPDATE ON events BEGIN
  INSERT INTO events_fts(events_fts, rowid, title, description, venue)
  VALUES ('delete', old.id, old.title, old.description, old.venue);
  INSERT INTO events_fts(rowid, title, description, venue)
  VALUES (new.id, new.title, new.description, new.venue);
END;

-- =============================================================================
-- FLYER_ITEMS: Grocery deals extracted from flyer pages
-- =============================================================================

CREATE TABLE flyer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identity (for duplicate detection)
  item_hash TEXT NOT NULL UNIQUE,       -- hash(item_name + brand + sale_price + source_id + sale_end)

  -- Item info
  item_name TEXT NOT NULL,              -- "Boneless Chicken Breast"
  brand TEXT,                           -- "Maple Leaf", etc.
  description TEXT,                     -- "Family pack, ~1.5kg"

  -- Pricing
  sale_price TEXT NOT NULL,             -- "$4.99/lb", "2 for $5", "50% off"
  regular_price TEXT,                   -- "$7.99/lb" (null if unknown)
  unit TEXT,                            -- "/lb", "/kg", "/ea", "/100g"

  -- Categorization
  category TEXT,                        -- "Produce", "Meat & Seafood", "Dairy", etc.

  -- Validity period
  sale_start DATE,                      -- Flyer validity start
  sale_end DATE,                        -- Flyer validity end

  -- URLs
  item_url TEXT,                        -- Link to the item or flyer page
  image_url TEXT,                       -- Product image

  -- Source tracking
  source_id INTEGER NOT NULL,
  source_url TEXT NOT NULL,

  -- Discovery tracking
  discovered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX idx_flyer_items_hash ON flyer_items(item_hash);
CREATE INDEX idx_flyer_items_source ON flyer_items(source_id);
CREATE INDEX idx_flyer_items_sale_end ON flyer_items(sale_end);
CREATE INDEX idx_flyer_items_discovered ON flyer_items(discovered_at);
CREATE INDEX idx_flyer_items_category ON flyer_items(category);

-- =============================================================================
-- SENT_FLYER_ITEMS: Track which flyer deals we've posted to Discord
-- =============================================================================

CREATE TABLE sent_flyer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Which flyer item
  flyer_item_id INTEGER NOT NULL,

  -- Sent tracking
  sent_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'skipped'

  -- Foreign keys
  FOREIGN KEY (flyer_item_id) REFERENCES flyer_items(id) ON DELETE CASCADE,

  -- Constraints
  CHECK (status IN ('pending', 'sent', 'skipped'))
);

CREATE UNIQUE INDEX idx_sent_flyer_items_unique ON sent_flyer_items(flyer_item_id);
CREATE INDEX idx_sent_flyer_items_status ON sent_flyer_items(status);

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- No initial data - user will add sources via /add-source command
