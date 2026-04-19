-- E-postverifiering efter onboarding
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS verification_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS salons_verification_token_unique
  ON salons (verification_token)
  WHERE verification_token IS NOT NULL;
