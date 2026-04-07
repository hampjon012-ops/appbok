import { useState, useEffect, useCallback, useMemo } from 'react';
import ThemeLivePreviewColumn from './ThemeLivePreviewColumn.jsx';
import {
  displaySalonName,
  notifySalonConfigUpdated,
  resolvePrimaryAccentHex,
} from '../lib/salonPublicConfig.js';
import { DEFAULT_PLATFORM_SALON_THEME } from '../lib/themePresets.js';
import { adminApiHeaders as authHeaders } from '../lib/adminApiHeaders.js';

const DEFAULT_SALON_THEME = DEFAULT_PLATFORM_SALON_THEME;

const SALON_ADMIN_TABS = [
  { id: 'theme', label: '🎨 Tema' },
  { id: 'contact', label: '📍 Kontakt' },
  { id: 'hours', label: '⏰ Öppettider' },
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'maps', label: '🗺️ Google Maps' },
  { id: 'texts', label: '✍️ Texter' },
  { id: 'calendar', label: '📅 Google Kalender' },
  { id: 'payments', label: '💳 Betalningar' },
];

function contactFromSalon(salon) {
  return typeof salon.contact === 'object' && salon.contact !== null && !Array.isArray(salon.contact)
    ? salon.contact
    : {};
}

function SalonThemePanel({ salon, onSaved }) {
  const t = typeof salon.theme === 'object' && salon.theme ? salon.theme : {};
  const [logoUrl, setLogoUrl] = useState(salon.logo_url || '');
  const [accent, setAccent] = useState(
    resolvePrimaryAccentHex({
      ...DEFAULT_SALON_THEME,
      ...t,
    }),
  );
  const [background, setBackground] = useState(t.backgroundColor || DEFAULT_SALON_THEME.backgroundColor);
  const [text, setText] = useState(t.textColor || DEFAULT_SALON_THEME.textColor);
  const [secondary, setSecondary] = useState(t.secondaryColor || DEFAULT_SALON_THEME.secondaryColor);
  const [bgImage, setBgImage] = useState(t.backgroundImageUrl || '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLogoUrl(salon.logo_url || '');
    const th = typeof salon.theme === 'object' && salon.theme ? salon.theme : {};
    setAccent(resolvePrimaryAccentHex({ ...DEFAULT_SALON_THEME, ...th }));
    setBackground(th.backgroundColor || DEFAULT_SALON_THEME.backgroundColor);
    setText(th.textColor || DEFAULT_SALON_THEME.textColor);
    setSecondary(th.secondaryColor || DEFAULT_SALON_THEME.secondaryColor);
    setBgImage(th.backgroundImageUrl || '');
  }, [salon]);

  const themeControlsStyle = useMemo(
    () => ({
      '--panel-text': text,
      '--panel-secondary': secondary,
      '--panel-accent': accent,
      backgroundColor: background,
      color: text,
    }),
    [accent, background, secondary, text],
  );

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          logo_url: logoUrl,
          theme_primary: accent,
          theme_background: background,
          theme_text: text,
          theme_secondary: secondary,
          theme_background_image_url: bgImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card superadmin-theme-grid">
      <form
        className="superadmin-theme-controls superadmin-theme-controls--themed"
        style={themeControlsStyle}
        onSubmit={save}
      >
        <h3 className="admin-card-title">Kontroller</h3>
        <label>
          Bakgrundsfärg
          <span className="admin-hint admin-hint--field">
            Yta bakom &quot;Våra mest populära tjänster&quot;, innehållskortet under hero och Instagram-rutnätet.
          </span>
          <input type="color" className="admin-input color-input" value={background} onChange={(e) => setBackground(e.target.value)} />
        </label>
        <label>
          Sekundärfärg
          <span className="admin-hint admin-hint--field">
            Yta bakom &quot;Träffa vårt team&quot;, kontakt/karta, sidfot och ljusare paneler i bokningsfönstret.
          </span>
          <input type="color" className="admin-input color-input" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
        </label>
        <label>
          Knappfärg
          <span className="admin-hint admin-hint--field">
            Färg på Boka tid, Välj vid tjänster, markerade steg i bokningsflödet och andra tydliga knappar/länkar.
          </span>
          <input type="color" className="admin-input color-input" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </label>
        <label>
          Textfärg
          <span className="admin-hint admin-hint--field">
            Huvudsaklig textfärg på bokningssidan: rubriker, brödtext och etiketter (inte hero-texten ovanför kortet).
          </span>
          <input type="color" className="admin-input color-input" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label>
          Logo URL
          <span className="admin-hint admin-hint--field">
            Adress till er logotypbild som visas i hero (ovanför tagline). Lämna tom för att bara visa salongsnamn som text.
          </span>
          <input className="admin-input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </label>
        <label>
          Bakgrundsbild URL
          <span className="admin-hint admin-hint--field">
            Bild som ligger bakom hero (överst på sidan). Om fältet är tomt används en standardbild. Använd https-länk eller relativ sökväg.
          </span>
          <input className="admin-input" value={bgImage} onChange={(e) => setBgImage(e.target.value)} placeholder="https://..." />
        </label>
        <p className="admin-hint admin-hint--field superadmin-theme-save-hint">
          Knappen Spara skriver alla värden ovan till er salong och uppdaterar bokningssidan för besökare (även andra flikar efter en kort stund).
        </p>
        <button
          type="submit"
          className="superadmin-theme-controls-save"
          disabled={saving}
        >
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>

      <ThemeLivePreviewColumn
        salonName={salon.name}
        tagline={salon.tagline || ''}
        logoUrl={logoUrl}
        accent={accent}
        secondary={secondary}
        background={background}
        text={text}
        bgImage={bgImage}
      />
    </div>
  );
}

function SalonContactPanel({ salon, onSaved, onSalonNameLive }) {
  const c0 = contactFromSalon(salon);
  const [salonName, setSalonName] = useState(salon.name || '');
  const [address, setAddress] = useState(c0.address || '');
  const [phone, setPhone] = useState(c0.phone || '');
  const [email, setEmail] = useState(c0.email || '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSalonName(salon.name || '');
    const c = contactFromSalon(salon);
    setAddress(c.address || '');
    setPhone(c.phone || '');
    setEmail(c.email || '');
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: salonName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      try {
        const stored = JSON.parse(localStorage.getItem('sb_salon') || '{}');
        localStorage.setItem('sb_salon', JSON.stringify({
          ...stored,
          name: data.name,
          slug: data.slug ?? stored.slug,
        }));
      } catch (_) { /* ignore */ }
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">📍 Kontakt</h3>
      <p className="admin-hint">Salongens namn och kontaktuppgifter som visas för kunder där det är aktiverat.</p>
      <form className="superadmin-modal-form" onSubmit={save}>
        <label>
          Salongens namn
          <input
            className="admin-input"
            value={salonName}
            onChange={(e) => {
              const v = e.target.value;
              setSalonName(v);
              onSalonNameLive?.(v);
            }}
            required
          />
        </label>
        <label>
          Adress
          <input className="admin-input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label>
          Telefon
          <input className="admin-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          E-post
          <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" className="btn-superadmin-gold" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>
    </div>
  );
}

function SalonHoursPanel({ salon, onSaved }) {
  const c0 = contactFromSalon(salon);
  const initialText = Array.isArray(c0.hours) && c0.hours.length
    ? c0.hours.join('\n')
    : c0.opening_hours || '';
  const [text, setText] = useState(initialText);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = contactFromSalon(salon);
    const t = Array.isArray(c.hours) && c.hours.length ? c.hours.join('\n') : c.opening_hours || '';
    setText(t);
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ opening_hours: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">⏰ Öppettider</h3>
      <p className="admin-hint">En rad per tidsintervall, t.ex. &quot;Mån–Fre 09–18&quot;.</p>
      <form className="superadmin-modal-form" onSubmit={save}>
        <label>
          Öppettider
          <textarea
            className="admin-input"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Mån–Fre 09–18\nLör 10–15'}
          />
        </label>
        <button type="submit" className="btn-superadmin-gold" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>
    </div>
  );
}

function SalonInstagramPanel({ salon, onSaved }) {
  const c0 = contactFromSalon(salon);
  const [handle, setHandle] = useState(
    salon.instagram != null && String(salon.instagram).trim()
      ? String(salon.instagram).replace(/^@/, '')
      : (c0.instagram_handle != null ? String(c0.instagram_handle) : '')
  );
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = contactFromSalon(salon);
    const fromCol = salon.instagram != null && String(salon.instagram).trim()
      ? String(salon.instagram).replace(/^@/, '')
      : '';
    setHandle(fromCol || (c.instagram_handle != null ? String(c.instagram_handle) : ''));
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const h = handle.trim().replace(/^@/, '');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          instagram: h,
          contact: { instagram_handle: h },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">📸 Instagram</h3>
      <p className="admin-hint">Användarnamn (utan @) som visas på er bokningssida.</p>
      <form className="superadmin-modal-form" onSubmit={save}>
        <label>
          Användarnamn
          <input
            className="admin-input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="min_salong"
          />
        </label>
        <button type="submit" className="btn-superadmin-gold" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>
    </div>
  );
}

function SalonMapsPanel({ salon, onSaved }) {
  const [mapUrl, setMapUrl] = useState(salon.map_url != null ? String(salon.map_url) : '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMapUrl(salon.map_url != null ? String(salon.map_url) : '');
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ map_url: mapUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">🗺️ Google Maps</h3>
      <p className="admin-hint">Klistra in embed-URL från Google Maps (dela → Bädda in karta).</p>
      <form className="superadmin-modal-form" onSubmit={save}>
        <label>
          Embed-URL
          <input
            className="admin-input"
            value={mapUrl}
            onChange={(e) => setMapUrl(e.target.value)}
            placeholder="https://www.google.com/maps/embed?..."
          />
        </label>
        <button type="submit" className="btn-superadmin-gold" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>
    </div>
  );
}

function SalonTextsPanel({ salon, onSaved, onSalonNameLive }) {
  const c0 = contactFromSalon(salon);
  const [salonName, setSalonName] = useState(salon.name || '');
  const [tagline, setTagline] = useState(salon.tagline || '');
  const [about, setAbout] = useState(c0.about || '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = contactFromSalon(salon);
    setSalonName(salon.name || '');
    setTagline(salon.tagline || '');
    setAbout(c.about || '');
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: salonName.trim(),
          tagline: tagline.trim(),
          contact: { about: about.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      try {
        const stored = JSON.parse(localStorage.getItem('sb_salon') || '{}');
        localStorage.setItem('sb_salon', JSON.stringify({
          ...stored,
          name: data.name,
          slug: data.slug ?? stored.slug,
        }));
      } catch (_) { /* ignore */ }
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">✍️ Texter</h3>
      <p className="admin-hint">Välkomsttext och kort presentation om er salong.</p>
      <form className="superadmin-modal-form" onSubmit={save}>
        <label>
          Salongens namn
          <input
            className="admin-input"
            value={salonName}
            onChange={(e) => {
              const v = e.target.value;
              setSalonName(v);
              onSalonNameLive?.(v);
            }}
            placeholder={displaySalonName('')}
          />
        </label>
        <label>
          Text på startsidan (välkomsttext)
          <input
            className="admin-input"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Välkommen till oss!"
          />
        </label>
        <label>
          Om oss
          <textarea
            className="admin-input"
            rows={5}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Kort presentation av er salong..."
          />
        </label>
        <button type="submit" className="btn-superadmin-gold" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>
    </div>
  );
}

function SalonCalendarPanel() {
  const [calStatus, setCalStatus] = useState(null);
  const [calLoading, setCalLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar/status', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setCalStatus(d);
        setCalLoading(false);
      })
      .catch(() => setCalLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') {
      setCalStatus((prev) => ({ ...prev, connected: true }));
      window.history.replaceState({}, '', '/admin');
    }
  }, []);

  const handleConnect = async () => {
    const res = await fetch('/api/calendar/connect', { headers: authHeaders() });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const handleDisconnect = async () => {
    await fetch('/api/calendar/disconnect', { headers: authHeaders() });
    setCalStatus((prev) => ({ ...prev, connected: false }));
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">📅 Google Kalender</h3>
      <p className="admin-card-desc">
        Koppla din Google Kalender för att automatiskt synka bokningar och blockera privata tider.
      </p>

      {calLoading ? (
        <p className="admin-hint">Kontrollerar kalenderanslutning...</p>
      ) : !calStatus?.configured ? (
        <div className="calendar-status-box not-configured">
          <span className="cal-status-icon">⚙️</span>
          <div>
            <strong>Google Calendar ej konfigurerat</strong>
            <p>Administratören behöver konfigurera Google OAuth på servern.</p>
          </div>
        </div>
      ) : calStatus?.connected ? (
        <div className="calendar-status-box connected">
          <span className="cal-status-icon">✅</span>
          <div>
            <strong>Kalender kopplad</strong>
            <p>Din Google Calendar är ansluten. Bokningar synkas automatiskt.</p>
          </div>
          <button type="button" className="btn-sm btn-ghost" onClick={handleDisconnect}>
            Koppla från
          </button>
        </div>
      ) : (
        <div className="calendar-status-box disconnected">
          <span className="cal-status-icon">🔗</span>
          <div>
            <strong>Ej ansluten</strong>
            <p>Koppla din kalender för att få bokningar synkade.</p>
          </div>
          <button type="button" className="btn-admin-primary" onClick={handleConnect}>
            Koppla Google Kalender
          </button>
        </div>
      )}
    </div>
  );
}

function StripeMark() {
  return (
    <svg className="salon-stripe-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.662l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 3.343 2.086 4.768 5.763 6.051 1.996.688 2.715 1.269 2.715 2.152 0 .9-.697 1.389-1.986 1.389-1.857 0-4.601-1.011-6.62-2.351l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-3.344-2.116-4.956-6.591-6.305z"
      />
    </svg>
  );
}

function SalonPaymentsPanel({ salon }) {
  const stripeConnected = Boolean(salon?.stripe_account_id || salon?.contact?.stripe_connected);
  const [requirePayment, setRequirePayment] = useState(false);

  useEffect(() => {
    if (!stripeConnected) {
      setRequirePayment(false);
      return;
    }
    const c = contactFromSalon(salon);
    if (typeof c.require_payment_at_booking === 'boolean') {
      setRequirePayment(c.require_payment_at_booking);
    }
  }, [salon, stripeConnected]);

  const handleStripeConnect = () => {
    // Stripe Connect onboarding kommer senare
  };

  return (
    <div className="admin-card salon-payments-card">
      <div className="salon-payments-title-row">
        <h3 className="admin-card-title salon-payments-heading">Stripe-anslutning</h3>
        <span
          className={`salon-payments-status-badge ${stripeConnected ? 'salon-payments-status-badge--ok' : 'salon-payments-status-badge--inactive'}`}
        >
          {stripeConnected ? 'Aktiv' : 'Ej aktiv'}
        </span>
      </div>
      <p className="admin-card-desc salon-payments-desc">
        Aktivera kortbetalningar direkt vid bokning. Genom att ansluta ditt Stripe-konto betalas pengarna ut
        automatiskt till ditt bankkonto. Inga extra serviceavgifter tillkommer från Appbok.
      </p>

      <button type="button" className="btn-stripe-connect" onClick={handleStripeConnect}>
        <StripeMark />
        <span>Anslut din salong med Stripe</span>
      </button>

      <label className={`salon-payment-toggle-row ${!stripeConnected ? 'salon-payment-toggle-row--disabled' : ''}`}>
        <span className="salon-payment-toggle-label">Kräv betalning vid bokning</span>
        <span className="salon-payment-switch-wrap">
          <input
            type="checkbox"
            className="salon-payment-switch-input"
            checked={requirePayment}
            disabled={!stripeConnected}
            onChange={(e) => setRequirePayment(e.target.checked)}
          />
          <span className="salon-payment-switch-track" aria-hidden />
        </span>
      </label>
      {!stripeConnected && (
        <p className="admin-hint salon-payment-toggle-hint">Anslut Stripe först för att aktivera detta val.</p>
      )}
    </div>
  );
}

export default function SalonAdminSettingsTab() {
  const [salon, setSalon] = useState(null);
  const [tab, setTab] = useState('theme');
  const [loading, setLoading] = useState(true);

  const load = useCallback((opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setLoading(true);
    return fetch('/api/salons', { headers: authHeaders(), cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data && !Array.isArray(data)) setSalon(data);
        else setSalon(null);
        if (!silent) setLoading(false);
      })
      .catch(() => {
        setSalon(null);
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSalonNameLive = useCallback((name) => {
    setSalon((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const onSaved = useCallback(() => {
    load({ silent: true }).then(() => notifySalonConfigUpdated());
  }, [load]);

  if (loading) {
    return <div className="admin-loading">Laddar inställningar…</div>;
  }

  if (!salon) {
    return <div className="admin-section"><p className="admin-empty">Kunde inte hämta salongsdata.</p></div>;
  }

  return (
    <div className="admin-section superadmin-section salon-admin-settings">
      <div className="superadmin-editor-top salon-admin-editor-top">
        <h2 className="admin-section-title">Redigerar: {displaySalonName(salon.name)}</h2>
        <p className="admin-hint salon-admin-lead">
          Uppdatera er bokningssida, kontakt och kalender. Personal och tjänster hanterar du via menyn till vänster.
        </p>
      </div>

      <div className="superadmin-subtabs">
        {SALON_ADMIN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`superadmin-subtab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'theme' && <SalonThemePanel salon={salon} onSaved={onSaved} />}
      {tab === 'contact' && <SalonContactPanel salon={salon} onSaved={onSaved} onSalonNameLive={onSalonNameLive} />}
      {tab === 'hours' && <SalonHoursPanel salon={salon} onSaved={onSaved} />}
      {tab === 'instagram' && <SalonInstagramPanel salon={salon} onSaved={onSaved} />}
      {tab === 'maps' && <SalonMapsPanel salon={salon} onSaved={onSaved} />}
      {tab === 'texts' && <SalonTextsPanel salon={salon} onSaved={onSaved} onSalonNameLive={onSalonNameLive} />}
      {tab === 'calendar' && <SalonCalendarPanel />}
      {tab === 'payments' && <SalonPaymentsPanel salon={salon} />}
    </div>
  );
}
