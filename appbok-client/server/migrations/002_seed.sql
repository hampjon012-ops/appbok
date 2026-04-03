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
