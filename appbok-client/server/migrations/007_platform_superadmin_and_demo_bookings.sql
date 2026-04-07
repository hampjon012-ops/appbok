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
