import {
  DEFAULT_BOOKING_ACCENT_HEX,
  LEGACY_BEIGE_ACCENT_HEX,
  LEGACY_BOOKING_ACCENT_HEX,
} from './defaultBookingAccent.js';
import { DEFAULT_PLATFORM_SALON_THEME } from './defaultSalonTheme.js';

function normalizeAccentKey(pa) {
  const s = String(pa ?? '').trim().toLowerCase();
  if (!s) return '';
  return s.startsWith('#') ? s : `#${s}`;
}

function pickNonEmptyString(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s || null;
}

/**
 * Fullständigt standardtema om salong saknar sparade fält (samma som mobil-preview).
 * Normaliserar äldre accentfärger. Muterar på plats (API-svar före res.json), ingen DB-skrivning.
 */
export function ensureSalonThemeAccent(salon) {
  if (!salon || typeof salon !== 'object') return;

  const incoming =
    salon.theme && typeof salon.theme === 'object' && !Array.isArray(salon.theme)
      ? salon.theme
      : {};

  const merged = { ...DEFAULT_PLATFORM_SALON_THEME };

  for (const key of ['backgroundColor', 'secondaryColor', 'textColor']) {
    const picked = pickNonEmptyString(incoming[key]);
    if (picked) merged[key] = picked;
  }

  const primaryRaw = pickNonEmptyString(incoming.primaryAccent);
  if (primaryRaw) {
    const k = normalizeAccentKey(primaryRaw);
    if (k === LEGACY_BOOKING_ACCENT_HEX || k === LEGACY_BEIGE_ACCENT_HEX) {
      merged.primaryAccent = DEFAULT_BOOKING_ACCENT_HEX;
    } else if (/^#[0-9a-f]{6}$/.test(k)) {
      merged.primaryAccent = k;
    }
  }

  if (Object.prototype.hasOwnProperty.call(incoming, 'backgroundImageUrl')) {
    merged.backgroundImageUrl = String(incoming.backgroundImageUrl ?? '').trim();
  }

  salon.theme = merged;
}
