-- Flera tjänster per bokning (snapshot som JSONB; service_id pekar på första tjänsten för bakåtkomp.)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_services JSONB DEFAULT NULL;
