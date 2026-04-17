import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchMergedSalonConfig, displaySalonName } from '../lib/salonPublicConfig.js';

function localYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Första dag att söka lediga tider: dagen efter blockerat datum, men inte före imorgon. */
function firstSearchFromYmd(blockedYmd) {
  const blocked = new Date(`${String(blockedYmd).slice(0, 10)}T12:00:00`);
  blocked.setDate(blocked.getDate() + 1);
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = blocked > tomorrow ? blocked : tomorrow;
  return localYmd(start);
}

export default function RebookPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const blockedDate = searchParams.get('date') || '';
  const stylistParam = searchParams.get('stylist') || '';

  const [salonDisplayName, setSalonDisplayName] = useState('Salongen');
  const [lookup, setLookup] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState('same');

  const [sameSlotsByDate, setSameSlotsByDate] = useState([]);
  const [sameLoading, setSameLoading] = useState(false);

  const [staffList, setStaffList] = useState([]);
  const [otherDate, setOtherDate] = useState('');
  const [otherByStylist, setOtherByStylist] = useState({});
  const [otherLoading, setOtherLoading] = useState(false);

  const [pickStylist, setPickStylist] = useState(null);
  const [pickDate, setPickDate] = useState('');
  const [pickTime, setPickTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formErr, setFormErr] = useState('');

  const fromDate = useMemo(
    () => (blockedDate ? firstSearchFromYmd(blockedDate) : localYmd(new Date(Date.now() + 86400000))),
    [blockedDate],
  );

  useEffect(() => {
    fetchMergedSalonConfig()
      .then((d) => setSalonDisplayName(displaySalonName(d.salonName)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      setLoadErr('Saknar ombokningslänk (token).');
      setLoading(false);
      return;
    }
    fetch(`/api/bookings/rebook/lookup?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Kunde inte hämta bokningen.');
        setLookup(data);
      })
      .catch((e) => setLoadErr(e.message || 'Fel'))
      .finally(() => setLoading(false));
  }, [token]);

  const originalStylistId = lookup?.booking?.stylist_id;
  const salonId = lookup?.booking?.salon_id;
  const stylistName = lookup?.stylist?.name || 'din stylist';

  const loadSameStylist = useCallback(async () => {
    if (!originalStylistId || !fromDate) return;
    setSameLoading(true);
    setFormErr('');
    try {
      const u = new URL('/api/calendar/available', window.location.origin);
      u.searchParams.set('stylist_id', originalStylistId);
      u.searchParams.set('from', fromDate);
      u.searchParams.set('days', '14');
      const r = await fetch(u.toString());
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Kunde inte hämta tider.');
      setSameSlotsByDate(Array.isArray(data.dates) ? data.dates : []);
    } catch (e) {
      setFormErr(e.message || 'Fel');
      setSameSlotsByDate([]);
    } finally {
      setSameLoading(false);
    }
  }, [originalStylistId, fromDate]);

  useEffect(() => {
    if (lookup && tab === 'same') loadSameStylist();
  }, [lookup, tab, loadSameStylist]);

  const loadStaff = useCallback(async () => {
    if (!salonId) return;
    try {
      const r = await fetch(`/api/staff?salon_id=${encodeURIComponent(salonId)}`);
      const data = await r.json().catch(() => []);
      const list = Array.isArray(data) ? data.filter((s) => s.id && s.id !== 'any') : [];
      setStaffList(list);
    } catch {
      setStaffList([]);
    }
  }, [salonId]);

  useEffect(() => {
    if (lookup && tab === 'other') loadStaff();
  }, [lookup, tab, loadStaff]);

  useEffect(() => {
    if (tab === 'other' && fromDate && !otherDate) setOtherDate(fromDate);
  }, [tab, fromDate, otherDate]);

  const loadOtherSlots = useCallback(async () => {
    if (!salonId || !otherDate || staffList.length === 0) return;
    setOtherLoading(true);
    setFormErr('');
    const next = {};
    try {
      await Promise.all(
        staffList.map(async (s) => {
          const u = new URL('/api/booking-availability', window.location.origin);
          u.searchParams.set('salon_id', salonId);
          u.searchParams.set('stylist_id', s.id);
          u.searchParams.set('date', otherDate);
          const r = await fetch(u.toString());
          const data = await r.json().catch(() => ({}));
          next[s.id] = Array.isArray(data.slots) ? data.slots : [];
        }),
      );
      setOtherByStylist(next);
    } catch (e) {
      setFormErr(e.message || 'Fel');
    } finally {
      setOtherLoading(false);
    }
  }, [salonId, otherDate, staffList]);

  useEffect(() => {
    if (tab === 'other' && otherDate && staffList.length) loadOtherSlots();
  }, [tab, otherDate, staffList, loadOtherSlots]);

  async function confirmRebook() {
    if (!token || !pickStylist || !pickDate || !pickTime) {
      setFormErr('Välj datum och tid.');
      return;
    }
    setSubmitting(true);
    setFormErr('');
    try {
      const res = await fetch('/api/bookings/rebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_stylist_id: pickStylist,
          new_date: pickDate,
          new_time: pickTime,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte omboka.');
      setDone(true);
    } catch (e) {
      setFormErr(e.message || 'Fel');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="cancel-page">
        <div className="cancel-card">
          <p className="cancel-message">Laddar…</p>
        </div>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="cancel-page">
        <div className="cancel-card">
          <h1 className="cancel-heading">Kan inte omboka</h1>
          <p className="cancel-message">{loadErr}</p>
          <button type="button" className="btn-back-home" onClick={() => navigate('/')}>
            Till startsidan
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="cancel-page">
        <div className="cancel-card">
          <h1 className="cancel-heading">Klart!</h1>
          <p className="cancel-message">
            Din nya tid är bokad. Du får en bekräftelse via SMS.
          </p>
          <button type="button" className="btn-back-home" onClick={() => navigate('/')}>
            Till startsidan
          </button>
        </div>
      </div>
    );
  }

  const b = lookup?.booking;

  return (
    <div className="cancel-page">
      <div className="cancel-card" style={{ maxWidth: 520 }}>
        <h1 className="cancel-heading">Boka om</h1>
        <p className="cancel-message" style={{ marginBottom: '1rem' }}>
          {salonDisplayName}: din tid {b?.booking_date} kl {String(b?.booking_time || '').slice(0, 5)} med{' '}
          {stylistName} behöver bokas om.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={tab === 'same' ? 'btn-admin-primary' : 'btn-sm btn-ghost'}
            style={{ borderRadius: 8, padding: '0.5rem 0.75rem' }}
            onClick={() => {
              setTab('same');
              setPickStylist(null);
              setPickDate('');
              setPickTime('');
            }}
          >
            Boka om med samma stylist
          </button>
          <button
            type="button"
            className={tab === 'other' ? 'btn-admin-primary' : 'btn-sm btn-ghost'}
            style={{ borderRadius: 8, padding: '0.5rem 0.75rem' }}
            onClick={() => {
              setTab('other');
              setPickStylist(null);
              setPickDate('');
              setPickTime('');
            }}
          >
            Välj annan stylist
          </button>
        </div>

        {tab === 'same' && (
          <div>
            <p className="admin-hint" style={{ marginBottom: '0.75rem' }}>
              Lediga tider närmaste 14 dagar från {fromDate}.
            </p>
            {sameLoading ? (
              <p>Hämtar tider…</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 320, overflow: 'auto' }}>
                {sameSlotsByDate.map(({ date, slots }) =>
                  (slots || []).length ? (
                    <li key={date} style={{ marginBottom: '0.75rem' }}>
                      <strong>
                        {new Date(`${date}T12:00:00`).toLocaleDateString('sv-SE', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 6 }}>
                        {slots.map((slot) => (
                          <button
                            key={`${date}-${slot}`}
                            type="button"
                            className="btn-sm btn-ghost"
                            style={{
                              border: '1px solid #d1d5db',
                              borderRadius: 8,
                              padding: '0.35rem 0.6rem',
                            }}
                            onClick={() => {
                              setPickStylist(originalStylistId);
                              setPickDate(date);
                              setPickTime(String(slot).slice(0, 5));
                            }}
                          >
                            {String(slot).slice(0, 5)}
                          </button>
                        ))}
                      </div>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
        )}

        {tab === 'other' && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Datum
              <input
                type="date"
                className="admin-input"
                style={{ display: 'block', marginTop: 4, width: '100%', maxWidth: 280 }}
                value={otherDate}
                min={fromDate}
                onChange={(e) => setOtherDate(e.target.value)}
              />
            </label>
            {otherLoading ? (
              <p>Hämtar tider…</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflow: 'auto' }}>
                {staffList.map((s) => {
                  const slots = otherByStylist[s.id] || [];
                  if (!slots.length) return null;
                  return (
                    <li key={s.id} style={{ marginBottom: '0.75rem' }}>
                      <strong>{s.name}</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 6 }}>
                        {slots.map((slot) => (
                          <button
                            key={`${s.id}-${slot}`}
                            type="button"
                            className="btn-sm btn-ghost"
                            style={{
                              border: '1px solid #d1d5db',
                              borderRadius: 8,
                              padding: '0.35rem 0.6rem',
                            }}
                            onClick={() => {
                              setPickStylist(s.id);
                              setPickDate(otherDate);
                              setPickTime(String(slot).slice(0, 5));
                            }}
                          >
                            {String(slot).slice(0, 5)}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {pickDate && pickTime && pickStylist ? (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
            }}
          >
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>
              Ny tid:{' '}
              <strong>
                {pickDate} kl {pickTime}
              </strong>
              {tab === 'other' && staffList.find((x) => x.id === pickStylist) ? (
                <> · {staffList.find((x) => x.id === pickStylist).name}</>
              ) : null}
            </p>
            <button
              type="button"
              className="btn-admin-primary"
              disabled={submitting}
              onClick={confirmRebook}
            >
              {submitting ? 'Bokar om…' : 'Bekräfta ombokning'}
            </button>
          </div>
        ) : null}

        {formErr ? <p className="superadmin-error" style={{ marginTop: '0.75rem' }}>{formErr}</p> : null}

        {stylistParam && originalStylistId && String(stylistParam) !== String(originalStylistId) ? (
          <p className="admin-hint" style={{ marginTop: '1rem' }}>
            Obs: länken pekar på en annan stylist än i bokningen — använd länken från ditt SMS.
          </p>
        ) : null}
      </div>
    </div>
  );
}
