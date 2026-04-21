-- Migration: 021_portfolio_images.sql
-- Lägger till portfolio_images (TEXT[]) på salons.
-- Instagram-handle fortsätter leva i contact.instrument_handle ( contacts).
--
-- Kör via: npm run db:migrate
-- Eller kör i Supabase SQL Editor.

ALTER TABLE salons ADD COLUMN IF NOT EXISTS portfolio_images TEXT[] DEFAULT '{}';

-- Lägg också till Instagram-ikon i storage buckets om den inte finns
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'galleries',
  'galleries',
  true,
  10485760,                                          -- 10 MB
  ARRAY['image/jpeg', 'image/webp', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit  = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/webp', 'image/png'];