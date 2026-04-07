import { useLayoutEffect } from 'react';
import Admin from '../pages/Admin.jsx';
import { shouldRedirectToCanonicalAdminDashboard, getAdminDashboardUrl } from '../lib/adminUrls.js';

/**
 * Admin-panel på tenant/apex appbok.se → admin.appbok.se/admin.
 * Lokalt och på admin-värd: rendera Admin direkt.
 */
export default function AdminDashboardRedirect() {
  const redirect = shouldRedirectToCanonicalAdminDashboard();

  useLayoutEffect(() => {
    if (!redirect) return;
    const target = getAdminDashboardUrl();
    if (window.location.href.split('#')[0] !== target.split('#')[0]) {
      window.location.replace(target);
    }
  }, [redirect]);

  if (redirect) {
    return <div className="loading-screen">Omdirigerar till admin…</div>;
  }

  return <Admin />;
}
