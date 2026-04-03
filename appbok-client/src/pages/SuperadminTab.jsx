import { useState, useEffect, useCallback, useMemo } from 'react';
import ActionsDropdown from '../components/ActionsDropdown.jsx';
import AddSalonModal from '../components/AddSalonModal.jsx';
import ThemeLivePreviewColumn from '../components/ThemeLivePreviewColumn.jsx';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
  };
}

const THEME_PRESETS_UI = [
  { id: 'colorisma', label: 'ljus & guld' },
  { id: 'lux', label: 'Lyx — svart & guld' },
  { id: 'modern', label: 'Modern — vitt & rosa' },
  { id: 'natur', label: 'Natur — grönt & ljust' },
  { id: 'dark', label: 'Mörk — djupblå & silver' },
  { id: 'sand', label: 'Sand — varm beige' },
  { id: 'ocean', label: 'Ocean — turkos' },
  { id: 'rose', label: 'Rosé — mjuk rosa' },
  { id: 'midnight', label: 'Midnatt — lila' },
];

/** Samma demo som `public/config.json` (`salonSlug`) — inbäddad live-preview */
const PREVIEW_BOOKING_SLUG = 'colorisma';

function CreateSalonLandingPreview({ salonName, themePreset }) {
  const bookingPreviewSrc = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const u = new URL('/', window.location.origin);
    u.searchParams.set('slug', PREVIEW_BOOKING_SLUG);
    const name = (salonName || '').trim();
    if (name) u.searchParams.set('preview_name', name);
    if (themePreset) u.searchParams.set('preview_theme', themePreset);
    return u.pathname + u.search;
  }, [salonName, themePreset]);

  return (
    <div className="superadmin-create-landing-preview">
      <div className="superadmin-create-phone-frame">
        {bookingPreviewSrc ? (
          <iframe
            key={bookingPreviewSrc}
            className="superadmin-create-preview-iframe"
            src={bookingPreviewSrc}
            title="Förhandsvisning av bokningssidan"
          />
        ) : null}
      </div>
    </div>
  );
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'demo';
}

export default function SuperadminTab() {
  const [view, setView] = useState('list');
  const [salons, setSalons] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadSalons = useCallback(() => {
    setLoading(true);
    fetch('/api/superadmin/salons', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setSalons(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSalons();
  }, [loadSalons]);

  const filtered = salons.filter(
    (s) =>
      !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.subdomain?.toLowerCase().includes(search.toLowerCase())
  );

  if (view === 'editor' && selectedId) {
    return (
      <SalongsEditor
        salonId={selectedId}
        onBack={() => {
          setView('list');
          setSelectedId(null);
          loadSalons();
        }}
      />
    );
  }

  if (view === 'create') {
    return (
      <CreateSalonPage
        onBack={() => setView('list')}
        onDone={(payload) => {
          loadSalons();
          if (payload?.salon?.id) {
            setSelectedId(payload.salon.id);
            setView('editor');
          }
        }}
      />
    );
  }

  return (
    <div className="admin-section superadmin-section">
      <div className="admin-section-header superadmin-header">
        <h2 className="admin-section-title">Salonger</h2>
        <button type="button" className="btn-superadmin-gold" onClick={() => setIsAddModalOpen(true)}>
          + Lägg till salong
        </button>
      </div>

      <div className="admin-card superadmin-search-card">
        <input
          type="search"
          className="admin-input"
          placeholder="Sök salong..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="admin-loading">Laddar salonger...</div>
      ) : (
        <div className="admin-table-wrap superadmin-table-wrap">
          <table className="admin-table superadmin-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Subdomän</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="superadmin-row-hover">
                  <td className="sa-td-name">{s.name}</td>
                  <td>
                    <code className="sa-subdomain">{s.subdomain || s.slug}</code>
                  </td>
                  <td className="sa-td-plan">{s.plan || '—'}</td>
                  <td>
                    <span className={`sa-status sa-status--${s.status || 'unknown'}`}>
                      {s.status || '—'}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <ActionsDropdown
                      salon={s}
                      onEdit={() => {
                        setSelectedId(s.id);
                        setView('editor');
                      }}
                      onImpersonate={() => {
                        const token = localStorage.getItem('sb_token');
                        localStorage.setItem('sb_impersonate', JSON.stringify({ salonId: s.id, salonName: s.name }));
                        window.open(`/?salon_id=${s.id}`, '_blank');
                      }}
                      onCopyLink={() => {}}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="admin-empty">Inga salonger matchar sökningen.</p>}
        </div>
      )}
      {isAddModalOpen && (
        <AddSalonModal
          onClose={() => setIsAddModalOpen(false)}
          onDone={(payload) => {
            setIsAddModalOpen(false);
            loadSalons();
            if (payload?.id) {
              setSelectedId(payload.id);
              setView('editor');
            }
          }}
        />
      )}
    </div>
  );
}

function CreateSalonPage({ onBack, onDone }) {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [preset, setPreset] = useState('colorisma');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (name && !subdomain) setSubdomain(slugify(name));
  }, [name, subdomain]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/superadmin/salons', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          subdomain: subdomain.trim() || slugify(name),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          themePreset: preset,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte skapa.');
      setDone(data);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-section superadmin-section superadmin-create-page">
      <div className="superadmin-editor-top">
        <button type="button" className="btn-sm btn-ghost superadmin-back" onClick={onBack}>
          ← Tillbaka till salonger
        </button>
      </div>

      <div className="superadmin-create-inner">
        {!done ? (
          <>
            <h2 className="admin-section-title superadmin-create-title">Lägg till salong</h2>
            <p className="admin-hint superadmin-create-lead">
              Fyll i uppgifterna nedan. Subdomänen föreslås automatiskt utifrån salongens namn.
            </p>
            <form onSubmit={handleCreate} className="superadmin-modal-form superadmin-create-form">
              <label>
                Salongens namn
                <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Subdomän
                <input
                  className="admin-input"
                  value={subdomain}
                  onChange={(e) => setSubdomain(slugify(e.target.value))}
                  placeholder="fylls i automatiskt från namn"
                  required
                />
              </label>
              <label>
                E-post (admin)
                <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Telefon
                <input
                  className="admin-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="070-123 45 67"
                />
              </label>
              <label>
                Adress
                <input
                  className="admin-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Gata 1, 123 45 Stad"
                />
              </label>
              <label>
                Välj tema
                <select className="admin-input" value={preset} onChange={(e) => setPreset(e.target.value)}>
                  {THEME_PRESETS_UI.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <CreateSalonLandingPreview salonName={name} themePreset={preset} />

              {err && <p className="superadmin-error">{err}</p>}
              <div className="superadmin-modal-actions superadmin-create-actions">
                <button type="button" className="btn-sm btn-ghost" onClick={onBack}>
                  Avbryt
                </button>
                <button type="submit" className="btn-superadmin-gold" disabled={busy}>
                  {busy ? 'Skapar…' : 'Skapa salong'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="superadmin-demo-done superadmin-create-done">
            <h2 className="admin-section-title">Salong skapad</h2>
            <p>
              <strong>Publik länk:</strong>{' '}
              <a href={done.demoUrl} target="_blank" rel="noreferrer">
                {done.subdomain}.appbok.se
              </a>
            </p>
            <p className="superadmin-hint">
              <strong>Förhandsvisa lokalt:</strong>{' '}
              <a href={`/?slug=${encodeURIComponent(done.subdomain)}`} target="_blank" rel="noreferrer">
                Öppna startsidan med denna demo
              </a>{' '}
              (samma som <code>?slug={done.subdomain}</code>)
            </p>
            <p className="superadmin-hint">
              Tillfälligt lösenord (admin): <code>{done.tempPassword}</code>
            </p>
            <div className="superadmin-modal-actions superadmin-create-actions">
              <button type="button" className="btn-sm btn-ghost" onClick={onBack}>
                Tillbaka till listan
              </button>
              <button
                type="button"
                className="btn-superadmin-gold"
                onClick={() => window.open(done.demoUrl, '_blank')}
              >
                Öppna
              </button>
              <button type="button" className="btn-superadmin-gold" onClick={() => onDone(done)}>
                Redigera vid behov
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SALON_EDITOR_TABS = [
  { id: 'theme', label: '🎨 Tema' },
  { id: 'services', label: '💇 Tjänster' },
  { id: 'staff', label: '👥 Personal' },
  { id: 'contact', label: '📍 Kontakt' },
  { id: 'hours', label: '⏰ Öppettider' },
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'maps', label: '🗺️ Google Maps' },
  { id: 'texts', label: '✍️ Texter' },
  { id: 'billing', label: '💳 Billing' },
];

function SalongsEditor({ salonId, onBack }) {
  const [tab, setTab] = useState('theme');
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/superadmin/salons/${salonId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setSalon(d?.id ? d : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [salonId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !salon) {
    return <div className="admin-loading">{loading ? 'Laddar…' : 'Salong hittades inte.'}</div>;
  }

  return (
    <div className="admin-section superadmin-section">
      <div className="superadmin-editor-top">
        <button type="button" className="btn-sm btn-ghost superadmin-back" onClick={onBack}>
          ← Tillbaka till lista
        </button>
        <h2 className="admin-section-title">Redigerar: {salon.name}</h2>
      </div>

      <div className="superadmin-subtabs">
        {SALON_EDITOR_TABS.map((t) => (
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

      {tab === 'theme' && <ThemeEditor salon={salon} onSaved={load} />}
      {tab === 'services' && <ServicesEditor salonId={salonId} />}
      {tab === 'staff' && <StaffEditor salonId={salonId} />}
      {tab === 'contact' && <ContactEditor salon={salon} onSaved={load} />}
      {tab === 'hours' && <OpeningHoursEditor salon={salon} onSaved={load} />}
      {tab === 'instagram' && <InstagramHandleEditor salon={salon} onSaved={load} />}
      {tab === 'maps' && <MapEmbedEditor salon={salon} onSaved={load} />}
      {tab === 'texts' && <SalonTextsEditor salon={salon} onSaved={load} />}
      {tab === 'billing' && <BillingEditor salon={salon} onSaved={load} />}
    </div>
  );
}

function contactFromSalon(salon) {
  const c = typeof salon.contact === 'object' && salon.contact !== null && !Array.isArray(salon.contact) ? salon.contact : {};
  return c;
}

function ContactEditor({ salon, onSaved }) {
  const c0 = contactFromSalon(salon);
  const [address, setAddress] = useState(c0.address || '');
  const [phone, setPhone] = useState(c0.phone || '');
  const [email, setEmail] = useState(c0.email || '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
      const res = await fetch(`/api/superadmin/salons/${salon.id}/details`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          contact: { address: address.trim(), phone: phone.trim(), email: email.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      setMsg('Sparat!');
      onSaved?.();
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
      <p className="admin-hint">Adress, telefon och e-post visas för besökare där det är aktiverat på sidan.</p>
      <form className="superadmin-modal-form" onSubmit={save}>
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

function OpeningHoursEditor({ salon, onSaved }) {
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
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/superadmin/salons/${salon.id}/details`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          contact: { opening_hours: text, hours: lines },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      setMsg('Sparat!');
      onSaved?.();
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

function InstagramHandleEditor({ salon, onSaved }) {
  const c0 = contactFromSalon(salon);
  const [handle, setHandle] = useState(c0.instagram_handle != null ? String(c0.instagram_handle) : '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = contactFromSalon(salon);
    setHandle(c.instagram_handle != null ? String(c.instagram_handle) : '');
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/superadmin/salons/${salon.id}/details`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          contact: { instagram_handle: handle.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      setMsg('Sparat!');
      onSaved?.();
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
      <p className="admin-hint">Användarnamn (utan @) som visas i rubriken på startsidan.</p>
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

function MapEmbedEditor({ salon, onSaved }) {
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
      const res = await fetch(`/api/superadmin/salons/${salon.id}/details`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ map_url: mapUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      setMsg('Sparat!');
      onSaved?.();
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

function SalonTextsEditor({ salon, onSaved }) {
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
      const res = await fetch(`/api/superadmin/salons/${salon.id}/details`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          tagline: tagline.trim(),
          contact: { about: about.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      setMsg('Sparat!');
      onSaved?.();
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
      <p className="admin-hint">Välkomsttext under logotypen och en kort &quot;Om oss&quot;-text.</p>
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

function ThemeEditor({ salon, onSaved }) {
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
      const res = await fetch(`/api/superadmin/salons/${salon.id}/theme`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          logo_url: logoUrl,
          accent,
          background,
          text,
          secondary,
          background_image_url: bgImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      setMsg('Sparat!');
      onSaved?.();
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

function ServicesEditor({ salonId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/superadmin/salons/${salonId}/services`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [salonId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id) => {
    if (!confirm('Ta bort tjänsten?')) return;
    await fetch(`/api/superadmin/salons/${salonId}/services/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };

  if (loading) return <div className="admin-loading">Laddar tjänster…</div>;

  return (
    <div className="admin-card">
      <div className="admin-section-header">
        <h3 className="admin-card-title">Tjänster</h3>
        <button type="button" className="btn-superadmin-gold" onClick={() => setModal({})}>
          + Lägg till tjänst
        </button>
      </div>
      <div className="admin-table-wrap superadmin-table-wrap">
        <table className="admin-table superadmin-table">
          <thead>
            <tr>
              <th>Tjänst</th>
              <th>Pris</th>
              <th>Tid</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.price_label || `${(r.price_amount || 0) / 100} kr`}</td>
                <td>{r.duration || '—'}</td>
                <td>
                  <button type="button" className="btn-sm btn-ghost" onClick={() => setModal(r)}>
                    Redigera
                  </button>{' '}
                  <button type="button" className="btn-sm btn-danger" onClick={() => remove(r.id)}>
                    Ta bort
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p className="superadmin-success">{msg}</p>}
      {modal !== null && (
        <ServiceModal
          salonId={salonId}
          initial={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setMsg('Sparat!');
            setTimeout(() => setMsg(''), 2000);
            load();
          }}
        />
      )}
    </div>
  );
}

function ServiceModal({ salonId, initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || '');
  const [priceKr, setPriceKr] = useState(initial ? (initial.price_amount || 0) / 100 : 0);
  const [duration, setDuration] = useState(initial?.duration || '60 min');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = {
      name: name.trim(),
      price_amount: Math.round(Number(priceKr) * 100),
      duration,
      duration_minutes: parseInt(duration, 10) || 60,
      price_label: `${Number(priceKr).toLocaleString('sv-SE')} kr`,
    };
    try {
      const url = initial?.id
        ? `/api/superadmin/salons/${salonId}/services/${initial.id}`
        : `/api/superadmin/salons/${salonId}/services`;
      const res = await fetch(url, {
        method: initial?.id ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      onSaved();
    } catch (x) {
      alert(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="superadmin-modal-overlay" onClick={onClose}>
      <div className="superadmin-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial?.id ? 'Redigera tjänst' : 'Ny tjänst'}</h3>
        <form onSubmit={submit} className="superadmin-modal-form">
          <label>
            Namn
            <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Pris (kr)
            <input
              type="number"
              className="admin-input"
              value={priceKr}
              onChange={(e) => setPriceKr(e.target.value)}
              required
            />
          </label>
          <label>
            Tid
            <input className="admin-input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60 min" />
          </label>
          <div className="superadmin-modal-actions">
            <button type="button" className="btn-sm btn-ghost" onClick={onClose}>
              Avbryt
            </button>
            <button type="submit" className="btn-superadmin-gold" disabled={busy}>
              Spara
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StaffEditor({ salonId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/superadmin/salons/${salonId}/staff`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [salonId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id) => {
    if (!confirm('Ta bort användaren?')) return;
    await fetch(`/api/superadmin/salons/${salonId}/staff/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };

  if (loading) return <div className="admin-loading">Laddar personal…</div>;

  return (
    <div className="admin-card">
      <div className="admin-section-header">
        <h3 className="admin-card-title">Personal</h3>
        <button type="button" className="btn-superadmin-gold" onClick={() => setModal({})}>
          + Lägg till personal
        </button>
      </div>
      <div className="admin-table-wrap superadmin-table-wrap">
        <table className="admin-table superadmin-table">
          <thead>
            <tr>
              <th>Namn</th>
              <th>Roll</th>
              <th>E-post</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.role}</td>
                <td>{r.email}</td>
                <td>
                  <button type="button" className="btn-sm btn-ghost" onClick={() => setModal(r)}>
                    Redigera
                  </button>{' '}
                  <button type="button" className="btn-sm btn-danger" onClick={() => remove(r.id)}>
                    Ta bort
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p className="superadmin-success">{msg}</p>}
      {modal !== null && (
        <StaffModal
          salonId={salonId}
          initial={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={(extra) => {
            setModal(null);
            setMsg(extra?.tempPassword ? `Sparat! Temp lösenord: ${extra.tempPassword}` : 'Sparat!');
            setTimeout(() => setMsg(''), 4000);
            load();
          }}
        />
      )}
    </div>
  );
}

function StaffModal({ salonId, initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [role, setRole] = useState(initial?.role || 'staff');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const url = initial?.id
        ? `/api/superadmin/salons/${salonId}/staff/${initial.id}`
        : `/api/superadmin/salons/${salonId}/staff`;
      const res = await fetch(url, {
        method: initial?.id ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      onSaved(data);
    } catch (x) {
      alert(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="superadmin-modal-overlay" onClick={onClose}>
      <div className="superadmin-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial?.id ? 'Redigera personal' : 'Ny personal'}</h3>
        <form onSubmit={submit} className="superadmin-modal-form">
          <label>
            Namn
            <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            E-post
            <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Roll
            <select className="admin-input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="staff">staff</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <div className="superadmin-modal-actions">
            <button type="button" className="btn-sm btn-ghost" onClick={onClose}>
              Avbryt
            </button>
            <button type="submit" className="btn-superadmin-gold" disabled={busy}>
              Spara
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PLANS = [
  { value: 'demo', label: 'Demo', desc: 'Tidsbegränsad utvärdering' },
  { value: 'trial', label: 'Trial', desc: 'Testperiod (14 dagar)' },
  { value: 'grund', label: 'Grund', desc: 'Basutrustning för små salonger' },
  { value: 'pro', label: 'Pro', desc: 'Full funktionalitet för växande verksamhet' },
];

const STATUSES = [
  { value: 'active', label: 'Active', color: '#7dcea0' },
  { value: 'inactive', label: 'Inactive', color: '#e0a07d' },
  { value: 'suspended', label: 'Suspended', color: '#e07d7d' },
];

function BillingEditor({ salon, onSaved }) {
  const [plan, setPlan] = useState(salon.plan || 'demo');
  const [status, setStatus] = useState(salon.status || 'active');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlan(salon.plan || 'demo');
    setStatus(salon.status || 'active');
  }, [salon]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/superadmin/salons/${salon.id}/billing`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ plan, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fel');
      setMsg('Sparat!');
      onSaved?.();
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">Billing</h3>
      <p className="admin-hint" style={{ marginBottom: '1.5rem' }}>
        Ändra plan och status för <strong>{salon.name}</strong>.
      </p>

      <div className="superadmin-billing-grid">
        {/* Plan */}
        <div className="superadmin-billing-section">
          <h4>Plan</h4>
          <div className="superadmin-plan-grid">
            {PLANS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`superadmin-plan-card ${plan === p.value ? 'selected' : ''}`}
                onClick={() => setPlan(p.value)}
              >
                <span className="superadmin-plan-label">{p.label}</span>
                <span className="superadmin-plan-desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="superadmin-billing-section">
          <h4>Status</h4>
          <div className="superadmin-status-grid">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`superadmin-status-card ${status === s.value ? 'selected' : ''}`}
                style={{ '--status-color': s.color }}
                onClick={() => setStatus(s.value)}
              >
                <span className="superadmin-status-dot" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="superadmin-billing-actions">
        <button type="button" className="btn-superadmin-gold" onClick={save} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara ändringar'}
        </button>
        {msg && (
          <span className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
