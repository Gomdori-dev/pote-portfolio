-- Artist portal + admin approval schema.
-- Run once, manually, after the Neon integration's connection string exists:
--   node scripts/migrate-artist-portal.mjs
-- Safe to re-run (CREATE ... IF NOT EXISTS throughout).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS artist_credentials (
  artist_slug TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-row table: the admin password starts as the ADMIN_PASSWORD env var
-- (see isAdminAuthorized/verifyAdminPassword) and only gets a row here once
-- the admin actually changes it from /admin/submissions, at which point the
-- DB value takes over.
CREATE TABLE IF NOT EXISTS admin_credentials (
  id INTEGER PRIMARY KEY DEFAULT 1,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS artwork_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  title_ko TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_ko TEXT NOT NULL,
  description_en TEXT NOT NULL,
  details_ko TEXT NOT NULL,
  details_en TEXT NOT NULL,
  mood_key TEXT NOT NULL,
  status_key TEXT NOT NULL DEFAULT 'available',
  price TEXT,
  image_urls JSONB NOT NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Added 2026-09-24: optional "주요 색상" from /artist-portal, stored as the
-- artist typed it (comma-separated, e.g. "화이트, 오커, 블루").
ALTER TABLE artwork_submissions ADD COLUMN IF NOT EXISTS palette_ko TEXT NOT NULL DEFAULT '';
ALTER TABLE artwork_submissions ADD COLUMN IF NOT EXISTS palette_en TEXT NOT NULL DEFAULT '';

-- Added 2026-09-25: frame / hanging / edition / certificate details from the
-- portal's "액자·설치" section. Shape is ArtworkExtras in src/lib/artwork-extras.ts;
-- parseArtworkExtras() sanitises it on the way in and out.
ALTER TABLE artwork_submissions ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Added 2026-09-27: automatic review result (src/lib/artwork-review.ts).
-- NULL until the reviewer has looked at the row.
ALTER TABLE artwork_submissions ADD COLUMN IF NOT EXISTS ai_review JSONB;

-- Added 2026-09-27: site-side controls for any artwork, static (artworks.ts)
-- or portal-submitted ("submission-<uuid>"): taken down, deleted (static works
-- can't be removed from code at runtime, so "deleted" hides them for good), or
-- a status override such as "sold". See src/lib/artwork-controls.ts.
CREATE TABLE IF NOT EXISTS artwork_controls (
  slug TEXT PRIMARY KEY,
  artist_slug TEXT NOT NULL,
  hidden BOOLEAN NOT NULL DEFAULT false,
  deleted BOOLEAN NOT NULL DEFAULT false,
  status_key TEXT,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Artist edits to titles and descriptions of hand-registered artworks.
-- Portal submissions keep their copy in artwork_submissions instead.
CREATE TABLE IF NOT EXISTS artwork_copy_edits (
  slug TEXT PRIMARY KEY,
  artist_slug TEXT NOT NULL,
  title_ko TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_ko TEXT NOT NULL,
  description_en TEXT NOT NULL,
  details_ko TEXT NOT NULL DEFAULT '',
  details_en TEXT NOT NULL DEFAULT '',
  price TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE artwork_copy_edits ADD COLUMN IF NOT EXISTS details_ko TEXT NOT NULL DEFAULT '';
ALTER TABLE artwork_copy_edits ADD COLUMN IF NOT EXISTS details_en TEXT NOT NULL DEFAULT '';
ALTER TABLE artwork_copy_edits ADD COLUMN IF NOT EXISTS price TEXT;

-- Main photo replacements for hand-registered artworks. Portal submissions
-- store their first photo in artwork_submissions.image_urls instead.
CREATE TABLE IF NOT EXISTS artwork_main_images (
  slug TEXT PRIMARY KEY,
  artist_slug TEXT NOT NULL,
  url TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added 2026-09-28: condition photos (signature, back, edge — PROOF_KEYS in
-- src/lib/artwork-extras.ts) an artist adds from the portal's "내 작품 관리" to a
-- work that is already on the site. Only for static works (artworks.ts):
-- portal works keep theirs in artwork_submissions.extras.proof. One per key.
-- See src/lib/artwork-proof-photos.ts.
CREATE TABLE IF NOT EXISTS artwork_proof_photos (
  slug TEXT NOT NULL,
  artist_slug TEXT NOT NULL,
  proof_key TEXT NOT NULL CHECK (proof_key IN ('signature', 'back', 'edge')),
  url TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, proof_key)
);

-- Added 2026-09-29: daily visitor analytics. IP is captured for exclusion
-- (ADMIN_IPS env var), path for understanding which pages attract visitors.
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  path TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_ip_path ON visits(ip, path);
