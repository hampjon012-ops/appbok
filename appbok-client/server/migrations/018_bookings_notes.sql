-- Kundmeddelande vid bokning (kan redan finnas i äldre 001_schema / bootstrap)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;
