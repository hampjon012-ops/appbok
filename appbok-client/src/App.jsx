import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { applyThemeToDocument, fetchMergedSalonConfig } from './lib/salonPublicConfig';
import './App.css';

// ─── Helper: generate available dates (next 21 days, skip Sunday) ─────────────
function getAvailableDates() {
  const dates = [];
  const today = new Date();
  for (let i = 1; dates.length < 18; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0) dates.push(d); // skip Sunday
  }
  return dates;
}

const ALL_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

// ─── Helper: format date to Swedish ──────────────────────────────────────────
function fmtDate(d) {
  return d.toLocaleDateString('sv-SE', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtDateLong(d) {
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtPrice(öre) {
  return `${(öre / 100).toLocaleString('sv-SE')} kr`;
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetchMergedSalonConfig()
      .then((merged) => {
        setConfig(merged);
        if (merged.theme) applyThemeToDocument(merged.theme);
        document.title = `${merged.salonName} | Boka Tid`;
      })
      .catch((err) => console.error('Could not load config', err));
  }, []);

  const scrollToBooking = () =>
    document.getElementById('boka-nu').scrollIntoView({ behavior: 'smooth' });

  if (!config) return <div className="loading-screen">Laddar...</div>;

  return (
    <div className="app-wrapper">

      {/* ── HERO ── */}
      <header className="hero-minimal">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          {config.logoUrl && (
            <img src={config.logoUrl} alt={config.salonName} className="hero-logo-img"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
          )}
          <h1 className="hero-logo" style={{ display: config.logoUrl ? 'none' : 'block' }}>{config.salonName}</h1>
          <p className="hero-tagline">{config.tagline}</p>
          <button className="btn-hero" onClick={scrollToBooking}>Boka tid</button>
        </div>
      </header>

      {/* ── INSTAGRAM ── */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>
              @{' '}
              {config.contact?.instagramHandle &&
              config.contact.instagramHandle !== '#'
                ? String(config.contact.instagramHandle).replace(/^@/, '')
                : config.salonName.replace(/\s+/g, '').toLowerCase()}
            </h2>
            <p>Följ oss på Instagram för daglig inspiration.</p>
          </div>
          <div className="insta-grid">
            {config.instagram?.map((img, idx) => (
              <div key={idx} className="insta-item">
                <img src={img} alt="Instagram feed" />
                <div className="insta-overlay"><span>❤️</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {config.contact?.about ? (
        <section className="section">
          <div className="container">
            <h2 className="contact-title">Om oss</h2>
            <p className="about-text" style={{ maxWidth: '42rem', margin: '0 auto', lineHeight: 1.6 }}>
              {config.contact.about}
            </p>
          </div>
        </section>
      ) : null}

      {/* ── BOOKING ── */}
      <BookingSection config={config} />

      {/* ── CONTACT & MAP ── */}
      <section id="kontakt" className="contact-section">
        <div className="container">
          <h2 className="contact-title">Kontakt</h2>
          <div className="contact-grid-layout">
            <div className="contact-info-list">
              <div className="contact-info-item">
                <div className="contact-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div><h4>Adress</h4><p>{config.contact?.address}</p></div>
              </div>
              <div className="contact-info-item">
                <div className="contact-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div><h4>Telefon</h4><p>{config.contact?.phone}</p></div>
              </div>
              <div className="contact-info-item align-top">
                <div className="contact-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <h4>Öppettider</h4>
                  {config.contact?.hours?.map((l, i) => <p key={i}>{l}</p>)}
                </div>
              </div>
            </div>
            <div className="contact-map-container">
              {config.mapUrl && config.mapUrl !== '#'
                ? <iframe src={config.mapUrl} width="100%" height="100%" style={{border:0}} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Karta"></iframe>
                : <div className="map-placeholder">Karta saknas — lägg in Google Maps embed-URL i admin.</div>}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer-simple">
        <div className="container footer-simple-content">
          <p>© {new Date().getFullYear()} {config.salonName}. Alla rättigheter förbehållna.</p>
          <div className="footer-links">
            <a href="#">Integritetspolicy</a>
            <a href="#">Villkor</a>
          </div>
        </div>
      </footer>

      <div className="floating-action mobile-only">
        <button className="btn-floating" onClick={scrollToBooking}>Boka Tid</button>
      </div>
    </div>
  );
}

// ─── BookingSection ───────────────────────────────────────────────────────────
const STEPS = ['service','stylist','time','details','checkout'];

function BookingSection({ config }) {
  const [step, setStep]                   = useState('category');
  const [selectedCategory, setCategory]   = useState(null);
  const [selectedService, setService]     = useState(null);
  const [selectedStylist, setStylist]     = useState(null);
  const [selectedDate, setDate]           = useState(null);
  const [selectedTime, setTime]           = useState(null);
  const [form, setForm]                   = useState({ name:'', phone:'', email:'' });
  const [termsAccepted, setTerms]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [apiError, setApiError]           = useState('');

  // Data from DB
  const [dbCategories, setDbCategories]   = useState(null);
  const [dbStylists, setDbStylists]       = useState(null);

  const salonId = config.salonId || 'a0000000-0000-0000-0000-000000000001';

  /** DB returnerar price_amount / duration_minutes; config.json använder priceAmount / durationMinutes */
  const servicePriceÖre = (svc) => {
    if (!svc) return 0;
    const n = svc.price_amount ?? svc.priceAmount;
    return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  };
  const serviceDurationMin = (svc) => {
    if (!svc) return 60;
    const n = svc.duration_minutes ?? svc.durationMinutes;
    return typeof n === 'number' && n > 0 ? n : 60;
  };

  // Fetch categories+services and stylists from DB
  useEffect(() => {
    fetch(`/api/services?salon_id=${salonId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Map DB format to match existing JSX expectations
          const mapped = data.map(cat => ({
            ...cat,
            services: (cat.services || []).map(svc => ({
              ...svc,
              price: svc.price_label || `Från ${(svc.price_amount / 100).toLocaleString('sv-SE')} kr`,
            })),
          }));
          setDbCategories(mapped);
        }
      })
      .catch(() => console.warn('Kunde inte hämta tjänster från DB, faller tillbaka på config'));

    fetch(`/api/staff?salon_id=${salonId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Map photo_url → photo for existing JSX
          const mapped = data.map(st => ({ ...st, photo: st.photo_url || '' }));
          setDbStylists(mapped);
        }
      })
      .catch(() => console.warn('Kunde inte hämta stylister från DB, faller tillbaka på config'));
  }, [salonId]);

  // Use DB data if available, otherwise fall back to config.json
  const categories = dbCategories || config.categories || [];
  const stylists   = dbStylists   || config.stylists   || [];

  const availableDates = getAvailableDates();
  const [busySlots, setBusySlots] = useState(new Set());
  const [busyLoading, setBusyLoading] = useState(false);

  // Fetch busy slots when date changes
  useEffect(() => {
    if (!selectedDate || !selectedStylist) return;
    setBusyLoading(true);
    setBusySlots(new Set());
    const dateStr = selectedDate.toISOString().slice(0, 10);
    const stylistId = selectedStylist.id;

    Promise.all([
      // Google Calendar busy times
      fetch(`/api/calendar/busy?stylist_id=${stylistId}&date=${dateStr}`)
        .then(r => r.json()).catch(() => ({ busy: [] })),
      // DB bookings for this stylist on this date
      fetch(`/api/bookings/available?stylist_id=${stylistId}&date=${dateStr}`)
        .then(r => r.json()).catch(() => ({ booked: [] })),
    ]).then(([calData, bookData]) => {
      const blocked = new Set();
      // Block slots from Google Calendar
      (calData.busy || []).forEach(b => {
        const start = new Date(b.start);
        const end   = new Date(b.end);
        ALL_SLOTS.forEach(slot => {
          const [h, m] = slot.split(':').map(Number);
          const slotTime = new Date(selectedDate);
          slotTime.setHours(h, m, 0, 0);
          if (slotTime >= start && slotTime < end) blocked.add(slot);
        });
      });
      // Block slots from DB bookings
      (bookData.booked || []).forEach(time => {
        blocked.add(time.slice(0, 5));
      });
      setBusySlots(blocked);
      setBusyLoading(false);
    });
  }, [selectedDate, selectedStylist]);

  // Step index for stepper (0-based, total 6 visual steps including category)
  const stepMap = { category:0, service:1, stylist:2, time:3, details:4, checkout:5 };
  const stepIdx = stepMap[step] ?? 0;
  const totalSteps = 6;

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goBack = () => {
    const prev = { service:'category', stylist:'service', time:'stylist', details:'time', checkout:'details' };
    if (prev[step]) setStep(prev[step]);
  };

  const handleSelectCategory = cat => { setCategory(cat); setService(null); setStylist(null); setStep('service'); };
  const handleSelectService  = svc => { setService(svc);  setStylist(null); setStep('stylist'); };
  const handleSelectStylist  = st  => {
    setStylist(st);
    setDate(null); setTime(null); setBusySlots(new Set());
    setStep('time');
  };
  const handleContinueTime   = ()  => setStep('details');
  const handleContinueDetails= ()  => setStep('checkout');

  // ── Stripe checkout ───────────────────────────────────────────────────────
  const handlePay = async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName:   selectedService.name,
          priceAmount:   servicePriceÖre(selectedService),
          currency:      config.stripe?.currency || 'sek',
          salonName:     config.salonName,
          stylistName:   selectedStylist?.name || 'Valfri stylist',
          date:          selectedDate ? fmtDateLong(selectedDate) : '',
          time:          selectedTime,
          customerName:  form.name,
          customerEmail: form.email,
        }),
      });
      const data = await res.json();
      
      // Fallback behavior: If Stripe isn't configured, book directly
      if (res.status === 503) {
        setApiError('Stripe är ej konfigurerat. Simulerar en lyckad bokning istället...');
        const bookRes = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salon_id: config.salonId,
            service_id: selectedService.id,
            stylist_id: selectedStylist?.id || 'any',
            customer_name: form.name,
            customer_email: form.email,
            customer_phone: form.phone,
            booking_date: selectedDate.toISOString().slice(0, 10),
            booking_time: selectedTime,
            duration_minutes: serviceDurationMin(selectedService),
            amount_paid: servicePriceÖre(selectedService),
            stripe_session_id: 'test_session_bypass'
          })
        });
        if (bookRes.ok) {
          window.location.href = '/tack';
          return;
        } else {
          const bd = await bookRes.json();
          throw new Error(bd.error || 'Databasfel vid simulering.');
        }
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setApiError(data.error || 'Något gick fel. Försök igen.');
        setLoading(false);
      }
    } catch (err) {
      setApiError(err.message || 'Kan inte nå betalservern.');
      setLoading(false);
    }
  };

  // ── Summary pill helper ───────────────────────────────────────────────────
  const SummaryPill = () => selectedService && (
    <div className="selected-service-summary">
      <span className="ss-name">{selectedService.name}</span>
      <span className="ss-meta">{selectedService.duration} · {selectedService.price}</span>
    </div>
  );

  return (
    <section id="boka-nu" className="section booking-bg">
      <div className="container booking-container">
        <div className="section-header">
          <h2>Boka tid</h2>
          <p>Välj tjänst, datum och tid för din bokning.</p>
        </div>

        {/* Stepper */}
        <div className="stepper-nav">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`stepper-dot ${i < stepIdx ? 'completed' : i === stepIdx ? 'active' : ''}`} />
          ))}
        </div>

        <div className="booking-card-main">

          {/* ── STEG 1: Välj kategori ─────────────────────────────────────── */}
          {step === 'category' && (
            <>
              <h3 className="booking-step-title">Välj kategori</h3>
              <div className="category-selection-list">
                {categories.map(cat => (
                  <button key={cat.id} className="category-selection-btn" onClick={() => handleSelectCategory(cat)}>
                    <div className="cat-sel-info">
                      <h4>{cat.name}</h4>
                      <p>{cat.description}</p>
                    </div>
                    <div className="cat-sel-count">{cat.services.length} val</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEG 2: Välj tjänst ───────────────────────────────────────── */}
          {step === 'service' && selectedCategory && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">{selectedCategory.name}</h3>
              </div>
              <div className="category-selection-list">
                {selectedCategory.services.map(svc => (
                  <button key={svc.id} className="category-selection-btn" onClick={() => handleSelectService(svc)}>
                    <div className="cat-sel-info">
                      <h4>{svc.name}</h4>
                      <p>{svc.duration}</p>
                    </div>
                    <div className="cat-sel-count">{svc.price}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEG 3: Välj stylist ──────────────────────────────────────── */}
          {step === 'stylist' && selectedService && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">Välj stylist</h3>
              </div>
              <SummaryPill />
              <div className="category-selection-list">
                {stylists.map(st => (
                  <button
                    key={st.id}
                    className={`category-selection-btn stylist-row-btn ${selectedStylist?.id === st.id ? 'selected' : ''}`}
                    onClick={() => handleSelectStylist(st)}
                  >
                    <div className="stylist-row-left">
                      <div className="stylist-avatar-sm">
                        {st.photo
                          ? <img src={st.photo} alt={st.name} />
                          : <div className="stylist-avatar-placeholder">
                              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.5" fill="none">
                                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                              </svg>
                            </div>
                        }
                      </div>
                      <div className="cat-sel-info">
                        <h4>{st.name}</h4>
                        <p>{st.title}</p>
                      </div>
                    </div>
                    {selectedStylist?.id === st.id
                      ? <div className="stylist-check-inline">✓</div>
                      : <div className="cat-sel-count">›</div>
                    }
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEG 4: Välj tid ──────────────────────────────────────────── */}
          {step === 'time' && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">Välj datum & tid</h3>
              </div>
              <SummaryPill />

              {/* Date strip */}
              <div className="date-strip">
                {availableDates.map((d, idx) => (
                  <button
                    key={idx}
                    className={`date-chip ${selectedDate?.toDateString() === d.toDateString() ? 'selected' : ''}`}
                    onClick={() => { setDate(d); setTime(null); }}
                  >
                    <span className="date-chip-weekday">{d.toLocaleDateString('sv-SE',{weekday:'short'})}</span>
                    <span className="date-chip-day">{d.getDate()}</span>
                    <span className="date-chip-month">{d.toLocaleDateString('sv-SE',{month:'short'})}</span>
                  </button>
                ))}
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div className="timeslots-wrap">
                  <p className="timeslots-label">{fmtDateLong(selectedDate)}</p>
                  {busyLoading ? (
                    <p className="timeslots-loading">Kontrollerar tillgänglighet...</p>
                  ) : (
                    <div className="timeslots-grid">
                      {ALL_SLOTS.map(slot => {
                        const booked = busySlots.has(slot);
                        return (
                          <button
                            key={slot}
                            disabled={booked}
                            className={`timeslot ${booked ? 'booked' : ''} ${selectedTime === slot ? 'selected' : ''}`}
                            onClick={() => !booked && setTime(slot)}
                          >
                            {slot}
                            {booked && <span className="slot-booked-label">Upptagen</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedDate && selectedTime && (
                <div className="step-cta">
                  <button className="btn-continue" onClick={handleContinueTime}>
                    Fortsätt →
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── STEG 5: Kunduppgifter ─────────────────────────────────────── */}
          {step === 'details' && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">Dina uppgifter</h3>
              </div>
              <SummaryPill />

              <div className="details-form">
                <div className="form-group">
                  <label htmlFor="cust-name">Namn</label>
                  <input
                    id="cust-name"
                    type="text"
                    placeholder="För- och efternamn"
                    value={form.name}
                    onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="cust-phone">Telefon</label>
                  <input
                    id="cust-phone"
                    type="tel"
                    placeholder="070-000 00 00"
                    value={form.phone}
                    onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="cust-email">E-post</label>
                  <input
                    id="cust-email"
                    type="email"
                    placeholder="din@email.se"
                    value={form.email}
                    onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  />
                </div>

                <div className="step-cta">
                  <button
                    className="btn-continue"
                    disabled={!form.name.trim() || !form.phone.trim() || !form.email.trim()}
                    onClick={handleContinueDetails}
                  >
                    Fortsätt →
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── STEG 6: Kassa ─────────────────────────────────────────────── */}
          {step === 'checkout' && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">Bekräfta & betala</h3>
              </div>

              {/* Order summary */}
              <div className="checkout-summary">
                <div className="checkout-row">
                  <span>Tjänst</span>
                  <span>{selectedService?.name}</span>
                </div>
                <div className="checkout-row">
                  <span>Stylist</span>
                  <span>{selectedStylist?.name}</span>
                </div>
                <div className="checkout-row">
                  <span>Datum</span>
                  <span>{selectedDate ? fmtDateLong(selectedDate) : '—'}</span>
                </div>
                <div className="checkout-row">
                  <span>Tid</span>
                  <span>{selectedTime}</span>
                </div>
                <div className="checkout-row">
                  <span>Kund</span>
                  <span>{form.name}</span>
                </div>
                <div className="checkout-divider" />
                <div className="checkout-row checkout-total">
                  <span>Totalt</span>
                  <span>{selectedService ? fmtPrice(servicePriceÖre(selectedService)) : '—'}</span>
                </div>
              </div>

              {/* Terms */}
              <div className="terms-block">
                <label className="terms-checkbox-label">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTerms(e.target.checked)}
                    id="terms-accept"
                  />
                  <span>
                    Jag godkänner{' '}
                    <Link to="/villkor" target="_blank" className="terms-link">
                      bokningsvillkoren
                    </Link>
                  </span>
                </label>
                <div className="terms-text">
                  <p>Genom att boka godkänner du:</p>
                  <ul>
                    <li>Avbokning senare än 24 timmar före tid medför 50% avgift</li>
                    <li>Betalning via Swish är förbetalning och är icke‑återbetalbar om du inte avbokar inom 24 timmar</li>
                    <li>Försenad ankomst kan leda till avbokning utan återbetalning</li>
                  </ul>
                </div>
              </div>

              {apiError && <p className="api-error">{apiError}</p>}

              <div className="step-cta">
                <button
                  className="btn-pay"
                  disabled={!termsAccepted || loading}
                  onClick={handlePay}
                >
                  {loading
                    ? <span className="pay-spinner">⏳ Bearbetar...</span>
                    : <>Fortsätt till betalning ({selectedService ? fmtPrice(servicePriceÖre(selectedService)) : ''})</>
                  }
                </button>
                <p className="stripe-note">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Säker betalning via Stripe · Kort, Apple Pay, Google Pay
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </section>
  );
}

export default App;
