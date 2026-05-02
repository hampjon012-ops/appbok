import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMobileThemePreviewPath } from '../lib/salonPublicConfig.js';
import { getLandingOriginForThemePreview } from '../lib/subdomain.js';

const STICKY_WRAP = {
  position: 'sticky',
  top: '2rem',
  alignSelf: 'start',
};

const IFRAME_STYLE = {
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
};

const PREVIEW_DEBOUNCE_MS = 220;

/**
 * Riktig live preview: laddar samma publika bokningssida som kunder ser, men
 * med preview-parametrar för tema. Därmed fungerar Boka Tid, stylistklick och
 * drag-scroll exakt som i live-versionen.
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
    [accent, background, bgImage, logoUrl, salonName, secondary, tagline, text],
  );

  const liveUrl = useMemo(() => {
    const origin = getLandingOriginForThemePreview();
    return origin ? `${origin}${livePath}` : livePath;
  }, [livePath]);

  const [iframeSrc, setIframeSrc] = useState(liveUrl);
  const mountedRef = useRef(false);

  useEffect(() => {
    const delay = mountedRef.current ? PREVIEW_DEBOUNCE_MS : 0;
    mountedRef.current = true;
    const timer = window.setTimeout(() => setIframeSrc(liveUrl), delay);
    return () => window.clearTimeout(timer);
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
