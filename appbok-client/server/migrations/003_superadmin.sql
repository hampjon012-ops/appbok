-- Superadmin: roller, salong metadata (subdomän/plan/status), system-salong
-- Kör i Supabase SQL Editor efter 001/002.

-- 1) Utöka user-roller
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff', 'superadmin'));

-- 2) Salong: demo / försäljning
ALTER TABLE salons ADD COLUMN IF NOT EXISTS subdomain TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS salons_subdomain_unique ON salons (subdomain) WHERE subdomain IS NOT NULL AND subdomain <> '';
ALTER TABLE salons ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'demo';
ALTER TABLE salons ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

UPDATE salons SET subdomain = slug WHERE subdomain IS NULL OR subdomain = '';

-- 3) Intern system-salong för superadmin-användare (unik e-post per rad via salon_id)
INSERT INTO salons (id, name, slug, subdomain, tagline, plan, status)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Appbok HQ',
  'appbok-system',
  'appbok-system',
  'Intern',
  'internal',
  'internal'
)
ON CONFLICT (slug) DO NOTHING;

-- 4) Skapa superadmin: byt e-post och kör, eller uppdatera befintlig användare:
-- UPDATE users SET role = 'superadmin', salon_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' WHERE email = 'din@epost.se';
