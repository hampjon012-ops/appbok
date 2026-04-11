-- Lägger till nya fält för Phase 2 Onboarding-flödet (Bokadirekt-länk)
-- Kör i Supabase SQL Editor

ALTER TABLE salons ADD COLUMN IF NOT EXISTS bokadirekt_url TEXT;

-- Ändra default-status (om möjligt i framtida uppdateringar, superadmin gör detta explicit i koden, så vi behöver inte ändra tabell-deff, men vi uppdaterar befintliga om de saknas)
UPDATE salons SET status = 'live' WHERE status IS NULL;
