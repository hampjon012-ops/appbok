/**
 * Publik omboknings-URL (SMS). Sätt REBOOK_PUBLIC_URL_BASE vid lokal utveckling, t.ex.
 * http://colorisma.localhost:5173
 */
export function buildRebookPublicUrl(salonSlug, token, date, stylistId) {
  const slug = String(salonSlug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '') || 'salon';
  const base = (process.env.REBOOK_PUBLIC_URL_BASE || `https://${slug}.appbok.se`).replace(/\/$/, '');
  let origin;
  try {
    origin = new URL(base.startsWith('http') ? base : `https://${base}`).origin;
  } catch {
    origin = `https://${slug}.appbok.se`;
  }
  const q = new URLSearchParams();
  q.set('token', token);
  q.set('date', String(date).slice(0, 10));
  q.set('stylist', String(stylistId));
  return `${origin}/rebook?${q.toString()}`;
}
