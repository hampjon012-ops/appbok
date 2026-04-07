import { useState, useEffect } from 'react';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'demo';
}

const THEMES = [
  {
    id: 'colorisma',
    label: 'Standard',
    desc: 'Samma layout & färger som Appbok-demo',
    colors: { bg: '#F5F4F0', accent: '#6f4e37', secondary: '#EBE8E3', text: '#383838' },
  },
  {
    id: 'lux',
    label: 'Lyx',
    desc: 'Mörk & guld',
    colors: { bg: '#1A1A1A', accent: '#6f4e37', secondary: '#2A2A2A', text: '#FFFFFF' },
  },
  {
    id: 'modern',
    label: 'Modern',
    desc: 'Vitt & rosa',
    colors: { bg: '#FFF9F9', accent: '#E8B4B8', secondary: '#F5E6E8', text: '#1A1A1A' },
  },
];

function ThemeCard({ theme, selected, onSelect }) {
  const { label, desc, colors } = theme;
  return (
    <button
      type="button"
      className={`sa-theme-card ${selected ? 'sa-theme-card--selected' : ''}`}
      onClick={() => onSelect(theme.id)}
      aria-pressed={selected}
    >
      {/* Color preview */}
      <div className="sa-theme-preview" style={{ background: colors.bg }}>
        <div className="sa-theme-preview-bar" style={{ background: colors.accent }} />
        <div className="sa-theme-preview-lines">
          <div style={{ background: colors.secondary, height: 6, borderRadius: 3, marginBottom: 4 }} />
          <div style={{ background: colors.secondary, height: 6, borderRadius: 3, width: '70%' }} />
        </div>
        <div
          className="sa-theme-preview-btn"
          style={{ background: colors.accent, color: colors.bg }}
        >
          Boka
        </div>
      </div>
      <div className="sa-theme-label">
        <span className="sa-theme-name">{label}</span>
        <span className="sa-theme-desc">{desc}</span>
      </div>
      {selected && (
        <div className="sa-theme-check">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </button>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
  };
}

export default function AddSalonModal({ onClose, onDone }) {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [themeId, setThemeId] = useState('colorisma');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  // Auto-generate subdomain from name
  useEffect(() => {
    if (name && !done) {
      const s = slugify(name);
      setSubdomain(s);
    }
  }, [name, done]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/superadmin/salons', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          subdomain: subdomain.trim() || slugify(name),
          themePreset: themeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte skapa salong.');
      setDone(data);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    if (busy) return;
    onClose();
  }

  const demoUrl = done
    ? `https://${done.subdomain}.appbok.se`
    : null;

  return (
    <div className="sa-modal-overlay" onClick={handleClose}>
      <div
        className="sa-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sa-modal-title"
      >
        {/* Header */}
        <div className="sa-modal-header">
          <h2 className="sa-modal-title" id="sa-modal-title">
            {done ? 'Salong skapad' : 'Lägg till salong'}
          </h2>
          <button
            type="button"
            className="sa-modal-close"
            onClick={handleClose}
            aria-label="Stäng"
            disabled={busy}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="sa-modal-body">
          {done ? (
            <div className="sa-modal-success">
              <div className="sa-modal-success-icon">
                <CheckIcon />
              </div>
              <p className="sa-modal-success-name"><strong>{done.name}</strong> är redo!</p>

              <div className="sa-modal-demo-link">
                <LinkIcon />
                <a href={demoUrl} target="_blank" rel="noreferrer" className="sa-modal-link">
                  {demoUrl}
                </a>
              </div>

              {done.tempPassword && (
                <p className="sa-modal-temp-pass">
                  Tillfälligt lösenord: <code>{done.tempPassword}</code>
                </p>
              )}

              <div className="sa-modal-success-actions">
                <button
                  type="button"
                  className="sa-btn sa-btn--ghost"
                  onClick={handleClose}
                >
                  Stäng
                </button>
                <button
                  type="button"
                  className="sa-btn sa-btn--primary"
                  onClick={() => onDone(done)}
                >
                  Redigera vid behov
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="sa-modal-form">
              {/* Name */}
              <div className="sa-field">
                <label className="sa-label" htmlFor="salon-name">
                  Salongens namn
                </label>
                <input
                  id="salon-name"
                  type="text"
                  className="sa-input"
                  placeholder="t.ex. Klippoteket"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Subdomain */}
              <div className="sa-field">
                <label className="sa-label" htmlFor="salon-subdomain">
                  Subdomän
                </label>
                <div className="sa-subdomain-wrap">
                  <input
                    id="salon-subdomain"
                    type="text"
                    className="sa-input"
                    placeholder="klippoteket"
                    value={subdomain}
                    onChange={e => setSubdomain(slugify(e.target.value))}
                    required
                  />
                  <span className="sa-subdomain-suffix">.appbok.se</span>
                </div>
                <p className="sa-hint">Genereras automatiskt från namnet. Kan ändras manuellt.</p>
              </div>

              {/* Theme selector */}
              <div className="sa-field">
                <label className="sa-label">Välj tema</label>
                <div className="sa-theme-grid">
                  {THEMES.map(t => (
                    <ThemeCard
                      key={t.id}
                      theme={t}
                      selected={themeId === t.id}
                      onSelect={setThemeId}
                    />
                  ))}
                </div>
              </div>

              {err && <p className="sa-modal-err">{err}</p>}

              <div className="sa-modal-footer">
                <button
                  type="button"
                  className="sa-btn sa-btn--ghost"
                  onClick={handleClose}
                  disabled={busy}
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="sa-btn sa-btn--primary"
                  disabled={busy || !name.trim()}
                >
                  {busy ? 'Skapar...' : 'Skapa salong & generera länk'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
