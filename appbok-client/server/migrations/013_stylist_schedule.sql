-- Per-stylist arbetsschema (JSON) och engångsblockeringar
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_schedule JSONB DEFAULT NULL;

COMMENT ON COLUMN users.work_schedule IS 'Arbetstider + lunch: { mode, days[], lunch{} } — se server/lib/stylistAvailability.js';

CREATE TABLE IF NOT EXISTS stylist_blocked_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'other' CHECK (block_type IN ('sick', 'vacation', 'other')),
  time_mode TEXT NOT NULL DEFAULT 'full_day' CHECK (time_mode IN ('full_day', 'range')),
  time_from TIME,
  time_to TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT stylist_blocked_days_range_ok CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_stylist_blocked_days_user ON stylist_blocked_days(user_id);
CREATE INDEX IF NOT EXISTS idx_stylist_blocked_days_salon_dates ON stylist_blocked_days(salon_id, start_date, end_date);
