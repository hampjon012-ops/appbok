/**
 * Publik bas-URL för länkar i mejl, Stripe, verifiering m.m.
 * Synkad med server/server.js (tidigare inline).
 */
export function publicAppOrigin() {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* ignore */
    }
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:5173';
}

/**
 * Var admin-panelen ligger (redirect efter e-postverifiering).
 * Sätt ADMIN_APP_URL=https://admin.appbok.se i produktion om den skiljer sig från PUBLIC_APP_URL.
 */
export function adminDashboardOrigin() {
  const explicit = process.env.ADMIN_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* ignore */
    }
  }
  return publicAppOrigin();
}
