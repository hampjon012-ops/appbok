import { useState, useEffect, useCallback, useMemo } from 'react';
import ActionsDropdown from '../components/ActionsDropdown.jsx';
import AddSalonModal from '../components/AddSalonModal.jsx';
import { getLandingOriginForThemePreview } from '../lib/subdomain.js';


function EditIcon(props) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="admin-edit-icon"
      style={{ cursor: 'pointer', color: '#9ca3af', marginLeft: '6px', verticalAlign: 'text-bottom', transition: 'color 0.2s', ...(props.style || {}) }}
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
      <style>{`.admin-edit-icon:hover { color: #4b5563 !important; }`}</style>
    </svg>
  );
}

function EditSalonModal({ salon, onClose, onSaved }) {
  const [name, setName] = useState(salon.name || '');
  const [subdomain, setSubdomain] = useState(salon.subdomain || salon.slug || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubdomainChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
    setSubdomain(val);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/salons/${salon.id}/details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
        },
        body: JSON.stringify({ name: name.trim(), subdomain: subdomain.trim() })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Fel vid sparning.');
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <button type="button" className="close-btn" onClick={onClose}>&times;</button>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 600 }}>Redigera salong</h3>
        <form onSubmit={handleSave} className="superadmin-modal-form">
          <label>
            Namn
            <input 
              className="admin-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
            />
          </label>
          <label>
            Subdomän
            <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '4px', overflow: 'hidden' }}>
              <span style={{ padding: '0 8px', color: '#6b7280', fontSize: '14px', whiteSpace: 'nowrap' }}>https://</span>
              <input 
                value={subdomain} 
                onChange={handleSubdomainChange} 
                required 
                style={{ flex: 1, border: 'none', padding: '10px 4px', fontSize: '14px', outline: 'none', background: 'transparent' }} 
              />
              <span style={{ padding: '0 8px', color: '#6b7280', fontSize: '14px', whiteSpace: 'nowrap' }}>.appbok.se</span>
            </div>
          </label>
          {error && <p className="superadmin-error" style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>}
          <div className="superadmin-modal-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn-sm btn-ghost" onClick={onClose}>Avbryt</button>
            <button type="submit" className="btn-superadmin-gold" disabled={saving}>
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
  };
}

const THEME_PRESETS_UI = [
  { id: 'colorisma', label: 'Standard (samma som demo)' },
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
    const origin = getLandingOriginForThemePreview();
    const u = new URL('/preview/mobile', origin);
    u.searchParams.set('slug', PREVIEW_BOOKING_SLUG);
    u.searchParams.set('preview_embed', '1');
    const name = (salonName || '').trim();
    if (name) u.searchParams.set('preview_name', name);
    if (themePreset) u.searchParams.set('preview_theme', themePreset);
    return u.toString();
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
  const [loadError, setLoadError] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [quickEditSalon, setQuickEditSalon] = useState(null);

  const loadSalons = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetch('/api/superadmin/salons', { headers: authHeaders() })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setSalons([]);
          setLoadError(
            typeof d.error === 'string' && d.error.trim()
              ? d.error
              : r.status === 403
                ? 'Du har inte superadmin-behörighet. Logga ut och in igen, eller kontrollera SUPERADMIN_EMAILS i Vercel.'
                : `Kunde inte hämta salonger (HTTP ${r.status}).`,
          );
          setLoading(false);
          return;
        }
        setSalons(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setLoadError('Nätverksfel vid hämtning av salonger.');
      });
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



  if (view === 'create') {
    return (
      <CreateSalonPage
        onBack={() => setView('list')}
        onDone={() => {
          loadSalons();
          setView('list');
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

      {loadError ? (
        <p className="superadmin-error" style={{ marginBottom: '1rem' }}>
          {loadError}
        </p>
      ) : null}

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
                  <td className="sa-td-name">
                    {s.name}
                    <EditIcon onClick={() => setQuickEditSalon(s)} title="Redigera namn och subdomän" />
                  </td>
                  <td>
                    <code className="sa-subdomain">{s.subdomain || s.slug}</code>
                    <EditIcon onClick={() => setQuickEditSalon(s)} title="Redigera namn och subdomän" />
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
                      onImpersonate={() => {
                        localStorage.setItem('sb_superadmin_impersonate', JSON.stringify(s));
                        localStorage.setItem(
                          'sb_salon',
                          JSON.stringify({
                            id: s.id,
                            name: s.name,
                            slug: s.slug || s.subdomain,
                          }),
                        );
                        window.location.reload();
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
          onDone={() => {
            setIsAddModalOpen(false);
            loadSalons();
          }}
        />
      )}
      {quickEditSalon && (
        <EditSalonModal
          salon={quickEditSalon}
          onClose={() => setQuickEditSalon(null)}
          onSaved={() => {
            setQuickEditSalon(null);
            loadSalons();
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
              <strong>Utan subdomän (t.ex. lokal dev):</strong>{' '}
              <a href={`/?slug=${encodeURIComponent(done.subdomain)}`} target="_blank" rel="noreferrer">
                <code>?slug={done.subdomain}</code>
              </a>{' '}
              — produktion: <code>{done.subdomain}.appbok.se</code>
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

