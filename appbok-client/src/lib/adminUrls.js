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

/**
 * Efter registrering på appbok.se sparas JWT i localStorage på apex — men admin-panelen
 * ligger på admin.appbok.se (annan origin). Signup skickar då hit: #sb=<urlencoded JSON>.
 * Körs synkront i Admin innan getAuth() så token finns vid första render.
 */
export function applyBootstrapAuthFromHash() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hash;
  if (!h.startsWith('#sb=')) return false;
  try {
    const raw = decodeURIComponent(h.slice(4));
    const parsed = JSON.parse(raw);
    if (parsed.t) localStorage.setItem('sb_token', parsed.t);
    if (parsed.u) localStorage.setItem('sb_user', JSON.stringify(parsed.u));
    if (parsed.s) localStorage.setItem('sb_salon', JSON.stringify(parsed.s));
    if (parsed.toastBokadirekt) {
      try {
        sessionStorage.setItem('sb_onboarding_bokadirekt_toast', '1');
      } catch {
        /* ignore */
      }
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  } catch {
    return false;
  }
}

export function replaceWithAdminLogin() {
  if (typeof window === 'undefined') return;
  window.location.replace(getAdminLoginUrl());
}

export function replaceWithAdminDashboard() {
  if (typeof window === 'undefined') return;
  window.location.replace(getAdminDashboardUrl());
}

/** Normaliserar slug/subdomän för URL. */
function normalizeSalonSlug(salon) {
  const raw = String(salon?.slug || salon?.subdomain || '').trim().toLowerCase();
  return raw.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
}

/**
 * Publik bokningssida / förhandsvisning (kundvy).
 * Prod: https://{slug}.appbok.se/
 * Lokal: http://{slug}.localhost:{port}/
 * Vercel-preview: {origin}/?slug={slug}
 */
export function getSalonPublicBookingPreviewUrl(salon) {
  const slug = normalizeSalonSlug(salon);
  if (!slug) return '';
  if (typeof window === 'undefined') {
    return `https://${slug}.appbok.se/`;
  }
  const h = window.location.hostname.toLowerCase();
  const port = window.location.port ? `:${window.location.port}` : '';

  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost')) {
    return `http://${slug}.localhost${port}/`;
  }

  if (h.endsWith('.vercel.app')) {
    return `${window.location.origin}/?slug=${encodeURIComponent(slug)}`;
  }

  if (h.endsWith('.appbok.se') || h === 'appbok.se') {
    return `https://${slug}.appbok.se/`;
  }

  return `https://${slug}.appbok.se/`;
}

/** Kopiera text till urklipp (clipboard API med fallback). */
export async function copyTextToClipboard(text) {
  const s = String(text || '');
  if (!s) return false;
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = s;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
