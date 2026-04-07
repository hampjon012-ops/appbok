import { useLayoutEffect } from 'react';
import Admin from '../pages/Admin.jsx';
import { ADMIN_PUBLIC_ORIGIN } from '../lib/domainConfig.js';

const APEX_HOSTS = new Set(['appbok.se', 'www.appbok.se']);

/**
 * På appbok.se / www.appbok.se: omdirigera till admin.appbok.se (samma path/query/hash).
 * Lokalt (localhost): rendera Admin utan omdirigering.
 */
export default function AdminApexRedirect() {
  const isApex =
    typeof window !== 'undefined' && APEX_HOSTS.has(window.location.hostname.toLowerCase());

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hostname.toLowerCase();
    if (!APEX_HOSTS.has(h)) return;
    window.location.replace(
      `${ADMIN_PUBLIC_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
  }, []);

  if (isApex) {
    return <div className="loading-screen">Omdirigerar till admin…</div>;
  }

  return <Admin />;
}
