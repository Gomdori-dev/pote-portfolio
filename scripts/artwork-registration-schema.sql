-- Additive migration. No existing artwork rows are modified.
CREATE TABLE IF NOT EXISTS artwork_registration_details (
  slug TEXT PRIMARY KEY,
  artist_slug TEXT NOT NULL,
  extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  price TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
