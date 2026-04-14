/**
 * Headers for authenticated admin API calls. Sends X-Impersonate-Salon-Id when
 * sb_superadmin_impersonate is set; the server only honors it for JWT role superadmin.
 * Vid stylist-impersonation: även X-Impersonate-Staff-Id (användar-id) + salonId i payload.
 *
 * Superadmin: om endast sb_salon är satt (utan impersonate-nyckel) måste samma salong-ID
 * skickas som vid GET /api/services?salon_id=… — annars matchar PUT fel salon_id i JWT.
 */
export function adminApiHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
  };
  let salonIdForImpersonation = null;
  const impRaw = localStorage.getItem('sb_superadmin_impersonate');
  if (impRaw) {
    try {
      const parsed = JSON.parse(impRaw);
      if (parsed?.role === 'staff' && parsed?.salonId) {
        salonIdForImpersonation = parsed.salonId;
        if (parsed?.id) headers['X-Impersonate-Staff-Id'] = String(parsed.id);
      } else if (parsed?.id) {
        salonIdForImpersonation = parsed.id;
      }
    } catch {
      /* ignore */
    }
  }
  if (!salonIdForImpersonation) {
    try {
      const userRaw = localStorage.getItem('sb_user');
      const user = userRaw ? JSON.parse(userRaw) : null;
      if (user?.role === 'superadmin') {
        const salonRaw = localStorage.getItem('sb_salon');
        const salon = salonRaw ? JSON.parse(salonRaw) : null;
        if (salon?.id) salonIdForImpersonation = salon.id;
      }
    } catch {
      /* ignore */
    }
  }
  if (salonIdForImpersonation) {
    headers['X-Impersonate-Salon-Id'] = salonIdForImpersonation;
  }
  return headers;
}

/**
 * Salong-ID för GET /api/services?salon_id=…, Personal, m.m.
 * Impersonering först — annars är sb_salon fortfarande HQ och listor för Colorisma blir tomma.
 */
export function getSalonIdForPublicApi() {
  if (typeof window === 'undefined') return '';
  try {
    const impRaw = localStorage.getItem('sb_superadmin_impersonate');
    if (impRaw) {
      const parsed = JSON.parse(impRaw);
      if (parsed?.role === 'staff' && parsed?.salonId) return String(parsed.salonId);
      if (parsed?.id) return String(parsed.id);
    }
  } catch {
    /* ignore */
  }
  // JWT har ofta salonId även om sb_salon är felaktig eller saknar id (t.ex. superadmin-login)
  try {
    const token = localStorage.getItem('sb_token');
    if (token) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
        const payload = JSON.parse(atob(b64 + pad));
        const sid = payload.salonId ?? payload.salon_id;
        if (sid) return String(sid);
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const salon = JSON.parse(localStorage.getItem('sb_salon') || '{}');
    if (salon?.id) return String(salon.id);
  } catch {
    /* ignore */
  }
  return '';
}
