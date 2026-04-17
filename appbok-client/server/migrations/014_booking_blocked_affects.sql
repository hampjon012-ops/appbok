-- Markera bokningar som påverkade av stylist-blockering (sjuk, semester, ledig)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS blocked_affects_booking BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN bookings.blocked_affects_booking IS
  'True när en stylist-blockering (sjuk/vacation/other) täcker bokningsdatumet —
   används för att visa sammanfattning och undvika att skicka dubbla SMS.';
