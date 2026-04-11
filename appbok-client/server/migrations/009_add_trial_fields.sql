-- Kör denna SQL i Supabase SQL Editor (https://supabase.com/dashboard/project/vurlgqesosrwmljadxcl/sql)
-- Lägger till kolumner för Phase 5 trial-period

ALTER TABLE salons ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
