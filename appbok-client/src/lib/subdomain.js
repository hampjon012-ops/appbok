/**
 * Multi-tenant routing: extraherar subdomän från `window.location.hostname`.
 *
 * Tre värdtyper:
 *  • admin-subdomän  → admin.appbok.se / admin.localhost
 *  • basdomän         → appbok.se / www.appbok.se / localhost
 *  • tenant-subdomän  → colorisma.appbok.se / colorisma.localhost
 *
 * Backend: Supabase (tabell `salons`, kolumner `slug` + `subdomain`).
 */

import {
  BOOKING_TENANT_SUFFIX,
  BOOKING_TENANT_SUFFIX_LOCAL,
  BOOKING_BASE_DOMAINS,
  ADMIN_SUBDOMAIN_LABEL,
  IGNORED_SUBDOMAIN_LABELS,
} from './domainConfig.js';

/** @deprecated använd BOOKING_BASE_DOMAINS / IGNORED_SUBDOMAIN_LABELS från domainConfig.js */
export const BOOKING_BASE_HOSTNAMES = new Set(BOOKING_BASE_DOMAINS);

/** @deprecated */
export const IGNORED_TENANT_LABELS = new Set(IGNORED_SUBDOMAIN_LABELS);

/** @deprecated synonym för ADMIN_SUBDOMAIN_LABEL i domainConfig.js */
export const ADMIN_HOST_LABEL = ADMIN_SUBDOMAIN_LABEL;

/**
 * Returnerar routing-kind för ett godtyckligt värdnamn.
 *
 * @param {string} [hostname] — t.ex. window.location.hostname
 * @returns {{
 *   kind: 'admin' | 'landing' | 'tenant' | 'unknown';
 *   hostname: string;
 *   tenantSlug: string | null;
 *   rawFirstLabel: string | null;
 * }}
 */
export function parseBookingHostname(hostname) {
  const h = String(hostname || '').trim().toLowerCase();
  if (!h) return { kind: 'landing', hostname: h, tenantSlug: null, rawFirstLabel: null };

  // ── Exakta basvädarar ───────────────────────────────────────────────
  if (BOOKING_BASE_DOMAINS.includes(h)) {
    return { kind: 'landing', hostname: h, tenantSlug: null, rawFirstLabel: null };
  }

  // ── localhost / 127.0.0.1 (ingen subdomän) ─────────────────────────
  if (h === 'localhost' || h === '127.0.0.1') {
    return { kind: 'landing', hostname: h, tenantSlug: null, rawFirstLabel: null };
  }

  // ── *.localhost ──────────────────────────────────────────────────────
  if (h.endsWith(BOOKING_TENANT_SUFFIX_LOCAL)) {
    const parts = h.split('.');
    const first = parts[0] || '';
    if (first === ADMIN_SUBDOMAIN_LABEL) {
      return { kind: 'admin', hostname: h, tenantSlug: null, rawFirstLabel: first };
    }
    if (IGNORED_SUBDOMAIN_LABELS.includes(first)) {
      return { kind: 'landing', hostname: h, tenantSlug: null, rawFirstLabel: first };
    }
    if (first) {
      return { kind: 'tenant', hostname: h, tenantSlug: first, rawFirstLabel: first };
    }
    return { kind: 'landing', hostname: h, tenantSlug: null, rawFirstLabel: null };
  }

  // ── *.appbok.se ──────────────────────────────────────────────────────
  if (h.endsWith(BOOKING_TENANT_SUFFIX)) {
    const parts = h.split('.');
    const first = parts[0] || '';
    if (first === ADMIN_SUBDOMAIN_LABEL) {
      return { kind: 'admin', hostname: h, tenantSlug: null, rawFirstLabel: first };
    }
    if (IGNORED_SUBDOMAIN_LABELS.includes(first)) {
      return { kind: 'landing', hostname: h, tenantSlug: null, rawFirstLabel: first };
    }
    if (first) {
      return { kind: 'tenant', hostname: h, tenantSlug: first, rawFirstLabel: first };
    }
    return { kind: 'landing', hostname: h, tenantSlug: null, rawFirstLabel: null };
  }

  // ── Okända värdar (t.ex. *.vercel.app) — undvik att gissa tenant ───
  return { kind: 'unknown', hostname: h, tenantSlug: null, rawFirstLabel: null };
}

/**
 * Bakåtkompatibel: returnerar tenant-slug från värdnamn, eller null.
 * Används av fetchMergedSalonConfig.
 *
 * @returns {string | null}
 */
export function getImplicitHostSalonSlug() {
  if (typeof window === 'undefined') return null;
  const { kind, tenantSlug } = parseBookingHostname(window.location.hostname);
  return kind === 'tenant' && tenantSlug ? tenantSlug : null;
}
