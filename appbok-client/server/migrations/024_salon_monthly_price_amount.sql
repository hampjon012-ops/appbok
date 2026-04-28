-- Superadmin: individuellt månadspris per salong.
-- Lagras i öre. Standard 200000 = 2 000 kr/mån.

ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS monthly_price_amount INT NOT NULL DEFAULT 200000;

UPDATE salons
SET monthly_price_amount = 200000
WHERE monthly_price_amount IS NULL;
