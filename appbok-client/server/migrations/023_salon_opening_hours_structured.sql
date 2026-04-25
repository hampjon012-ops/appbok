-- Adds opening_hours_configured flag to salons table
-- and prepares contact JSONB for structured opening hours storage
ALTER TABLE salons ADD COLUMN IF NOT EXISTS opening_hours_configured BOOLEAN NOT NULL DEFAULT false;
