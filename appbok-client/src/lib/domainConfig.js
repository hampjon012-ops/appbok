/**
 * Centrala domän-konstanter för multi-tenant routing.
 * Håll i synk med index.html och subdomain.js.
 */

export const BOOKING_TENANT_SUFFIX = '.appbok.se';
export const BOOKING_TENANT_SUFFIX_LOCAL = '.localhost';

export const BOOKING_BASE_DOMAINS = [
  'appbok.se',
  'www.appbok.se',
  'app.appbok.se',
  'localhost',
  '127.0.0.1',
];

/** Subdomän som alltid = admin-panel (admin.appbok.se, admin.localhost). */
export const ADMIN_SUBDOMAIN_LABEL = 'admin';

/** Subdomäner som aldrig är en tenant. */
export const IGNORED_SUBDOMAIN_LABELS = ['www', 'app', 'admin'];

/** Demosalong Colorisma — kanonisk produktions-URL. */
export const DEMO_SALON_URL = 'https://colorisma.appbok.se';

/** Admin-panel — kanonisk produktions-URL (synkad med index.html). */
export const ADMIN_PUBLIC_ORIGIN = 'https://admin.appbok.se';
