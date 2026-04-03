/** Inline — telefonram ska synas även om CSS-cache är gammal */
const STICKY_WRAP = {
  position: 'sticky',
  top: '2rem',
  alignSelf: 'start',
};

const PHONE_SHELL = {
  width: 'min(350px, 100%)',
  height: 700,
  maxHeight: 'min(700px, 85vh)',
  marginLeft: 'auto',
  marginRight: 'auto',
  borderRadius: '3rem',
  border: '12px solid #18181b',
  boxShadow:
    '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 12px 24px -8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#18181b',
  flexShrink: 0,
  boxSizing: 'border-box',
};

const NOTCH = {
  flexShrink: 0,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#18181b',
  position: 'relative',
  zIndex: 1,
};

const NOTCH_PILL = {
  width: 88,
  height: 26,
  background: '#0a0a0a',
  borderRadius: 999,
  boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.06), 0 2px 6px rgba(0, 0, 0, 0.45)',
};

const SCREEN_LAYOUT = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderBottomLeftRadius: '1.85rem',
  borderBottomRightRadius: '1.85rem',
};

const SCROLL = {
  flex: 1,
  minHeight: 0,
  height: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '1rem 1.15rem 1.5rem',
  WebkitOverflowScrolling: 'touch',
};

/**
 * Högerkolumnen för temaredigering — mobil-preview med notch.
 */
export default function ThemeLivePreviewColumn({ salonName, logoUrl, accent, secondary, background, text, bgImage }) {
  const previewScreenStyle = {
    ...SCREEN_LAYOUT,
    backgroundColor: background,
    backgroundImage: bgImage ? `url(${bgImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    color: text,
  };

  return (
    <div
      className="superadmin-preview-wrap superadmin-preview-wrap--sticky"
      style={STICKY_WRAP}
      data-appbok-preview="phone-v2"
    >
      <h3 className="admin-card-title">Live preview</h3>
      <div className="theme-preview-phone" style={PHONE_SHELL}>
        <div className="theme-preview-phone-notch" style={NOTCH} aria-hidden>
          <span className="theme-preview-phone-notch-pill" style={NOTCH_PILL} />
        </div>
        <div className="theme-preview-phone-screen" style={previewScreenStyle}>
          <div className="theme-preview-phone-scroll" style={SCROLL}>
            <div className="superadmin-preview-inner superadmin-preview-inner--phone">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="superadmin-preview-logo" />
              ) : (
                <h2 style={{ margin: 0 }}>{salonName}</h2>
              )}
              <p style={{ opacity: 0.9 }}>Boka din tid hos oss</p>
              <div className="superadmin-preview-btns">
                <button type="button" style={{ background: accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8 }}>
                  Boka nu
                </button>
                <button
                  type="button"
                  style={{ background: secondary, color: text, border: `1px solid ${accent}`, padding: '10px 20px', borderRadius: 8 }}
                >
                  Kontakt
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
