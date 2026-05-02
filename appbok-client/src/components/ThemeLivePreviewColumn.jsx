import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { resolveAccentTextColor } from '../lib/salonPublicConfig.js';

const STICKY_WRAP = {
  position: 'sticky',
  top: '2rem',
  alignSelf: 'start',
};

const FALLBACK_SERVICES = [
  { name: 'Konsultation', duration_minutes: 30, price_amount: 0 },
  { name: 'Klippning inkl. tvätt & fön', duration_minutes: 60, price_amount: 75000 },
  { name: 'Balayage / Ombre', duration_minutes: 180, price_amount: 180000 },
  { name: 'Styling', duration_minutes: 60, price_amount: 65000 },
];

function hexIsDark(hex) {
  const raw = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(raw)) return false;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function formatPrice(ore) {
  const value = Math.max(0, Math.round(Number(ore) || 0) / 100);
  return value === 0 ? '0 kr' : `${value.toLocaleString('sv-SE')} kr`;
}

/**
 * Live preview i admin: samma telefonlayout som onboarding, men driven av de
 * faktiska temafälten i inställningar.
 */
export default function ThemeLivePreviewColumn({
  salonName,
  tagline = '',
  accent,
  secondary,
  background,
  text,
  bgImage,
}) {
  const previewTheme = useMemo(
    () => ({
      backgroundColor: background,
      primaryAccent: accent,
      secondaryColor: secondary,
      textColor: text,
    }),
    [accent, background, secondary, text],
  );
  const isDarkTheme = hexIsDark(background);
  const accentText = resolveAccentTextColor(previewTheme);
  const safeSalonName = String(salonName || '').trim() || 'Studio Flex';
  const safeTagline =
    String(tagline || '').trim() || 'Upplev hantverk och personlig service i en lugn och modern miljö.';
  const heroImage = String(bgImage || '').trim() || '/images/onboarding/hair-warm-walnut.jpg';
  const surface = isDarkTheme ? secondary || background : background;
  const footer = isDarkTheme ? secondary || background : '#ffffff';
  const muted = isDarkTheme ? 'rgba(255,255,255,.58)' : '#78716c';
  const divider = isDarkTheme ? 'rgba(255,255,255,.14)' : 'rgba(17,24,39,.1)';

  return (
    <div
      className="superadmin-preview-wrap superadmin-preview-wrap--sticky"
      style={STICKY_WRAP}
      data-appbok-preview="onboarding-mobile"
    >
      <div className="theme-live-preview-stack">
        <h3 className="admin-card-title theme-live-preview-stack-title">Live preview</h3>
        <div className="signup-v2-phone-frame theme-live-preview-phone-frame">
          <div
            className="signup-v2-phone signup-v2-landing-preview theme-live-preview-phone"
            style={{
              '--signup-preview-bg': background,
              '--signup-preview-text': text,
              '--signup-preview-accent': accent,
              '--signup-preview-accent-text': accentText,
              '--signup-preview-surface': surface,
              '--signup-preview-muted': muted,
              '--signup-preview-chevron': isDarkTheme ? 'rgba(255,255,255,.46)' : '#9ca3af',
              '--signup-preview-footer-bg': footer,
              '--signup-preview-divider': divider,
            }}
          >
            <div
              className="signup-v2-preview-hero"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,.46), rgba(0,0,0,.46)), url(${heroImage})`,
              }}
            >
              <div className="signup-v2-preview-hero-content">
                <h2>{safeSalonName}</h2>
                <p>{safeTagline}</p>
              </div>
            </div>

            <div className="signup-v2-preview-card">
              <section className="signup-v2-preview-section">
                <h3>Våra mest populära tjänster</h3>
                {FALLBACK_SERVICES.map((service, index) => (
                  <div
                    key={`${service.name}-${index}`}
                    className="signup-v2-preview-service-row"
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      <strong>{service.name}</strong>
                      <span>
                        {service.duration_minutes} min · Från {formatPrice(service.price_amount)}
                      </span>
                    </div>
                    <ChevronRight className="signup-v2-preview-service-chevron" size={16} strokeWidth={2.15} aria-hidden />
                  </div>
                ))}
              </section>

              <section className="theme-live-preview-extra-section">
                <h3>Träffa vårt team</h3>
                <div className="theme-live-preview-team-grid">
                  <span>Emma</span>
                  <span>Alex</span>
                </div>
              </section>

              <section className="theme-live-preview-extra-section">
                <h3>@Colorisma</h3>
                <p>Följ oss för daglig inspiration</p>
              </section>
            </div>

            <div className="signup-v2-preview-footer">
              <button type="button">Boka Tid</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
