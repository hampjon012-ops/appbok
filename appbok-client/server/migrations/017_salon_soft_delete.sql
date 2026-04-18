-- Soft delete: salonger kan markeras som borttagna utan att radera rader.
ALTER TABLE salons ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- status är TEXT; värdet 'deleted' används tillsammans med deleted_at (se serverlogik).
