-- Add reminder_sent column to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;