-- Phase 5 + 6: Lägger till fält för trial-period och Stripe-anslutning
-- Kör i Supabase SQL Editor
-- https://supabase.com/dashboard/project/vurlgqesosrwmljadxcl/sql

ALTER TABLE salons ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
