-- Add subscription billing columns to salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';
