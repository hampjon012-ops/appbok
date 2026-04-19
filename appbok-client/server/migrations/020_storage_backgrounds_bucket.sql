-- Migration: 020_storage_backgrounds_bucket.sql
-- Skapar den publika "backgrounds"-bucketen i Supabase Storage.
-- För hero-bakgrundsbilder (salongens bokningssida).
-- Körs via: npm run db:migrate
-- Bucketen måste finnas innan salongsadministratörer kan ladda upp bakgrundsbilder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  true,
  10485760,                                          -- 10 MB i byte
  ARRAY['image/jpeg', 'image/webp', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit  = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/webp', 'image/png'];
