import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMergedSalonConfig, displaySalonName } from '../lib/salonPublicConfig.js';

function fmtDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtPrice(öre) {
  return `${(öre / 100).toLocaleString('sv-SE')} kr`;
}

export default function BookingCancel() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [salonName, setSalonName] = useState('Salongen');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    fetchMergedSalonConfig()
      .then((d) => setSalonName(displaySalonName(d.salonName)))
      .catch(() => {});

    if (!id) {
      setError('Ingen bokning angiven.');
      setLoading(false);
      return;
    }

    fetch(`/api/bookings/public?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.id) {
          setError('Bokningen hittades inte.');
        } else if (data.status === 'cancelled') {
          setError('Den här bokningen är redan avbokad.');
        } else {
          setBooking(data);
        }
      })
      .catch(() => setError('Kunde inte hämta bokningen.'))
      .finally(() => setLoading(false));
  }, [id]);

  function hoursUntil(dateStr, timeStr) {
    if (!dateStr || !timeStr) return Infinity;
    const [h, m] = timeStr.split(':').map(Number);
    const bookingDate = new Date(dateStr + 'T00:00:00');
    bookingDate.setHours(h, m, 0, 0);
    const diffMs = bookingDate.getTime() - Date.now();
    return diffMs / (1000 * 60 * 60);
  }

  async function handleCancel() {
    if (!confirm('Är du säker på att du vill avboka? Beloppet återbetalas till ditt kort.')) return;
    setCancelling(true);
    setCancelError('');
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte avboka.');
      setCancelled(true);
    } catch (err) {
      setCancelError(err.message || 'Något gick fel vid avbokningen.');
      setCancelling(false);
    }
  }

  if (loading) return <div className="loading-screen">Laddar...</div>;
  if (error) {
    return (
      <div className="cancel-page">
        <div className="cancel-card">
          <div className="cancel-icon cancel-icon--error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="cancel-heading">Oj!</h1>
          <p className="cancel-message">{error}</p>
          <button className="btn-back-home" onClick={() => navigate('/')}>
            Tillbaka till startsidan
          </button>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="cancel-page">
        <div className="cancel-card">
          <div className="cancel-icon cancel-icon--success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <h1 className="cancel-heading">Tid avbokad</h1>
          <p className="cancel-message">
            Din tid hos <strong>{booking?.salonName || salonName}</strong> är nu avbokad.
            Beloppet återbetalas till ditt kort inom 3–5 bankdagar.
          </p>
          <button className="btn-back-home" onClick={() => navigate('/')}>
            Tillbaka till startsidan
          </button>
        </div>
      </div>
    );
  }

  const hours = hoursUntil(booking?.booking_date, booking?.booking_time);
  const canCancelOnline = hours > 24;
  const salonDisplay = booking?.salonName || salonName;

  return (
    <div className="cancel-page">
      <div className="cancel-card">
        <h1 className="cancel-heading">Avboka tid</h1>

        <div className="cancel-summary">
          <div className="cancel-row">
            <span className="cancel-label">Salong</span>
            <span className="cancel-value">{salonDisplay}</span>
          </div>
          <div className="cancel-row">
            <span className="cancel-label">Tjänst</span>
            <span className="cancel-value">{booking?.service?.name || '—'}</span>
          </div>
          <div className="cancel-row">
            <span className="cancel-label">Datum</span>
            <span className="cancel-value">{fmtDateLong(booking?.booking_date)}</span>
          </div>
          <div className="cancel-row">
            <span className="cancel-label">Tid</span>
            <span className="cancel-value">{booking?.booking_time}</span>
          </div>
          <div className="cancel-row cancel-row--price">
            <span className="cancel-label">Pris</span>
            <span className="cancel-value">{fmtPrice(booking?.amount_paid || 0)}</span>
          </div>
        </div>

        {canCancelOnline ? (
          <>
            <p className="cancel-policy">
              Avbokning senare än 24 timmar före tid medför 50% avgift. Förskottsbetalning återbetalas inte vid sen avbokning.
            </p>
            <button
              className="btn-cancel-booking"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Avbokar...' : 'Avboka och återbetala'}
            </button>
          </>
        ) : (
          <div className="cancel-late-notice">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <p>
              <strong>Tiden för fri avbokning online har passerat.</strong><br />
              Vänligen kontakta salongen direkt för att avboka.<br />
              Sen avbokning debiteras enligt salongens villkor.
            </p>
          </div>
        )}

        {cancelError && <p className="cancel-error">{cancelError}</p>}

        <button className="btn-back-home" onClick={() => navigate('/')}>
          Tillbaka till startsidan
        </button>
      </div>
    </div>
  );
}
