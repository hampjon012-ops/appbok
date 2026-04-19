-- Migration: 019_storage_logos_bucket.sql
-- Skapar den publika "logos"-bucketen i Supabase Storage.
-- Körs en gång per miljö (dev/prod) via: npm run db:migrate
-- Bucketen måste finnas innan salongsadministratörer kan ladda upp logotyper.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,                                -- 2 MB i byte
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public           = true,
  file_size_limit  = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/svg+xml'];
