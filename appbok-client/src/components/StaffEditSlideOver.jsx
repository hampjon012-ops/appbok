import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, User, CalendarCheck, CalendarOff, Loader2 } from 'lucide-react';
import { adminApiHeaders, adminApiHeadersForUpload } from '../lib/adminApiHeaders.js';

/**
 * Slide-over: redigera personal (namn, titel, profilbild, kalenderstatus).
 */
export default function StaffEditSlideOver({ staff, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [calConnected, setCalConnected] = useState(false);
  const [calBusy, setCalBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadCalendarStatus = useCallback(async () => {
    if (!staff?.id) return;
    setCalLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/staff/${staff.id}/calendar-status`, { headers: adminApiHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte läsa kalenderstatus.');
      setCalConnected(!!data.connected);
    } catch (e) {
      setErr(e.message);
    } finally {
      setCalLoading(false);
    }
  }, [staff?.id]);

  useEffect(() => {
    if (!staff) return;
    setName(staff.name || '');
    setTitle(staff.title || '');
    setPhotoUrl(staff.photo_url || '');
    setMsg('');
    setErr('');
    loadCalendarStatus();
  }, [staff, loadCalendarStatus]);

  useEffect(() => {
    if (!staff) return;
    const onFocus = () => {
      loadCalendarStatus();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [staff, loadCalendarStatus]);

  useEffect(() => {
    if (!staff) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [staff, onClose]);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !staff?.id) return;
    setUploading(true);
    setErr('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch(`/api/staff/${staff.id}/photo-upload`, {
        method: 'POST',
        headers: adminApiHeadersForUpload(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uppladdning misslyckades.');
      const url = data.photo_url || data.user?.photo_url;
      if (url) setPhotoUrl(url);
      if (data.user && typeof onSaved === 'function') onSaved(data.user);
      setMsg('Profilbild uppdaterad.');
      window.setTimeout(() => setMsg(''), 2500);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!staff?.id) return;
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: 'PUT',
        headers: adminApiHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      if (typeof onSaved === 'function') onSaved(data);
      onClose();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCalendarConnect = async () => {
    if (!staff?.id) return;
    setCalBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/staff/${staff.id}/calendar-connect-url`, { headers: adminApiHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte hämta anslutningslänk.');
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        setMsg('Öppnade Google i ny flik — logga in med kontot som ska kopplas till denna medarbetare.');
        window.setTimeout(() => setMsg(''), 8000);
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleCalendarDisconnect = async () => {
    if (!staff?.id) return;
    if (!window.confirm('Koppla från Google Kalender för denna medarbetare?')) return;
    setCalBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/staff/${staff.id}/calendar-tokens`, {
        method: 'DELETE',
        headers: adminApiHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte koppla från.');
      setCalConnected(false);
      setMsg('Kalender kopplad från.');
      window.setTimeout(() => setMsg(''), 2500);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCalBusy(false);
    }
  };

  if (!staff) return null;

  return createPortal(
    <div className="staff-edit-overlay" role="dialog" aria-modal="true" aria-labelledby="staff-edit-title">
      <button type="button" className="staff-edit-overlay__backdrop" aria-label="Stäng" onClick={onClose} />
      <div className="staff-edit-panel">
        <div className="staff-edit-panel__header">
          <h2 id="staff-edit-title" className="staff-edit-panel__title">
            Redigera profil
          </h2>
          <button type="button" className="staff-edit-panel__close" onClick={onClose} aria-label="Stäng">
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSave} className="staff-edit-panel__form">
          <div className="staff-edit-panel__body">
            {err ? <p className="staff-edit-msg staff-edit-msg--err">{err}</p> : null}
            {msg ? <p className="staff-edit-msg staff-edit-msg--ok">{msg}</p> : null}

            <section className="staff-edit-section">
              <h3 className="staff-edit-section-title">Profilbild</h3>
              <div className="staff-edit-photo-row">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="staff-edit-avatar-img" />
                ) : (
                  <div className="staff-edit-avatar-placeholder">
                    <User className="staff-avatar-icon-admin" />
                  </div>
                )}
                <div className="staff-edit-photo-actions">
                  <label className="staff-edit-upload-label">
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="staff-edit-file-input" onChange={handlePhoto} disabled={uploading} />
                    {uploading ? (
                      <span className="staff-edit-upload-btn staff-edit-upload-btn--busy">
                        <Loader2 className="spinner" size={16} /> Laddar upp…
                      </span>
                    ) : (
                      <span className="staff-edit-upload-btn">Byt profilbild</span>
                    )}
                  </label>
                  <p className="staff-edit-hint">PNG, JPG eller WebP, max 3 MB.</p>
                </div>
              </div>
            </section>

            <section className="staff-edit-section">
              <h3 className="staff-edit-section-title">Grunddata</h3>
              <div className="staff-edit-fields">
                <label className="staff-edit-field">
                  <span className="staff-edit-label">Namn</span>
                  <input
                    type="text"
                    className="staff-edit-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Emma Lindqvist"
                    autoComplete="name"
                  />
                </label>
                <label className="staff-edit-field">
                  <span className="staff-edit-label">Titel / roll</span>
                  <input
                    type="text"
                    className="staff-edit-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Senior kolorist"
                  />
                </label>
              </div>
            </section>

            <section className="staff-edit-section">
              <h3 className="staff-edit-section-title">Google Kalender</h3>
              <p className="staff-edit-hint staff-edit-hint--block">
                Kalendersynk sker per medarbetare. Efter anslutning i ny flik kan du behöva ladda om sidan för att se uppdaterad status.
              </p>
              <div className="staff-edit-cal-box">
                {calLoading ? (
                  <p className="staff-edit-cal-status">
                    <Loader2 className="spinner" size={16} /> Kontrollerar…
                  </p>
                ) : (
                  <p className={`staff-edit-cal-status ${calConnected ? 'staff-edit-cal-status--ok' : 'staff-edit-cal-status--warn'}`}>
                    {calConnected ? (
                      <>
                        <CalendarCheck size={16} strokeWidth={2} aria-hidden />
                        <span>Kalender kopplad</span>
                      </>
                    ) : (
                      <>
                        <CalendarOff size={16} strokeWidth={2} aria-hidden />
                        <span>Kalender ej kopplad</span>
                      </>
                    )}
                  </p>
                )}
                <div className="staff-edit-cal-actions">
                  {calConnected ? (
                    <button
                      type="button"
                      className="staff-edit-btn-secondary"
                      onClick={handleCalendarDisconnect}
                      disabled={calBusy}
                    >
                      {calBusy ? '…' : 'Koppla från'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="staff-edit-btn-primary-soft"
                      onClick={handleCalendarConnect}
                      disabled={calBusy || calLoading}
                    >
                      {calBusy ? 'Öppnar…' : 'Anslut Google Kalender'}
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="staff-edit-panel__footer">
            <button type="button" className="staff-edit-footer-cancel" onClick={onClose} disabled={saving}>
              Avbryt
            </button>
            <button type="submit" className="staff-edit-footer-save" disabled={saving}>
              {saving ? 'Sparar…' : 'Spara ändringar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
