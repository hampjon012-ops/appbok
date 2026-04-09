import { useState, useEffect, useMemo, useRef } from 'react';
import { buildMobileThemePreviewPath } from '../lib/salonPublicConfig.js';
import { getLandingOriginForThemePreview } from '../lib/subdomain.js';

/** Logisk viewport — samma som iframe-intern bredd */
const IFRAME_W = 390;
const IFRAME_H = 844;
/** Skala ner till mockup-skärm (origin top-left) */
const PREVIEW_SCALE = 0.7;

const STICKY_WRAP = {
  position: 'sticky',
  top: '2rem',
  alignSelf: 'start',
};

const IFRAME_STYLE = {
  flex: 1,
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
};

const PREVIEW_DEBOUNCE_MS = 320;

/**
 * Live preview: iframe 390px med svart ram som möter skärmen (ingen mellanliggande bezel), skalning.
 */
export default function ThemeLivePreviewColumn({
  salonName,
  tagline = '',
  logoUrl,
  accent,
  secondary,
  background,
  text,
  bgImage,
}) {
  const livePath = useMemo(
    () =>
      buildMobileThemePreviewPath({
        salonName,
        tagline,
        logoUrl,
        accent,
        background,
        text,
        secondary,
        bgImage,
      }),
    [salonName, tagline, logoUrl, accent, background, text, secondary, bgImage],
  );

  const liveUrl = useMemo(() => {
    const origin = getLandingOriginForThemePreview();
    return origin ? `${origin}${livePath}` : livePath;
  }, [livePath]);

  const [iframeSrc, setIframeSrc] = useState(liveUrl);
  const previewHasMounted = useRef(false);

  useEffect(() => {
    const delay = previewHasMounted.current ? PREVIEW_DEBOUNCE_MS : 0;
    previewHasMounted.current = true;
    const t = window.setTimeout(() => setIframeSrc(liveUrl), delay);
    return () => window.clearTimeout(t);
  }, [liveUrl]);

  return (
    <div
      className="superadmin-preview-wrap superadmin-preview-wrap--sticky"
      style={STICKY_WRAP}
      data-appbok-preview="iframe-mobile"
    >
      <div className="theme-live-preview-stack">
        <h3 className="admin-card-title theme-live-preview-stack-title">Live preview</h3>
        <div className="theme-preview-phone theme-preview-phone-premium">
          <div className="theme-preview-iframe-viewport">
            <iframe
              key={iframeSrc}
              title="Mobilförhandsvisning — bokningssida"
              src={iframeSrc}
              style={IFRAME_STYLE}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
