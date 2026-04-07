import { useState, useEffect, useMemo } from 'react';
import { parseBookingHostname } from '../lib/subdomain.js';

/**
 * Läser `window.location.hostname` och returnerar routing-info för multi-tenant.
 *
 * Tre värdtyper:
 *  • isAdminHost   — admin.appbok.se / admin.localhost
 *  • isLandingHost — appbok.se / www / localhost (ingen tenant)
 *  • isTenantHost  — colorisma.appbok.se / colorisma.localhost
 *
 * @returns {{
 *   hostname: string;
 *   kind: 'admin' | 'landing' | 'tenant' | 'unknown';
 *   isAdminHost: boolean;
 *   isLandingHost: boolean;
 *   isTenantHost: boolean;
 *   isUnknownHost: boolean;
 *   tenantSlug: string | null;
 *   rawFirstLabel: string | null;
 * }}
 */
export function useSubdomain() {
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    setHostname(typeof window !== 'undefined' ? window.location.hostname || '' : '');
  }, []);

  return useMemo(() => {
    const p = parseBookingHostname(hostname);
    return {
      hostname,
      kind: p.kind,
      isAdminHost: p.kind === 'admin',
      isLandingHost: p.kind === 'landing',
      isTenantHost: p.kind === 'tenant',
      isUnknownHost: p.kind === 'unknown',
      tenantSlug: p.tenantSlug,
      rawFirstLabel: p.rawFirstLabel,
    };
  }, [hostname]);
}
