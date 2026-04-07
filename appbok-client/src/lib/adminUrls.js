/**
 * Kanoniska URL:er för admin — alla salonger loggar in på admin.appbok.se.
 * Lokalt: samma origin på localhost; subdomän-test: admin.localhost.
 */

import { ADMIN_PUBLIC_ORIGIN } from './domainConfig.js';
import { parseBookingHostname } from './subdomain.js';

/** Ska vi tvinga användaren till admin.appbok.se (produktion)? */
function isAppbokProductionMultiTenantHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') return false;
  if (!h.endsWith('.appbok.se') && h !== 'appbok.se') return false;
  return true;
}

/**
 * Inloggning ska bara visas på admin-värden (admin.appbok.se / admin.localhost),
 * eller på localhost / preview — inte på tenant-subdomän eller www.
 */
export function shouldRedirectToCanonicalAdminLogin() {
  if (typeof window === 'undefined') return false;
  const { kind } = parseBookingHostname(window.location.hostname);
  if (kind === 'admin') return false;
  if (!isAppbokProductionMultiTenantHost(window.location.hostname)) return false;
  return true;
}

/**
 * Admin-panel ska öppnas på admin.appbok.se för alla salonger (inte på tenant-värd).
 */
export function shouldRedirectToCanonicalAdminDashboard() {
  return shouldRedirectToCanonicalAdminLogin();
}

/** Fullständig URL till inloggning (kanonisk). */
export function getAdminLoginUrl() {
  if (typeof window === 'undefined') return `${ADMIN_PUBLIC_ORIGIN}/login`;
  const { kind } = parseBookingHostname(window.location.hostname);
  if (kind === 'admin') {
    return `${window.location.origin}/login`;
  }
  const h = window.location.hostname.toLowerCase();
  const port = window.location.port ? `:${window.location.port}` : '';
  if (h === 'localhost' || h === '127.0.0.1') {
    return `${window.location.origin}/login`;
  }
  if (h.endsWith('.localhost') && kind === 'tenant') {
    return `http://admin.localhost${port}/login`;
  }
  if (isAppbokProductionMultiTenantHost(h) && kind !== 'admin') {
    return `${ADMIN_PUBLIC_ORIGIN}/login`;
  }
  return `${window.location.origin}/login`;
}

/** Fullständig URL till admin-dashboard (efter inloggning). */
export function getAdminDashboardUrl() {
  if (typeof window === 'undefined') return `${ADMIN_PUBLIC_ORIGIN}/admin`;
  const { kind } = parseBookingHostname(window.location.hostname);
  if (kind === 'admin') {
    return `${window.location.origin}/admin`;
  }
  const h = window.location.hostname.toLowerCase();
  const port = window.location.port ? `:${window.location.port}` : '';
  if (h === 'localhost' || h === '127.0.0.1') {
    return `${window.location.origin}/admin`;
  }
  if (h.endsWith('.localhost') && kind === 'tenant') {
    return `http://admin.localhost${port}/admin`;
  }
  if (isAppbokProductionMultiTenantHost(h) && kind !== 'admin') {
    return `${ADMIN_PUBLIC_ORIGIN}/admin`;
  }
  return `${window.location.origin}/admin`;
}

export function replaceWithAdminLogin() {
  if (typeof window === 'undefined') return;
  window.location.replace(getAdminLoginUrl());
}

export function replaceWithAdminDashboard() {
  if (typeof window === 'undefined') return;
  window.location.replace(getAdminDashboardUrl());
}
