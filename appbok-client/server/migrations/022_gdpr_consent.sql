-- DEL 1: GDPR consent fields + audit trail
-- Adds marketing_consent + timestamps to bookings, and an anonymization audit table.

-- ── bookings: marketing consent ──────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS consent_sms_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS consent_marketing_at TIMESTAMPTZ;

-- ── audit trail for GDPR anonymizations ────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdpr_anonymizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    UUID        REFERENCES salons(id) ON DELETE SET NULL,
  booking_id  UUID        REFERENCES bookings(id) ON DELETE SET NULL,
  reason      TEXT        NOT NULL,
  anonymized_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gdpr_anonymizations IS 'GDPR Article 17 audit log — records every time a customer record is anonymized.';