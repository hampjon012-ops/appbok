-- Phase 6b: Betalning på plats – ny kolumn allow_pay_on_site
-- Kör i Supabase SQL Editor
-- https://supabase.com/dashboard/project/vurlgqesosrwmljadxcl/sql

ALTER TABLE salons ADD COLUMN IF NOT EXISTS allow_pay_on_site BOOLEAN NOT NULL DEFAULT true;