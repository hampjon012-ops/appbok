import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CalendarPlus, Download } from 'lucide-react';
import { applyThemeToDocument, fetchMergedSalonConfig } from './lib/salonPublicConfig';
import SalonTenantNotFoundView from './components/SalonTenantNotFoundView.jsx';

function loadCustomerFromStorage() {
  try {
    const raw = sessionStorage.getItem('appbok_customer');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadBookingSummaryFromStorage() {
  try {
    const raw = sessionStorage.getItem('appbok_booking_summary');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function calendarDateToUtcStamp(date, time, durationMinutes = 60) {
  if (!date || !time) return null;
  const [year, month, day] = String(date).split('-').map(Number);
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  const start = new Date(year, month - 1, day, hour, minute, 0);
  const end = new Date(start.getTime() + (Number(durationMinutes) || 60) * 60 * 1000);
  const format = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return { start: format(start), end: format(end) };
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

function safeFilenamePart(value) {
  return String(value || 'salong')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9åäö]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'salong';
}

export default function ThankYou() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const emailFromUrl = searchParams.get('email');
  const phoneFromUrl = searchParams.get('phone');
  const [salonName, setSalonName] = useState('Salongen');
  const [pageState, setPageState] = useState('loading');
  const [missingTenantSlug, setMissingTenantSlug] = useState(null);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [bookingSummary, setBookingSummary] = useState(null);

  useEffect(() => {
    fetchMergedSalonConfig()
      .then((d) => {
        if (d.tenantNotFound) {
          document.title = 'Salongen hittades inte | Appbok';
          setMissingTenantSlug(d.attemptedSlug ?? null);
          setPageState('not_found');
          return;
        }
        setSalonName(d.salonName);
        document.title = `Tack för din bokning – ${d.salonName}`;
        if (d.theme) applyThemeToDocument(d.theme);
        setBookingSummary((prev) => prev ? { ...prev, salonName: prev.salonName || d.salonName } : prev);
        setPageState('ready');
      })
      .catch(() => {
        setPageState('ready');
      });

    // Hämta kunddata från sessionStorage (sätts av App.jsx före redirect)
    const stored = loadCustomerFromStorage();
    if (stored) {
      setCustomer({
        name: stored.name || '',
        email: stored.email || '',
        phone: stored.phone || '',
      });
      const storedSummary = loadBookingSummaryFromStorage();
      if (storedSummary) setBookingSummary(storedSummary);

      const bookingId = stored.bookingId || storedSummary?.bookingId;
      if (bookingId) {
        fetch(`/api/bookings/public?id=${encodeURIComponent(bookingId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data) return;
            setBookingSummary((prev) => ({
              bookingId: data.id || prev?.bookingId,
              serviceName: data.service?.name || prev?.serviceName || 'Bokning',
              date: data.booking_date || prev?.date,
              time: data.booking_time || prev?.time,
              durationMinutes: data.duration_minutes || prev?.durationMinutes || 60,
              stylistName: data.stylist?.name || prev?.stylistName || 'Vald stylist',
              salonName: data.salonName || prev?.salonName || 'Salongen',
            }));
          })
          .catch(() => {});
      }
    } else {
      // Fallback till URL-parametrar (om användaren laddar om sidan och sessionStorage är tom)
      setCustomer({
        name: '',
        email: emailFromUrl || '',
        phone: phoneFromUrl || '',
      });
      const storedSummary = loadBookingSummaryFromStorage();
      if (storedSummary) setBookingSummary(storedSummary);
    }
  }, [emailFromUrl, phoneFromUrl]);

  const generateGoogleCalendarUrl = () => {
    if (!bookingSummary) return '#';
    const stamps = calendarDateToUtcStamp(
      bookingSummary.date,
      bookingSummary.time,
      bookingSummary.durationMinutes,
    );
    if (!stamps) return '#';
    const serviceName = bookingSummary.serviceName || 'Bokning';
    const displaySalonName = bookingSummary.salonName || salonName || 'Salongen';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${serviceName} hos ${displaySalonName}`,
      dates: `${stamps.start}/${stamps.end}`,
      details: `Bokning med ${bookingSummary.stylistName || 'vald stylist'}. Bokad via Appbok.`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const downloadIcsFile = () => {
    if (!bookingSummary) return;
    const stamps = calendarDateToUtcStamp(
      bookingSummary.date,
      bookingSummary.time,
      bookingSummary.durationMinutes,
    );
    if (!stamps) return;
    const serviceName = bookingSummary.serviceName || 'Bokning';
    const displaySalonName = bookingSummary.salonName || salonName || 'Salongen';
    const stylistName = bookingSummary.stylistName || 'vald stylist';
    const uid = `${bookingSummary.bookingId || Date.now()}@appbok.se`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Appbok//Booking//SV',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(uid)}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
      `DTSTART:${stamps.start}`,
      `DTEND:${stamps.end}`,
      `SUMMARY:${escapeIcsText(`${serviceName} hos ${displaySalonName}`)}`,
      `DESCRIPTION:${escapeIcsText(`Bokning med ${stylistName}. Bokad via Appbok.`)}`,
      `LOCATION:${escapeIcsText(displaySalonName)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bokning-${safeFilenamePart(displaySalonName)}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const emailDisplay = customer.email
    ? <strong className="font-semibold">{customer.email}</strong>
    : <span className="text-gray-400">din e-postadress</span>;

  const phoneDisplay = customer.phone
    ? <strong className="font-semibold">{customer.phone}</strong>
    : <span className="text-gray-400">ditt telefonnummer</span>;

  return (
    <div className="thankyou-page">
      <div className="thankyou-card">
        {/* Animated checkmark */}
        <div className="ty-icon">
          <svg viewBox="0 0 52 52" fill="none">
            <circle className="ty-circle" cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2"/>
            <path className="ty-check" d="M14 27l8 8 16-16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 className="ty-heading">Tack för din bokning!</h1>
        <p className="ty-sub">
          Betalningen gick igenom. Du får en bekräftelse via e-post och SMS inom kort.
        </p>

        {sessionId && (
          <p className="ty-session">Boknings-ID: <code>{sessionId.slice(-8).toUpperCase()}</code></p>
        )}

        <div className="ty-details">
          <div className="ty-detail-row">
            <span>📍</span>
            <span>{salonName}</span>
          </div>
          <div className="ty-detail-row">
            <span>📧</span>
            <span>Bekräftelse skickad till: {emailDisplay}</span>
          </div>
          <div className="ty-detail-row">
            <span>💬</span>
            <span>SMS-bekräftelse skickad till: {phoneDisplay}</span>
          </div>
          <div className="ty-detail-row">
            <span>⏰</span>
            <span>Avbokning måste ske senast 24h i förväg</span>
          </div>
        </div>

        {bookingSummary?.date && bookingSummary?.time && (
          <div className="ty-calendar-actions" aria-label="Spara bokningen i kalender">
            <a
              href={generateGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="ty-calendar-btn"
            >
              <CalendarPlus size={18} strokeWidth={1.8} />
              <span>Google Kalender</span>
            </a>
            <button type="button" className="ty-calendar-btn" onClick={downloadIcsFile}>
              <Download size={18} strokeWidth={1.8} />
              <span>Apple / Outlook</span>
            </button>
          </div>
        )}

        <Link to="/" className="ty-back-btn">
          ← Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
}
