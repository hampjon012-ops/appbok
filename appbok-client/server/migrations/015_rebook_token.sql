-- Ombokningslänk (SMS vid stylist-blockering)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rebook_token UUID UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rebook_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_rebook_token ON bookings(rebook_token) WHERE rebook_token IS NOT NULL;

-- Ny status: ombokad via kundlänk
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed','cancelled','completed','no_show','rebooked'));

COMMENT ON COLUMN bookings.rebook_token IS 'Engångstoken för /rebook — kundens ombokningslänk';
COMMENT ON COLUMN bookings.rebook_expires_at IS 'Token utgår (normalt 7 dagar efter generering)';
