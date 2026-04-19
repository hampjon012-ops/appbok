-- Dölj "Kom igång"-kortet på dashboard när användaren stängt det.
ALTER TABLE salons ADD COLUMN IF NOT EXISTS hide_onboarding_widget BOOLEAN NOT NULL DEFAULT false;
