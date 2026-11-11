-- Additive, anonymous application funnel. No personal information or click ids.
CREATE TABLE IF NOT EXISTS analytics_applications (
  event_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('visit', 'start', 'accepted')),
  session_id UUID,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  content TEXT,
  term TEXT,
  landing TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_applications_created ON analytics_applications (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_applications_session ON analytics_applications (session_id);
