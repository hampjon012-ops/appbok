-- Add stripe_payment_intent_id to bookings for full Stripe refund support
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;