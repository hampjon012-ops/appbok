import { THEME_PRESET_COLORS } from './themePresets.js';

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

  return {
    ...base,
    salonId: api.id || base.salonId,
    salonName: api.name || base.salonName,
    tagline: api.tagline ?? base.tagline,
    logoUrl: api.logo_url || base.logoUrl,
    mapUrl: api.map_url ?? base.mapUrl,
    instagram: api.instagram ?? base.instagram,
    contact: {
      ...base.contact,
      address: c.address ?? base.contact?.address,
      phone: c.phone ?? base.contact?.phone,
      email: c.email ?? base.contact?.email,
      hours: hours ?? base.contact?.hours,
      instagramHandle: c.instagram_handle ?? base.contact?.instagramHandle,
      about: c.about ?? base.contact?.about,
    },
    theme: theme
      ? {
          backgroundColor: theme.backgroundColor ?? base.theme?.backgroundColor,
          primaryAccent: theme.primaryAccent ?? base.theme?.primaryAccent,
          secondaryColor: theme.secondaryColor ?? base.theme?.secondaryColor,
          textColor: theme.textColor ?? base.theme?.textColor,
        }
      : base.theme,
  };
}

/** URL-parametrar för inbäddad förhandsvisning (superadmin iframe): namn + tema */
function applyPreviewUrlOverrides(merged) {
  if (typeof window === 'undefined') return merged;
  const params = new URLSearchParams(window.location.search);
  const previewName = params.get('preview_name');
  const previewTheme = params.get('preview_theme');

  let out = { ...merged };
  if (previewName && previewName.trim()) {
    const n = previewName.trim();
    out = { ...out, salonName: n, tagline: `Välkommen till ${n}!` };
  }
  if (previewTheme && THEME_PRESET_COLORS[previewTheme]) {
    const t = THEME_PRESET_COLORS[previewTheme];
    out = {
      ...out,
      theme: {
        ...(out.theme && typeof out.theme === 'object' ? out.theme : {}),
        ...t,
      },
    };
  }
  return out;
}

export function applyThemeToDocument(theme) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.backgroundColor) root.style.setProperty('--bg-color', theme.backgroundColor);
  if (theme.primaryAccent) root.style.setProperty('--accent-color', theme.primaryAccent);
  if (theme.textColor) root.style.setProperty('--text-color', theme.textColor);
  if (theme.secondaryColor) root.style.setProperty('--bg-light', theme.secondaryColor);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readStoredSalon() {
  try {
    return JSON.parse(localStorage.getItem('sb_salon') || '{}');
  } catch {
    return {};
  }
}

/** Laddar config.json och överlagrar med GET /api/salons/public när API svarar. */
export async function fetchMergedSalonConfig() {
  const res = await fetch('/config.json');
  if (!res.ok) throw new Error('config.json kunde inte laddas');
  const data = await res.json();
  const defaultId = 'a0000000-0000-0000-0000-000000000001';
  const stored = readStoredSalon();

  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const previewSlug = params.get('slug') || params.get('demo');
  const previewId = params.get('salon_id') || params.get('salonId');

  const salonId =
    (previewId && UUID_RE.test(previewId) ? previewId : null) ||
    (stored.id && UUID_RE.test(stored.id) ? stored.id : null) ||
    data.salonId ||
    defaultId;
  const slugTry = previewSlug || data.salonSlug || stored.slug || null;

  try {
    if (previewSlug) {
      const apiRes = await fetch(`/api/salons/public?slug=${encodeURIComponent(previewSlug)}`);
      if (apiRes.ok) {
        return applyPreviewUrlOverrides(mergePublicSalon(data, await apiRes.json()));
      }
    }
    if (previewId && UUID_RE.test(previewId)) {
      const apiRes = await fetch(`/api/salons/public?salon_id=${encodeURIComponent(previewId)}`);
      if (apiRes.ok) {
        return applyPreviewUrlOverrides(mergePublicSalon(data, await apiRes.json()));
      }
    }

    let apiRes = await fetch(`/api/salons/public?salon_id=${encodeURIComponent(salonId)}`);
    if (apiRes.ok) {
      return applyPreviewUrlOverrides(mergePublicSalon(data, await apiRes.json()));
    }
    if (slugTry) {
      apiRes = await fetch(`/api/salons/public?slug=${encodeURIComponent(slugTry)}`);
      if (apiRes.ok) {
        return applyPreviewUrlOverrides(mergePublicSalon(data, await apiRes.json()));
      }
    }
  } catch {
    // API otillgänglig
  }

  if (stored.name && stored.id === salonId) {
    return applyPreviewUrlOverrides({ ...data, salonName: stored.name });
  }

  return applyPreviewUrlOverrides(data);
}
