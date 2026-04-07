import { DEFAULT_BOOKING_ACCENT_HEX } from './defaultBookingAccent.js';

/**
 * Plattformsstandard för salongstema (färger) — samma som mobil-preview / Colorisma.
 * Används när theme i DB saknas eller är ofullständig. Synka med `src/lib/themePresets.js` → DEFAULT_PLATFORM_SALON_THEME.
 */
export const DEFAULT_PLATFORM_SALON_THEME = {
  backgroundColor: '#F5F4F0',
  primaryAccent: DEFAULT_BOOKING_ACCENT_HEX,
  secondaryColor: '#EBE8E3',
  textColor: '#383838',
};
