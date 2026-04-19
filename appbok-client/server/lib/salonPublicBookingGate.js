/**
 * Om salongen får ta emot riktiga bokningar på den publika sidan.
 * Preview (demo/draft/active före trial) och expired/deleted → nej.
 */
export function salonAcceptsPublicBookings(status) {
  const s = String(status || '').toLowerCase();
  return s === 'trial' || s === 'live';
}

export const SALON_PREVIEW_FORBIDDEN_MESSAGE = 'Salongen är inte live ännu';
