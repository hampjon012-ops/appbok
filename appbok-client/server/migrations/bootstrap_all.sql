-- ============================================================================
-- APPBOK: Full bootstrap (001→005). Kör EN gång mot tom databas.
-- Antingen: Supabase → SQL Editor → klistra in hela filen → Run
-- Eller: lägg DATABASE_URL (pooling) i server/.env → npm run db:bootstrap
-- ============================================================================

-- ============================================================================
-- Salon SaaS — Databasstruktur
-- Kör detta i Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- ============================================================================

-- 1. Salonger
CREATE TABLE IF NOT EXISTS salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  theme JSONB DEFAULT '{"backgroundColor":"#FAFAFA","primaryAccent":"#A89483","secondaryColor":"#EBE8E3","textColor":"#1A1A1A"}',
  contact JSONB DEFAULT '{}',
  map_url TEXT DEFAULT '',
  instagram JSONB DEFAULT '[]',
  stripe_secret_key TEXT DEFAULT '',
  stripe_publishable_key TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Användare (admin + staff)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT,                  -- NULL for Google-only staff
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  title TEXT DEFAULT '',               -- "Senior Kolorist"
  photo_url TEXT DEFAULT '',
  google_id TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (salon_id, email)
);

-- 3. Kategorier
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tjänster
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_label TEXT DEFAULT '',         -- "Från 750 kr"
  price_amount INT NOT NULL DEFAULT 0, -- 75000 (öre)
  duration TEXT DEFAULT '',            -- "60 min"
  duration_minutes INT DEFAULT 60,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bokningar
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  stylist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  duration_minutes INT DEFAULT 60,
  amount_paid INT DEFAULT 0,           -- öre
  stripe_session_id TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  google_event_id TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Google Calendar tokens
CREATE TABLE IF NOT EXISTS calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Inbjudningar
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  email TEXT,
  token TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'staff',
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Index för snabba sökningar ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_salon_date ON bookings(salon_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_stylist ON bookings(stylist_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_services_salon ON services(salon_id);
CREATE INDEX IF NOT EXISTS idx_users_salon ON users(salon_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- ── Row Level Security (RLS) ───────────────────────────────────────────────
-- Aktiveras per tabell — varje salong ser bara sin egen data
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Grundläggande policy: authenticated users ser sin salongs data
-- (Mer granulerade policies läggs till i nästa steg)

-- ── 002 seed ─────────────────────────────────────────────────────────────
-- ============================================================================
-- Seed-data: Colorisma (demosalong)
-- Kör EFTER 001_schema.sql
-- ============================================================================

-- 1. Salong
INSERT INTO salons (id, name, slug, tagline, logo_url, theme, contact, map_url, instagram)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Colorisma',
  'colorisma',
  'Upplev hantverk och personlig service i en lugn och modern miljö.',
  '/logo.png',
  '{"backgroundColor":"#FAFAFA","primaryAccent":"#A89483","secondaryColor":"#EBE8E3","textColor":"#1A1A1A"}',
  '{"address":"Sveavägen 42, 111 34 Stockholm","phone":"08-123 456 78","hours":["Måndag — Fredag: 09:00 — 19:00","Lördag: 10:00 — 16:00","Söndag: Stängt"]}',
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2035.152436735467!2d18.0685!3d59.3293!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x465f9d511ea63683%3A0xe5eb6c4c34a2e5d5!2sStockholm%20Centralstation!5e0!3m2!1ssv!2sse!4v1700000000000!5m2!1ssv!2sse',
  '["https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=800","https://images.unsplash.com/photo-1620331311520-246422fd82f9?q=80&w=800","https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=800","https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800","https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=800","https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=800"]'
);

-- 2. Admin-användare (demo-lösenord: Admin123! — bcrypt)
INSERT INTO users (id, salon_id, email, password_hash, name, role, title)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'admin@colorisma.se',
  '$2b$10$3q6bW2.6ff5aIpmuHPoReOpbaaWmZshm1rRr7p1GrwbpNvoyX8WTK',
  'Hampus Jonsson',
  'admin',
  'Salongägare'
);

-- 3. Staff
INSERT INTO users (id, salon_id, email, name, role, title, photo_url) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'emma@colorisma.se', 'Emma Lindqvist', 'staff', 'Senior Kolorist', 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'marcus@colorisma.se', 'Marcus Holm', 'staff', 'Frisör & Barberer', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'sofia@colorisma.se', 'Sofia Berg', 'staff', 'Balayage Specialist', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80');

-- 4. Kategorier
INSERT INTO categories (id, salon_id, name, description, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Klippning', 'Professionell klippning anpassad efter ditt hår och din stil.', 1),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Färgning', 'Helcolor, slingor eller balayage med premium produkter.', 2),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Behandling', 'Djupverkande hårvård och keratinbehandling.', 3);

-- 5. Tjänster
INSERT INTO services (salon_id, category_id, name, price_label, price_amount, duration, duration_minutes, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Klippning inkl. tvätt & fön', 'Från 750 kr', 75000, '60 min', 60, 1),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Klippning kort hår (Maskin/Sax)', 'Från 550 kr', 55000, '45 min', 45, 2),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Barnklippning (upp till 12 år)', 'Från 450 kr', 45000, '30 min', 30, 3),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Skägg & trimning', 'Från 350 kr', 35000, '30 min', 30, 4),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Balayage / Ombre', 'Från 1 800 kr', 180000, '180 min', 180, 1),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Folieslingor - Hel', 'Från 1 500 kr', 150000, '150 min', 150, 2),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Utväxt (Max 3cm)', 'Från 1 200 kr', 120000, '90 min', 90, 3),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Olaplex Stand-Alone', 'Från 600 kr', 60000, '45 min', 45, 1),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Tvätt & Fön', 'Från 450 kr', 45000, '30 min', 30, 2);

-- ── 003 superadmin ─────────────────────────────────────────────────────
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

-- ── 004 salon meta ─────────────────────────────────────────────────────
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

-- ── 005 is_popular ─────────────────────────────────────────────────────
-- Tjänster markerade för kundvy-sektionen "Våra mest populära tjänster"
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT false;

-- Demo-salong Colorisma: tre populära (matchar namn i 002_seed.sql)
UPDATE services
SET is_popular = true
WHERE salon_id = 'a0000000-0000-0000-0000-000000000001'
  AND name IN (
    'Klippning inkl. tvätt & fön',
    'Balayage / Ombre',
    'Olaplex Stand-Alone'
  );

-- ── 006 admin colorisma superadmin ─────────────────────────────────────
-- admin@colorisma.se som plattforms-superadmin (kopplad till system-salongen Appbok HQ)
-- Kör i Supabase SQL Editor om databasen redan finns (eller ingår i bootstrap_all.sql).

UPDATE users
SET
  role = 'superadmin',
  salon_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
WHERE lower(email) = 'admin@colorisma.se';

-- ── 007 platform superadmin + demo bookings ────────────────────────────
-- Plattforms-superadmin: superadmin@appbok.se (lösen: Admin123! — samma bcrypt som demo i 002_seed)
-- Ulf Jonsson som stylist vid Colorisma
-- Demobokningar så Bokningar-fliken visar data
--
-- Kör i Supabase SQL Editor (eller npm run db:migrate:007 med DATABASE_URL i server/.env).

INSERT INTO users (id, salon_id, email, password_hash, name, role, title)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'superadmin@appbok.se',
  '$2b$10$3q6bW2.6ff5aIpmuHPoReOpbaaWmZshm1rRr7p1GrwbpNvoyX8WTK',
  'Superadmin',
  'superadmin',
  'Superadmin'
)
ON CONFLICT (salon_id, email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'superadmin',
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  active = true;

-- Marcus → Ulf (gamla seed) eller säkerställ namn/e-post
UPDATE users
SET
  email = 'ulf@colorisma.se',
  name = 'Ulf Jonsson',
  title = 'Frisör & Stylist'
WHERE salon_id = 'a0000000-0000-0000-0000-000000000001'
  AND (
    id = 'c0000000-0000-0000-0000-000000000002'
    OR email = 'marcus@colorisma.se'
  );

INSERT INTO bookings (salon_id, service_id, stylist_id, customer_name, customer_email, customer_phone, booking_date, booking_time, duration_minutes, status, amount_paid)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  (SELECT id FROM services WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Klippning inkl. tvätt & fön' LIMIT 1),
  (SELECT id FROM users WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND email = 'ulf@colorisma.se' AND role = 'staff' LIMIT 1),
  'Anna Andersson',
  'anna@exempel.se',
  '070-111 22 33',
  (CURRENT_DATE + INTERVAL '1 day')::date,
  '10:00:00',
  60,
  'confirmed',
  75000
WHERE NOT EXISTS (
  SELECT 1 FROM bookings WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND customer_email = 'anna@exempel.se'
);

INSERT INTO bookings (salon_id, service_id, stylist_id, customer_name, customer_email, booking_date, booking_time, duration_minutes, status)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  (SELECT id FROM services WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Balayage / Ombre' LIMIT 1),
  (SELECT id FROM users WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND email = 'emma@colorisma.se' AND role = 'staff' LIMIT 1),
  'Björn Svensson',
  'bjorn@exempel.se',
  (CURRENT_DATE + INTERVAL '3 day')::date,
  '14:00:00',
  180,
  'confirmed'
WHERE NOT EXISTS (
  SELECT 1 FROM bookings WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND customer_email = 'bjorn@exempel.se'
);

INSERT INTO bookings (salon_id, service_id, stylist_id, customer_name, customer_phone, booking_date, booking_time, duration_minutes, status)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  (SELECT id FROM services WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Tvätt & Fön' LIMIT 1),
  (SELECT id FROM users WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND email = 'sofia@colorisma.se' AND role = 'staff' LIMIT 1),
  'Cecilia Holm',
  '073-999 88 77',
  (CURRENT_DATE + INTERVAL '5 day')::date,
  '11:30:00',
  30,
  'confirmed'
WHERE NOT EXISTS (
  SELECT 1 FROM bookings WHERE salon_id = 'a0000000-0000-0000-0000-000000000001' AND customer_phone = '073-999 88 77'
);

ALTER TABLE salons ADD COLUMN IF NOT EXISTS hide_onboarding_widget BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS verification_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS salons_verification_token_unique
  ON salons (verification_token)
  WHERE verification_token IS NOT NULL;
