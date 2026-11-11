-- Visit → artwork view → inquiry open → inquiry sent funnel (2026-10-20).
-- Anonymous only: random browser ids, no IP, name, email, phone or message.
-- Additive and re-runnable; apply with `node scripts/migrate-analytics.mjs`.

CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id UUID PRIMARY KEY,
  visitor_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_count INTEGER NOT NULL DEFAULT 1,
  landing_path TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  referrer_host TEXT,
  device TEXT NOT NULL CHECK (device IN ('mobile', 'tablet', 'desktop'))
);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor ON analytics_sessions (visitor_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES analytics_sessions (session_id),
  event_type TEXT NOT NULL CONSTRAINT analytics_events_event_type_check CHECK (event_type IN ('page_view', 'artwork_view', 'inquiry_open', 'inquiry_start', 'inquiry_invalid', 'inquiry_error')),
  path TEXT NOT NULL,
  artwork_slug TEXT,
  artworks TEXT[] NOT NULL DEFAULT '{}',
  intent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events (session_id, created_at);
-- 2026-10-30: inquiry form steps. Re-running is safe: the check is replaced with the same list.
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_event_type_check;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_event_type_check CHECK (event_type IN ('page_view', 'artwork_view', 'inquiry_open', 'inquiry_start', 'inquiry_invalid', 'inquiry_error'));

-- One row per inquiry the mail provider accepted (not inbox delivery).
-- session_id has no foreign key: a failed visit beacon must not drop the inquiry.
CREATE TABLE IF NOT EXISTS analytics_inquiries (
  inquiry_id UUID PRIMARY KEY,
  -- Receipt number shown to the visitor and in the mail subject (P1020-7K2Q, no year).
  receipt_ref TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('artwork', 'general', 'collaboration', 'artist_application', 'feedback', 'other')),
  intent TEXT,
  artworks TEXT[] NOT NULL DEFAULT '{}',
  session_id UUID,
  visitor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_inquiries_created ON analytics_inquiries (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_inquiries_session ON analytics_inquiries (session_id);
