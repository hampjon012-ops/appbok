import {
  DEFAULT_BOOKING_ACCENT_HEX,
  LEGACY_BEIGE_ACCENT_HEX,
  LEGACY_BOOKING_ACCENT_HEX,
} from './defaultBookingAccent.js';
import { DEFAULT_PLATFORM_SALON_THEME, THEME_PRESET_COLORS } from './themePresets.js';
import { getImplicitHostSalonSlug } from './subdomain.js';

export { getImplicitHostSalonSlug };

/** Visningsnamn för salong — fallback när databas/config saknar värde. */
export function displaySalonName(name) {
  const n = name != null && String(name).trim();
  return n || 'Din Salong';
}

/** Slår ihop API-namn med statisk config (API har företräde). */
export function resolveSalonDisplayName(apiName, baseSalonName) {
  const a = String(apiName ?? '').trim();
  if (a) return a;
  const b = String(baseSalonName ?? '').trim();
  if (b) return b;
  return 'Din Salong';
}

function asObject(val) {
  if (!val) return null;
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Colorisma / knappar — samma som `DEFAULT_BOOKING_ACCENT_HEX`. */
export const DEFAULT_ACCENT_HEX = DEFAULT_BOOKING_ACCENT_HEX;

function normalizeHex6Color(input) {
  if (input == null) return null;
  const s0 = String(input).trim();
  if (!s0) return null;
  let s = s0.startsWith('#') ? s0.slice(1) : s0;
  if (!/^[0-9A-Fa-f]+$/i.test(s)) return null;
  if (s.length === 3) {
    s = `${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  }
  if (s.length !== 6) return null;
  return `#${s.toLowerCase()}`;
}

function canonicalAccentHex(normalized) {
  if (!normalized) return null;
  if (normalized === LEGACY_BOOKING_ACCENT_HEX || normalized === LEGACY_BEIGE_ACCENT_HEX) {
    return DEFAULT_ACCENT_HEX;
  }
  return normalized;
}

/** Slår ihop API-tema + bas (config.json); ofullständigt API-tema fylls med plattformsstandard (preview). */
function mergeThemeObjects(apiTheme, baseTheme) {
  const t = apiTheme && typeof apiTheme === 'object' ? apiTheme : null;
  const b = baseTheme && typeof baseTheme === 'object' ? baseTheme : {};
  const baseMerged = { ...DEFAULT_PLATFORM_SALON_THEME, ...b };

  if (!t) {
    return {
      ...baseMerged,
      primaryAccent:
        canonicalAccentHex(normalizeHex6Color(baseMerged.primaryAccent)) ?? DEFAULT_ACCENT_HEX,
    };
  }
  return {
    backgroundColor:
      normalizeHex6Color(t.backgroundColor) ??
      normalizeHex6Color(b.backgroundColor) ??
      DEFAULT_PLATFORM_SALON_THEME.backgroundColor,
    primaryAccent:
      canonicalAccentHex(
        normalizeHex6Color(t.primaryAccent) ??
          normalizeHex6Color(t.primary_accent) ??
          normalizeHex6Color(b.primaryAccent),
      ) ?? DEFAULT_ACCENT_HEX,
    secondaryColor:
      normalizeHex6Color(t.secondaryColor) ??
      normalizeHex6Color(b.secondaryColor) ??
      DEFAULT_PLATFORM_SALON_THEME.secondaryColor,
    textColor:
      normalizeHex6Color(t.textColor) ??
      normalizeHex6Color(b.textColor) ??
      DEFAULT_PLATFORM_SALON_THEME.textColor,
    backgroundImageUrl: t.backgroundImageUrl ?? b.backgroundImageUrl,
  };
}

/**
 * Salong i förhandsgranskning (före startad testperiod) — inga riktiga bokningar.
 * Matchar server: salonAcceptsPublicBookings (trial/live tillåts).
 */
export function isSalonPreviewBookingMode(status) {
  const s = String(status || '').toLowerCase();
  return s === 'demo' || s === 'draft' || s === 'active';
}

/** Namn från API-svar (olika klienter kan skicka name / salon_name). */
function extractSalonNameFromApi(api) {
  if (!api || typeof api !== 'object') return undefined;
  const n = api.name ?? api.salon_name;
  if (n == null) return undefined;
  return String(n).trim();
}

/** Slår ihop statisk config.json med live-data från databasen (namn, tema, kontakt m.m.) */
export function mergePublicSalon(base, api) {
  if (!api) return base;
  const c = asObject(api.contact) || {};
  const hoursFromText =
    c.opening_hours && typeof c.opening_hours === 'string'
      ? c.opening_hours.split('\n').map((l) => l.trim()).filter(Boolean)
      : null;
  const hours = Array.isArray(c.hours) ? c.hours : hoursFromText;

  const theme = asObject(api.theme);
  const baseTheme = base.theme && typeof base.theme === 'object' ? base.theme : {};

  const apiName = extractSalonNameFromApi(api);

  return {
    ...base,
    salonId: api.id || base.salonId,
    salonName: resolveSalonDisplayName(apiName, base.salonName),
    tagline: api.tagline ?? base.tagline,
    logoUrl: api.logo_url || base.logoUrl,
    mapUrl: api.map_url ?? base.mapUrl,
    instagram: api.instagram ?? base.instagram,
    portfolioImages: Array.isArray(api.portfolio_images) ? api.portfolio_images : (api.instagram ?? base.instagram ?? []),
    salonStatus: api.status ?? 'active',
    salonPlan: api.plan ?? 'trial',
    trialEndsAt: api.trial_ends_at ?? null,
    allowPayOnSite: api.allow_pay_on_site !== false,
    stripeAccountId: api.stripe_account_id ?? null,
    contact: {
      ...base.contact,
      address: c.address ?? base.contact?.address,
      phone: c.phone ?? base.contact?.phone,
      email: c.email ?? base.contact?.email,
      hours: hours ?? base.contact?.hours,
      instagramHandle: c.instagram_handle ?? base.contact?.instagramHandle,
      about: c.about ?? base.contact?.about,
    },
    theme: mergeThemeObjects(theme, baseTheme),
  };
}

/** Tillåt endast relativa sökvägar eller http(s) i preview-URL:er (logo / hjältebild). */
function safePreviewAssetUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || s.length > 2048) return '';
  if (s.startsWith('/')) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' || u.protocol === 'http:') return s;
  } catch {
    /* ignore */
  }
  return '';
}

function readPreviewHexParam(params, key) {
  const v = params.get(key);
  if (!v) return null;
  return normalizeHex6Color(v);
}

const PREVIEW_TAGLINE_MAX = 480;

/**
 * Querystring för `/preview/mobile` — samma App som produktion i iframe (viewport 390px).
 */
export function buildMobileThemePreviewPath({
  salonName,
  tagline = '',
  logoUrl = '',
  accent,
  background,
  text,
  secondary,
  bgImage = '',
}) {
  const p = new URLSearchParams();
  p.set('preview_embed', '1');
  p.set('preview_name', displaySalonName(salonName));
  const tl = tagline != null ? String(tagline) : '';
  p.set('preview_tagline', tl.length > PREVIEW_TAGLINE_MAX ? tl.slice(0, PREVIEW_TAGLINE_MAX) : tl);

  const logo = logoUrl != null ? String(logoUrl).trim() : '';
  if (logo) p.set('preview_logo', logo);

  const hexKey = (v) => {
    const n = normalizeHex6Color(v);
    return n ? n.slice(1) : null;
  };
  const pa = hexKey(accent);
  const pb = hexKey(background);
  const pt = hexKey(text);
  const ps = hexKey(secondary);
  if (pa) p.set('preview_primary', pa);
  if (pb) p.set('preview_background', pb);
  if (pt) p.set('preview_text', pt);
  if (ps) p.set('preview_secondary', ps);

  const bg = bgImage != null ? String(bgImage).trim() : '';
  if (bg && safePreviewAssetUrl(bg)) p.set('preview_bg_image', bg);

  return `/preview/mobile?${p.toString()}`;
}

/** URL-parametrar för inbäddad förhandsvisning (admin iframe): namn, tagline, logo, tema-fält */
function applyPreviewUrlOverrides(merged) {
  if (typeof window === 'undefined') return merged;
  const params = new URLSearchParams(window.location.search);
  const previewEmbed = params.get('preview_embed') === '1';
  if (!previewEmbed) return merged;

  let out = { ...merged };

  const previewName = params.get('preview_name');
  if (previewName != null && String(previewName).trim()) {
    const n = String(previewName).trim();
    out.salonName = displaySalonName(n);
    if (!params.has('preview_tagline')) {
      out.tagline = `Välkommen till ${n}!`;
    }
  }

  if (params.has('preview_tagline')) {
    out.tagline = params.get('preview_tagline') ?? '';
  }

  const pl = params.get('preview_logo');
  if (pl != null && String(pl).trim()) {
    const safe = safePreviewAssetUrl(pl);
    if (safe) out.logoUrl = safe;
  }

  const previewTheme = params.get('preview_theme');
  if (previewTheme && THEME_PRESET_COLORS[previewTheme]) {
    const t = THEME_PRESET_COLORS[previewTheme];
    out = {
      ...out,
      theme: { ...(out.theme && typeof out.theme === 'object' ? out.theme : {}), ...t },
    };
  }

  const themePatch = {};
  const pr = readPreviewHexParam(params, 'preview_primary');
  const pbg = readPreviewHexParam(params, 'preview_background');
  const pt = readPreviewHexParam(params, 'preview_text');
  const ps = readPreviewHexParam(params, 'preview_secondary');
  if (pr) themePatch.primaryAccent = pr;
  if (pbg) themePatch.backgroundColor = pbg;
  if (pt) themePatch.textColor = pt;
  if (ps) themePatch.secondaryColor = ps;

  const pHero = params.get('preview_bg_image');
  if (pHero != null && String(pHero).trim()) {
    const safe = safePreviewAssetUrl(pHero);
    if (safe) themePatch.backgroundImageUrl = safe;
  }

  if (Object.keys(themePatch).length) {
    out = {
      ...out,
      theme: { ...(out.theme && typeof out.theme === 'object' ? out.theme : {}), ...themePatch },
    };
  }

  return out;
}

const NEW_BG = '#EDE9E3';

/**
 * Accent för knappar / preview — samma som mergeThemeObjects (primaryAccent + ev. primary_accent).
 */
export function resolvePrimaryAccentHex(theme) {
  if (!theme || typeof theme !== 'object') return DEFAULT_ACCENT_HEX;
  const norm =
    normalizeHex6Color(theme.primaryAccent) ?? normalizeHex6Color(theme.primary_accent);
  return canonicalAccentHex(norm) ?? DEFAULT_ACCENT_HEX;
}

/** Samma logik som applyThemeToDocument — för live preview utan att skriva till :root. */
export function resolveThemeCssVars(theme) {
  if (!theme || typeof theme !== 'object') return {};

  const bg = theme.backgroundColor;

  const resolvedAccent = resolvePrimaryAccentHex(theme);
  const resolvedBg =
    !bg || bg === '#FAFAFA' || bg === '#FAFAF9' || bg === '#FFFFFF' || bg === '#ffffff' ? NEW_BG : bg;

  const vars = {
    '--accent-color': resolvedAccent,
    '--accent-hover': `${resolvedAccent}CC`,
    '--bg-color': resolvedBg,
  };
  if (theme.textColor) vars['--text-color'] = theme.textColor;
  if (theme.secondaryColor) {
    vars['--bg-light'] = theme.secondaryColor;
    vars['--bg-contact'] = theme.secondaryColor;
  }
  return vars;
}

export function applyThemeToDocument(theme) {
  const vars = resolveThemeCssVars(theme);
  if (!Object.keys(vars).length) return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readStoredSalon() {
  try {
    return JSON.parse(localStorage.getItem('sb_salon') || '{}');
  } catch {
    return {};
  }
}

const fetchOpts = { cache: 'no-store' };

/** Anropas efter att salong sparats i admin — bokningssidan lyssnar och hämtar om config. */
export const SALON_CONFIG_UPDATED = 'appbok:salon-config-updated';
const LS_CONFIG_REV = 'appbok_salon_config_rev';

export function notifySalonConfigUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SALON_CONFIG_UPDATED));
  try {
    localStorage.setItem(LS_CONFIG_REV, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Nyckel för storage-event (andra flikar). */
export const SALON_CONFIG_STORAGE_KEY = LS_CONFIG_REV;

/** @deprecated använd BOOKING_BASE_HOSTNAMES i subdomain.js */
export const BOOKING_BASE_DOMAINS = new Set([
  'appbok.se',
  'www.appbok.se',
  'app.appbok.se',
  'localhost',
  '127.0.0.1',
]);

function bust(url) {
  const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  u.searchParams.set('_', String(Date.now()));
  return u.pathname + u.search;
}

/** Laddar config.json och överlagrar med GET /api/salons/public när API svarar. */
export async function fetchMergedSalonConfig() {
  const res = await fetch(bust('/config.json'), fetchOpts);
  if (!res.ok) throw new Error('config.json kunde inte laddas');
  const data = await res.json();
  const defaultId = 'a0000000-0000-0000-0000-000000000001';
  const stored = readStoredSalon();

  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const previewSlug = params.get('slug') || params.get('demo');
  const previewId = params.get('salon_id') || params.get('salonId');

  const storedId = stored.id && UUID_RE.test(stored.id) ? stored.id : null;
  const configId = data.salonId && UUID_RE.test(data.salonId) ? data.salonId : null;
  const slugTry = previewSlug || data.salonSlug || stored.slug || null;

  const hostSlug = typeof window !== 'undefined' ? getImplicitHostSalonSlug() : null;
  /** På t.ex. minsalong.appbok.se: ingen fallback till demo-UUID — annars visas fel salong. */
  const strictTenant = Boolean(hostSlug);

  /** Bygg ordnad lista av API-anrop så rätt salong hämtas.
   * Viktigt: config.json s salonId (configId) ska före sb_salon — annars visar bokningssidan fel namn
   * om slug-lookup misslyckas eller om gammal localStorage pekar på annan salong. */
  function buildAttempts() {
    const attempts = [];
    const seen = new Set();
    const add = (kind, value) => {
      if (!value) return;
      const k = `${kind}:${value}`;
      if (seen.has(k)) return;
      seen.add(k);
      attempts.push({ kind, value });
    };

    if (strictTenant) {
      if (previewSlug) add('slug', previewSlug);
      if (previewId && UUID_RE.test(previewId)) add('id', previewId);
      add('slug', hostSlug);
      return attempts;
    }

    if (previewSlug) add('slug', previewSlug);
    if (previewId && UUID_RE.test(previewId)) add('id', previewId);

    if (hostSlug) add('slug', hostSlug);

    if (data.salonSlug) add('slug', data.salonSlug);

    // Deploymentets UUID före localStorage — annars vinner gammal sb_salon och fel namn visas.
    if (configId) add('id', configId);

    if (storedId) add('id', storedId);
    add('id', defaultId);

    if (slugTry && slugTry !== previewSlug && slugTry !== data.salonSlug) {
      add('slug', slugTry);
    }

    return attempts;
  }

  try {
    for (const { kind, value } of buildAttempts()) {
      const url =
        kind === 'slug'
          ? bust(`/api/salons/public?slug=${encodeURIComponent(value)}`)
          : bust(`/api/salons/public?salon_id=${encodeURIComponent(value)}`);
      const apiRes = await fetch(url, fetchOpts);
      if (apiRes.ok) {
        const apiJson = await apiRes.json();
        const merged = applyPreviewUrlOverrides(mergePublicSalon(data, apiJson));
        // Rensa gammal session så nästa laddning inte blandar salonger.
        try {
          if (typeof window !== 'undefined' && apiJson?.id) {
            const norm = (s) => String(s || '').trim().toLowerCase();
            const canonicalSlugHit =
              kind === 'slug' && data.salonSlug && norm(value) === norm(data.salonSlug);
            const canonicalIdHit = kind === 'id' && configId && value === configId;
            if (canonicalSlugHit || canonicalIdHit) {
              const prev = JSON.parse(localStorage.getItem('sb_salon') || '{}');
              localStorage.setItem(
                'sb_salon',
                JSON.stringify({
                  ...prev,
                  id: apiJson.id,
                  name: apiJson.name ?? prev.name,
                  slug: apiJson.slug ?? prev.slug,
                }),
              );
            }
          }
        } catch {
          /* ignore */
        }
        return merged;
      }
    }
    if (strictTenant) {
      return { tenantNotFound: true, attemptedSlug: hostSlug };
    }
  } catch {
    if (strictTenant) {
      return { tenantNotFound: true, attemptedSlug: hostSlug };
    }
    // API otillgänglig
  }

  return applyPreviewUrlOverrides({
    ...data,
    salonName: resolveSalonDisplayName(null, data.salonName),
    theme: mergeThemeObjects(asObject(data.theme), {}),
  });
}
