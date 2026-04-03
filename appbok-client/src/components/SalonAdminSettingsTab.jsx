import { useState, useEffect, useCallback } from 'react';
import ThemeLivePreviewColumn from './ThemeLivePreviewColumn.jsx';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
  };
}

const SALON_ADMIN_TABS = [
  { id: 'theme', label: '🎨 Tema' },
  { id: 'contact', label: '📍 Kontakt' },
  { id: 'hours', label: '⏰ Öppettider' },
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'maps', label: '🗺️ Google Maps' },
  { id: 'texts', label: '✍️ Texter' },
  { id: 'calendar', label: '📅 Google Kalender' },
];

function contactFromSalon(salon) {
  return typeof salon.contact === 'object' && salon.contact !== null && !Array.isArray(salon.contact)
    ? salon.contact
    : {};
}

function SalonThemePanel({ salon, onSaved }) {
  const t = typeof salon.theme === 'object' && salon.theme ? salon.theme : {};
  const [logoUrl, setLogoUrl] = useState(salon.logo_url || '');
  const [accent, setAccent] = useState(t.primaryAccent || '#A89483');
  const [background, setBackground] = useState(t.backgroundColor || '#FAFAFA');
  const [text, setText] = useState(t.textColor || '#1A1A1A');
  const [secondary, setSecondary] = useState(t.secondaryColor || '#EBE8E3');
  const [bgImage, setBgImage] = useState(t.backgroundImageUrl || '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLogoUrl(salon.logo_url || '');
    const th = typeof salon.theme === 'object' && salon.theme ? salon.theme : {};
    setAccent(th.primaryAccent || '#A89483');
    setBackground(th.backgroundColor || '#FAFAFA');
    setText(th.textColor || '#1A1A1A');
    setSecondary(th.secondaryColor || '#EBE8E3');
    setBgImage(th.backgroundImageUrl || '');
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
      <form className="superadmin-theme-controls" onSubmit={save}>
        <h3 className="admin-card-title">Kontroller</h3>
        <label>
          Logo URL
          <input className="admin-input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </label>
        <label>
          Accent-färg
          <input type="color" className="admin-input color-input" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </label>
        <label>
          Bakgrundsfärg
          <input type="color" className="admin-input color-input" value={background} onChange={(e) => setBackground(e.target.value)} />
        </label>
        <label>
          Textfärg
          <input type="color" className="admin-input color-input" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label>
          Sekundärfärg
          <input type="color" className="admin-input color-input" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
        </label>
        <label>
          Bakgrundsbild URL
          <input className="admin-input" value={bgImage} onChange={(e) => setBgImage(e.target.value)} placeholder="https://..." />
        </label>
        <button type="submit" className="btn-superadmin-gold" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>

      <ThemeLivePreviewColumn
        salonName={salon.name}
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

function SalonContactPanel({ salon, onSaved }) {
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
          <input className="admin-input" value={salonName} onChange={(e) => setSalonName(e.target.value)} required />
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

function SalonTextsPanel({ salon, onSaved }) {
  const c0 = contactFromSalon(salon);
  const [tagline, setTagline] = useState(salon.tagline || '');
  const [about, setAbout] = useState(c0.about || '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = contactFromSalon(salon);
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
          tagline: tagline.trim(),
          contact: { about: about.trim() },
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
      <h3 className="admin-card-title">✍️ Texter</h3>
      <p className="admin-hint">Välkomsttext och kort presentation om er salong.</p>
      <form className="superadmin-modal-form" onSubmit={save}>
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

export default function SalonAdminSettingsTab() {
  const [salon, setSalon] = useState(null);
  const [tab, setTab] = useState('theme');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/salons', { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data && !Array.isArray(data)) setSalon(data);
        else setSalon(null);
        setLoading(false);
      })
      .catch(() => {
        setSalon(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSaved = useCallback(
    (data) => {
      if (data && data.id) setSalon(data);
      else load();
    },
    [load]
  );

  if (loading) {
    return <div className="admin-loading">Laddar inställningar…</div>;
  }

  if (!salon) {
    return <div className="admin-section"><p className="admin-empty">Kunde inte hämta salongsdata.</p></div>;
  }

  return (
    <div className="admin-section superadmin-section salon-admin-settings">
      <div className="superadmin-editor-top salon-admin-editor-top">
        <h2 className="admin-section-title">Redigerar: {salon.name}</h2>
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
      {tab === 'contact' && <SalonContactPanel salon={salon} onSaved={onSaved} />}
      {tab === 'hours' && <SalonHoursPanel salon={salon} onSaved={onSaved} />}
      {tab === 'instagram' && <SalonInstagramPanel salon={salon} onSaved={onSaved} />}
      {tab === 'maps' && <SalonMapsPanel salon={salon} onSaved={onSaved} />}
      {tab === 'texts' && <SalonTextsPanel salon={salon} onSaved={onSaved} />}
      {tab === 'calendar' && <SalonCalendarPanel />}
    </div>
  );
}
