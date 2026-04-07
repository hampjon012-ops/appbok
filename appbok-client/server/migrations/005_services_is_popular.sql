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
