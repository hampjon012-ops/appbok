-- Lägger till kolumner för superadmin: subdomain, plan, status
-- Kör i Supabase SQL Editor (efter 001–003)

ALTER TABLE salons ADD COLUMN IF NOT EXISTS subdomain TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'demo';
ALTER TABLE salons ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Fyll i subdomain från slug för befintliga salonger
UPDATE salons SET subdomain = slug WHERE subdomain IS NULL OR subdomain = '';

-- Unikt index på subdomain (ignore duplicates)
-- Om du har duplicerade subdomains, rätta till dem först:
-- UPDATE salons SET subdomain = slug || '-1' WHERE id IN (SELECT id FROM salons WHERE subdomain IN (SELECT subdomain FROM salons GROUP BY subdomain HAVING count(*) > 1));
CREATE UNIQUE INDEX IF NOT EXISTS salons_subdomain_unique ON salons (subdomain) WHERE subdomain IS NOT NULL AND subdomain <> '';
