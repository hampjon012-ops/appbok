import { DEFAULT_BOOKING_ACCENT_HEX } from './defaultBookingAccent.js';

/**
 * Global plattformsstandard (mobil-preview / fallback när salong saknar tema i DB).
 * Måste matcha `server/lib/defaultSalonTheme.js` → DEFAULT_PLATFORM_SALON_THEME.
 */
export const DEFAULT_PLATFORM_SALON_THEME = {
  backgroundColor: '#F5F4F0',
  primaryAccent: DEFAULT_BOOKING_ACCENT_HEX,
  secondaryColor: '#EBE8E3',
  textColor: '#383838',
};

/**
 * Tema-paletter (synkade med API `THEME_PRESETS` + förhandsvisning via URL).
 */
export const THEME_PRESET_COLORS = {
  lux: {
    backgroundColor: '#1A1A1A',
    primaryAccent: DEFAULT_BOOKING_ACCENT_HEX,
    secondaryColor: '#2A2A2A',
    textColor: '#FFFFFF',
  },
  modern: {
    backgroundColor: '#FFF9F9',
    primaryAccent: '#E8B4B8',
    secondaryColor: '#F5E6E8',
    textColor: '#1A1A1A',
  },
  natur: {
    backgroundColor: '#F5F5F0',
    primaryAccent: '#7D9471',
    secondaryColor: '#E8E8E0',
    textColor: '#1A1A1A',
  },
  dark: {
    backgroundColor: '#0D1117',
    primaryAccent: '#58A6FF',
    secondaryColor: '#161B22',
    textColor: '#E6EDF3',
  },
  sand: {
    backgroundColor: '#FAF6F1',
    primaryAccent: '#C4A77D',
    secondaryColor: '#EDE4D8',
    textColor: '#2C2416',
  },
  ocean: {
    backgroundColor: '#E8F4F5',
    primaryAccent: '#0D9488',
    secondaryColor: '#CCFBF1',
    textColor: '#134E4A',
  },
  rose: {
    backgroundColor: '#FDF2F8',
    primaryAccent: '#DB2777',
    secondaryColor: '#FCE7F3',
    textColor: '#831843',
  },
  midnight: {
    backgroundColor: '#1E1B4B',
    primaryAccent: '#A78BFA',
    secondaryColor: '#312E81',
    textColor: '#F5F3FF',
  },
  /** Standardmall — plattformsstandard (preview + DB-fallback) */
  colorisma: { ...DEFAULT_PLATFORM_SALON_THEME },
};
