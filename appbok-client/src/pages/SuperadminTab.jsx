import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import ActionsDropdown from '../components/ActionsDropdown.jsx';
import AddSalonModal from '../components/AddSalonModal.jsx';
import { getLandingOriginForThemePreview } from '../lib/subdomain.js';

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
const SUPERADMIN_PLAN_OPTIONS = [
  { value: 'demo', label: 'Demo' },
  { value: 'trial', label: 'Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'live', label: 'Live' },
];
const SUPERADMIN_STATUS_OPTIONS = [
  { value: 'demo', label: 'DEMO' },
  { value: 'live', label: 'LIVE' },
  { value: 'inactive', label: 'INAKTIV' },
];

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

function staffRoleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'staff') return 'Personal';
  return role || '—';
}

function fmtStaffCreated(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function SalonStaffPanel({ salon }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    fetch(`/api/superadmin/salons/${salon.id}/staff`, { headers: authHeaders() })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(typeof d.error === 'string' ? d.error : 'Kunde inte hämta personal.');
        }
        return Array.isArray(d) ? d : [];
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'Fel');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salon.id]);

  const loginAs = (member) => {
    localStorage.setItem(
      'sb_superadmin_impersonate',
      JSON.stringify({
        id: member.id,
        name: member.name,
        email: member.email,
        role: 'staff',
        salonId: salon.id,
        salonName: salon.name,
        salonSlug: salon.slug || salon.subdomain,
      }),
    );
    localStorage.setItem(
      'sb_salon',
      JSON.stringify({
        id: salon.id,
        name: salon.name,
        slug: salon.slug || salon.subdomain,
      }),
    );
    window.location.href = '/admin';
  };

  if (loading) return <p className="admin-hint">Laddar personal…</p>;
  if (err) return <p className="superadmin-error">{err}</p>;
  if (!rows.length) {
    return (
      <p className="admin-hint" style={{ margin: 0 }}>
        Ingen personal ännu. Bjud in stylister via Inställningar → Personal.
      </p>
    );
  }

  return (
    <div className="superadmin-salon-staff-panel">
      <h4 className="admin-card-title" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
        Personal
      </h4>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Namn</th>
              <th>E-post</th>
              <th>Roll</th>
              <th>Skapad</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.name || '—'}</td>
                <td>{m.email || '—'}</td>
                <td>{staffRoleLabel(m.role)}</td>
                <td>{fmtStaffCreated(m.created_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn-sm btn-ghost"
                    onClick={() => loginAs(m)}
                    title="Logga in som denna användare"
                  >
                    Logga in som
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrialEditor({ salon }) {
  if (!salon.trial_ends_at) {
    return <span className="sa-muted-cell">Ej aktiv</span>;
  }
  return (
    <span className="sa-readonly-cell">
      {new Date(salon.trial_ends_at).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}
    </span>
  );
}

function fmtSalonDeletedAt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function trialDaysLeft(trialEndsAt) {
  if (!trialEndsAt) return null;
  return Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
}

function superadminPlanLabel(plan) {
  const p = String(plan ?? '').toLowerCase().trim();
  if (p === 'demo') return 'Demo';
  if (p === 'trial') return 'Trial (14 dagar)';
  if (p === 'live') return 'Live';
  return plan ? String(plan) : '—';
}

function monthlyPriceKrInputValue(amount) {
  const ore = Number(amount);
  if (!Number.isFinite(ore)) return '2000';
  return String(Math.round(ore / 100));
}

function trialDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function statusValueForEditor(salon) {
  const st = String(salon?.status || '').toLowerCase();
  if (st === 'live') return 'live';
  if (st === 'inactive' || st === 'suspended' || st === 'paused' || st === 'canceled') return 'inactive';
  return 'demo';
}

function addDaysInputDate(value, days) {
  const base = value ? new Date(`${value}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function SuperadminSalonEditSheet({ salon, onClose, onSaved }) {
  const [name, setName] = useState(salon.name || '');
  const [subdomain, setSubdomain] = useState(salon.subdomain || salon.slug || '');
  const [plan, setPlan] = useState(salon.plan || 'demo');
  const [price, setPrice] = useState(monthlyPriceKrInputValue(salon.monthly_price_amount));
  const [status, setStatus] = useState(statusValueForEditor(salon));
  const [trialEndsAt, setTrialEndsAt] = useState(trialDateInputValue(salon.trial_ends_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const cleanSubdomain = (value) =>
    value.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');

  const save = async (e) => {
    e.preventDefault();
    const amountKr = Number(String(price).replace(',', '.'));
    if (!name.trim()) {
      setError('Salongsnamn krävs.');
      return;
    }
    if (!subdomain.trim()) {
      setError('Subdomän krävs.');
      return;
    }
    if (!Number.isFinite(amountKr) || amountKr < 0) {
      setError('Ange ett giltigt pris.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const detailsRes = await fetch(`/api/superadmin/salons/${salon.id}/details`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim(), subdomain: cleanSubdomain(subdomain) }),
      });
      const detailsData = await detailsRes.json().catch(() => ({}));
      if (!detailsRes.ok) {
        throw new Error(typeof detailsData.error === 'string' ? detailsData.error : 'Kunde inte spara grunduppgifter.');
      }

      const billingStatus = status === 'demo' ? 'active' : status;
      const billingRes = await fetch(`/api/superadmin/salons/${salon.id}/billing`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          plan,
          status: billingStatus,
          monthly_price_amount: Math.round(amountKr * 100),
        }),
      });
      const billingData = await billingRes.json().catch(() => ({}));
      if (!billingRes.ok) {
        throw new Error(typeof billingData.error === 'string' ? billingData.error : 'Kunde inte spara abonnemang.');
      }

      const lifecycleRes = await fetch(`/api/superadmin/salons/${salon.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          status: billingStatus,
          trial_ends_at: trialEndsAt || null,
        }),
      });
      const lifecycleData = await lifecycleRes.json().catch(() => ({}));
      if (!lifecycleRes.ok) {
        throw new Error(typeof lifecycleData.error === 'string' ? lifecycleData.error : 'Kunde inte spara trial.');
      }

      onSaved?.();
    } catch (err) {
      setError(err.message || 'Kunde inte spara ändringarna.');
    } finally {
      setBusy(false);
    }
  };

  const inactivate = async () => {
    const ok = confirm(`Inaktivera salongen "${salon.name}"? Salongen flyttas till Inaktiva och kan återställas senare.`);
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/salons/${salon.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'deleted', deleted_at: new Date().toISOString() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof d.error === 'string' ? d.error : 'Kunde inte inaktivera salongen.');
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Kunde inte inaktivera salongen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sa-sheet-overlay" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget && !busy) onClose();
    }}>
      <aside className="sa-sheet" role="dialog" aria-modal="true" aria-labelledby="sa-edit-sheet-title">
        <div className="sa-sheet-header">
          <div>
            <h3 id="sa-edit-sheet-title" className="sa-sheet-title">Redigera {salon.name}</h3>
            <p className="sa-sheet-subtitle">Uppdatera salongens publika uppgifter, abonnemang och testperiod.</p>
          </div>
          <button type="button" className="sa-sheet-close" onClick={onClose} disabled={busy} aria-label="Stäng">
            ×
          </button>
        </div>

        <form className="sa-sheet-form" onSubmit={save}>
          <div className="sa-sheet-scroll">
            <section className="sa-sheet-section">
              <h4 className="sa-sheet-section-title">Grunduppgifter</h4>
              <label className="sa-sheet-field">
                <span>Salongsnamn</span>
                <input className="sa-sheet-input" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
              </label>
              <label className="sa-sheet-field">
                <span>Subdomän</span>
                <div className="sa-sheet-input-suffix-wrap">
                  <input
                    className="sa-sheet-input sa-sheet-input--suffix"
                    value={subdomain}
                    onChange={(e) => setSubdomain(cleanSubdomain(e.target.value))}
                    disabled={busy}
                  />
                  <span>.appbok.se</span>
                </div>
              </label>
            </section>

            <section className="sa-sheet-section">
              <h4 className="sa-sheet-section-title">Abonnemang</h4>
              <label className="sa-sheet-field">
                <span>Plan</span>
                <select className="sa-sheet-input" value={plan} onChange={(e) => setPlan(e.target.value)} disabled={busy}>
                  {SUPERADMIN_PLAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="sa-sheet-field">
                <span>Pris</span>
                <div className="sa-sheet-input-suffix-wrap">
                  <input
                    className="sa-sheet-input sa-sheet-input--suffix"
                    type="number"
                    min="0"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={busy}
                  />
                  <span>kr/mån</span>
                </div>
              </label>
              <label className="sa-sheet-field">
                <span>Status</span>
                <select className="sa-sheet-input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
                  {SUPERADMIN_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </section>

            <section className="sa-sheet-section">
              <h4 className="sa-sheet-section-title">Testperiod (Trial)</h4>
              <label className="sa-sheet-field">
                <span>Slutdatum för Trial</span>
                <input
                  className="sa-sheet-input"
                  type="date"
                  value={trialEndsAt}
                  onChange={(e) => setTrialEndsAt(e.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="sa-sheet-pill-row" aria-label="Snabbval för trial">
                {[
                  { label: '+7d', days: 7 },
                  { label: '+30d', days: 30 },
                  { label: '+1år', days: 365 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="sa-sheet-pill-btn"
                    onClick={() => setTrialEndsAt(addDaysInputDate(trialEndsAt, item.days))}
                    disabled={busy}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            {error ? <p className="sa-sheet-error">{error}</p> : null}
          </div>

          <footer className="sa-sheet-footer">
            <div className="sa-sheet-footer-actions">
              <button type="button" className="sa-sheet-secondary-btn" onClick={onClose} disabled={busy}>
                Avbryt
              </button>
              <button type="submit" className="sa-sheet-primary-btn" disabled={busy}>
                {busy ? 'Sparar...' : 'Spara ändringar'}
              </button>
            </div>
            <button type="button" className="sa-sheet-danger-btn" onClick={inactivate} disabled={busy}>
              Inaktivera salong
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function SuperadminMonthlyPriceCell({ salon }) {
  return (
    <span className="sa-readonly-cell">{monthlyPriceKrInputValue(salon.monthly_price_amount)} kr/mån</span>
  );
}

/** Salongstatus i superadmin-lista: DEMO / TRIAL + dagar / LIVE (+ rå läge för övrigt) */
function SuperadminSalonStatusCell({ salon }) {
  const st = String(salon?.status ?? '').toLowerCase();

  if (st === 'demo' || st === 'draft') {
    return (
      <span className="sa-status sa-status--demo" style={{ textTransform: 'none' }} title="Demo / förhandsvisning">
        DEMO
      </span>
    );
  }
  if (st === 'active') {
    return (
      <span className="sa-status sa-status--demo" style={{ textTransform: 'none' }} title="Före trial (visas som demo)">
        DEMO
      </span>
    );
  }
  if (st === 'trial') {
    const left = trialDaysLeft(salon.trial_ends_at);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span className="sa-status sa-status--trial" title="Trial">
          TRIAL
        </span>
        {salon.trial_ends_at && left !== null ? (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              background: left > 0 ? '#fffbeb' : '#fee2e2',
              color: left > 0 ? '#854d0e' : '#991b1b',
              border: '1px solid #fde68a',
            }}
            title={salon.trial_ends_at}
          >
            {left > 0 ? `${left} dagar kvar` : 'Trial utgången'}
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>—</span>
        )}
      </div>
    );
  }
  if (st === 'live') {
    return (
      <span className="sa-status sa-status--live" style={{ textTransform: 'none' }} title="Live">
        LIVE
      </span>
    );
  }
  if (st === 'expired') {
    return (
      <span className="sa-status sa-status--inactive" style={{ textTransform: 'none' }}>
        UTGÅNGEN
      </span>
    );
  }

  return (
    <span className={`sa-status sa-status--${st || 'unknown'}`}>{salon.status || '—'}</span>
  );
}

export default function SuperadminTab() {
  const [view, setView] = useState('list');
  const [salons, setSalons] = useState([]);
  const [salonScope, setSalonScope] = useState('active');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editSalon, setEditSalon] = useState(null);
  const [expandedSalonId, setExpandedSalonId] = useState(null);
  const [restoreBusyId, setRestoreBusyId] = useState(null);
  const [permanentModalSalon, setPermanentModalSalon] = useState(null);
  const [permanentNameConfirm, setPermanentNameConfirm] = useState('');
  const [permanentBusy, setPermanentBusy] = useState(false);

  const loadSalons = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetch(`/api/superadmin/salons?scope=${encodeURIComponent(salonScope)}`, { headers: authHeaders() })
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
  }, [salonScope]);

  useEffect(() => {
    loadSalons();
  }, [loadSalons]);

  const handleRestoreSalon = async (salon) => {
    setRestoreBusyId(salon.id);
    try {
      const res = await fetch(`/api/superadmin/salons/${salon.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'live', deleted_at: null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof d.error === 'string' ? d.error : 'Kunde inte återställa salongen.');
      loadSalons();
    } catch (e) {
      alert(e.message || 'Fel');
    } finally {
      setRestoreBusyId(null);
    }
  };

  const permanentNameMatches =
    permanentModalSalon &&
    String(permanentModalSalon.name ?? '').trim() === String(permanentNameConfirm).trim();

  const handlePermanentDeleteSalon = async () => {
    if (!permanentModalSalon || !permanentNameMatches) return;
    setPermanentBusy(true);
    try {
      const res = await fetch(`/api/superadmin/salons/${permanentModalSalon.id}/permanent`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof d.error === 'string' ? d.error : 'Kunde inte radera salongen permanent.');
      }
      setPermanentModalSalon(null);
      setPermanentNameConfirm('');
      loadSalons();
    } catch (e) {
      alert(e.message || 'Fel');
    } finally {
      setPermanentBusy(false);
    }
  };

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

      <div className="superadmin-subtabs" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`superadmin-subtab ${salonScope === 'active' ? 'active' : ''}`}
          onClick={() => {
            setSalonScope('active');
            setExpandedSalonId(null);
          }}
        >
          Aktiva
        </button>
        <button
          type="button"
          className={`superadmin-subtab ${salonScope === 'inactive' ? 'active' : ''}`}
          onClick={() => {
            setSalonScope('inactive');
            setExpandedSalonId(null);
          }}
        >
          Inaktiva
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
      ) : salonScope === 'inactive' ? (
        <div className="admin-table-wrap superadmin-table-wrap">
          <table className="admin-table superadmin-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Raderad</th>
                <th style={{ textAlign: 'right' }}>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="superadmin-row-hover">
                  <td className="sa-td-name">{s.name}</td>
                  <td>{fmtSalonDeletedAt(s.deleted_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <button
                        type="button"
                        className="btn-sm btn-ghost"
                        disabled={restoreBusyId === s.id}
                        onClick={() => handleRestoreSalon(s)}
                      >
                        {restoreBusyId === s.id ? 'Återställer…' : 'Återställ'}
                      </button>
                      <button
                        type="button"
                        className="btn-sm"
                        disabled={restoreBusyId === s.id}
                        style={{
                          color: '#991b1b',
                          border: '1px solid #fecaca',
                          background: '#fff',
                          fontWeight: 600,
                        }}
                        onClick={() => {
                          setPermanentNameConfirm('');
                          setPermanentModalSalon(s);
                        }}
                      >
                        ⚠️ Radera permanent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="admin-empty">Inga inaktiva salonger{search ? ' matchar sökningen' : ''}.</p>
          ) : null}
        </div>
      ) : (
        <div className="admin-table-wrap superadmin-table-wrap">
          <table className="admin-table superadmin-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Subdomän</th>
                <th>Plan</th>
                <th>Pris</th>
                <th>Status</th>
                <th>Trial-slut</th>
                <th>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <Fragment key={s.id}>
                  <tr className="superadmin-row-hover">
                    <td className="sa-td-name">{s.name}</td>
                    <td>
                      <span className="sa-subdomain">{s.subdomain || s.slug || '—'}</span>
                    </td>
                    <td className="sa-td-plan">{superadminPlanLabel(s.plan)}</td>
                    <td>
                      <SuperadminMonthlyPriceCell salon={s} />
                    </td>
                    <td>
                      <SuperadminSalonStatusCell salon={s} />
                    </td>
                    <td>
                      <TrialEditor salon={s} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="sa-table-actions-cell">
                        <ActionsDropdown
                          salon={s}
                          onEdit={() => setEditSalon(s)}
                          onViewStaff={() => setExpandedSalonId((cur) => (cur === s.id ? null : s.id))}
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
                        />
                      </div>
                    </td>
                  </tr>
                  {expandedSalonId === s.id ? (
                    <tr className="superadmin-staff-expansion-row">
                      <td colSpan={7} style={{ background: '#fafaf9', padding: '1rem 1.25rem', borderTop: '1px solid #e7e5e4' }}>
                        <SalonStaffPanel salon={s} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
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
      {editSalon ? (
        <SuperadminSalonEditSheet
          salon={editSalon}
          onClose={() => setEditSalon(null)}
          onSaved={() => {
            setEditSalon(null);
            loadSalons();
          }}
        />
      ) : null}
      {permanentModalSalon ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !permanentBusy) {
              setPermanentModalSalon(null);
              setPermanentNameConfirm('');
            }
          }}
        >
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="permanent-delete-title"
            style={{ maxWidth: '460px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="close-btn"
              aria-label="Stäng"
              disabled={permanentBusy}
              onClick={() => {
                setPermanentModalSalon(null);
                setPermanentNameConfirm('');
              }}
            >
              &times;
            </button>
            <h3
              id="permanent-delete-title"
              style={{ marginTop: 0, fontSize: '1.15rem', color: '#991b1b', fontWeight: 700 }}
            >
              ⚠️ VARNING: Detta kan inte ångras!
            </h3>
            <p style={{ margin: '0.75rem 0', color: '#444', lineHeight: 1.55 }}>
              Att radera salongen permanent tar bort:
            </p>
            <ul style={{ margin: '0 0 1rem 1.1rem', padding: 0, color: '#444', lineHeight: 1.6 }}>
              <li>Alla bokningar</li>
              <li>Alla kunduppgifter</li>
              <li>All betalningshistorik</li>
            </ul>
            <label htmlFor="permanent-salon-name-confirm" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, color: '#374151' }}>
              Ange SALONGENS NAMN för att bekräfta:
            </label>
            <p className="admin-hint" style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              Skriv exakt: <strong>{permanentModalSalon.name}</strong>
            </p>
            <input
              id="permanent-salon-name-confirm"
              type="text"
              className="admin-input"
              autoComplete="off"
              value={permanentNameConfirm}
              onChange={(e) => setPermanentNameConfirm(e.target.value)}
              disabled={permanentBusy}
              placeholder="Salongens namn"
            />
            <div className="superadmin-modal-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-sm btn-ghost"
                disabled={permanentBusy}
                onClick={() => {
                  setPermanentModalSalon(null);
                  setPermanentNameConfirm('');
                }}
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={!permanentNameMatches || permanentBusy}
                style={{
                  background: permanentNameMatches && !permanentBusy ? '#b91c1c' : '#d1d5db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  fontWeight: 600,
                  cursor: permanentNameMatches && !permanentBusy ? 'pointer' : 'not-allowed',
                }}
                onClick={handlePermanentDeleteSalon}
              >
                {permanentBusy ? 'Raderar…' : 'Radera permanent'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
