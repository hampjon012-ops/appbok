import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import {
  applyThemeToDocument,
  fetchMergedSalonConfig,
  displaySalonName,
  SALON_CONFIG_UPDATED,
  SALON_CONFIG_STORAGE_KEY,
  resolvePrimaryAccentHex,
} from './lib/salonPublicConfig';
import './App.css';
import { usePreviewEmbedUi } from './hooks/usePreviewEmbedUi.js';
import { useSalonCatalog } from './hooks/useSalonCatalog.js';
import PreviewDeviceStatusBar from './components/PreviewDeviceStatusBar.jsx';
import SalonTenantNotFoundView from './components/SalonTenantNotFoundView.jsx';
import { Plus } from 'lucide-react';

function isPreviewEmbedClient() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('preview_embed') === '1';
  } catch {
    return false;
  }
}

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

/** Lokal kalenderdag YYYY-MM-DD (inte UTC) — matchar serverns datumsträngar. */
function localYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ALL_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

// ─── Helper: format date to Swedish ──────────────────────────────────────────
function fmtDateLong(d) {
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtPrice(öre) {
  return `${(öre / 100).toLocaleString('sv-SE')} kr`;
}

/** Summerad varaktighet för flera tjänster (visning). */
function fmtDurationTotal(totalMin) {
  const n = Math.max(0, Math.round(Number(totalMin) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (n === 0) return '0 min';
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} ${h === 1 ? 'timme' : 'timmar'}`;
  return `${h} tim ${m} min`;
}

/** Startsida: kurerad meny om config saknar egna tjänster */
const CURATED_FALLBACK_SERVICES = [
  { id: 'curated-1', name: 'Klippning inkl. tvätt & fön', durationMinutes: 60, priceAmount: 75000, isPopular: true },
  { id: 'curated-2', name: 'Klippning kort hår (Maskin/Sax)', durationMinutes: 45, priceAmount: 55000, isPopular: false },
  { id: 'curated-3', name: 'Barnklippning (upp till 12 år)', durationMinutes: 30, priceAmount: 45000, isPopular: true },
  { id: 'curated-4', name: 'Skägg & trimning', durationMinutes: 30, priceAmount: 35000, isPopular: true },
];

function normalizeHomeService(svc) {
  const dm = svc.duration_minutes ?? svc.durationMinutes;
  const duration =
    (svc.duration && String(svc.duration).trim()) ||
    (typeof dm === 'number' && dm > 0 ? `${dm} min` : '');
  const pa = svc.price_amount ?? svc.priceAmount;
  const price =
    (svc.price && String(svc.price).trim()) ||
    (typeof pa === 'number' && pa > 0
      ? `Från ${(pa / 100).toLocaleString('sv-SE')} kr`
      : '');
  return {
    id: svc.id,
    name: (svc.name && String(svc.name).trim()) || 'Tjänst',
    duration,
    price,
    photo_url: svc.photo_url || svc.photo || null,
    isPopular: Boolean(svc.is_popular ?? svc.isPopular),
  };
}

/** Matchar hem-tjänst mot kategorier (id först, sedan exakt namn). */
function findCategoryAndServiceForPrefill(categories, prefill) {
  if (!prefill || !Array.isArray(categories) || categories.length === 0) return null;
  const idStr =
    prefill.id != null && String(prefill.id).trim() !== '' ? String(prefill.id) : null;
  const nameNorm = (prefill.name || '').trim().toLowerCase();
  for (const cat of categories) {
    for (const svc of cat.services || []) {
      if (idStr && String(svc.id) === idStr) return { category: cat, service: svc };
    }
  }
  if (nameNorm) {
    for (const cat of categories) {
      for (const svc of cat.services || []) {
        if ((svc.name || '').trim().toLowerCase() === nameNorm) return { category: cat, service: svc };
      }
    }
  }
  return null;
}

function findStylistForPrefill(stylistList, prefill) {
  if (!prefill || !Array.isArray(stylistList) || stylistList.length === 0) return null;
  const idStr =
    prefill.id != null && String(prefill.id).trim() !== '' ? String(prefill.id) : null;
  const nameNorm = (prefill.name || '').trim().toLowerCase();
  for (const st of stylistList) {
    if (idStr && String(st.id) === idStr) return st;
  }
  if (nameNorm) {
    for (const st of stylistList) {
      if ((st.name || '').trim().toLowerCase() === nameNorm) return st;
    }
  }
  return null;
}

function SwishPaymentForm({ onConfirm, onError, disabled, payLabel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [expressReady, setExpressReady] = useState(false);

  const handleConfirmPayment = async () => {
    if (!stripe || !elements || disabled || confirming) return;
    setConfirming(true);
    onError?.('');
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/tack`,
        },
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message || 'Kunde inte bekräfta betalningen.');
      }

      if (!paymentIntent) {
        throw new Error('Ingen betalning returnerades från Stripe.');
      }

      const okStatus = paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing';
      if (!okStatus) {
        throw new Error(`Betalningen kunde inte slutföras (${paymentIntent.status}).`);
      }

      await onConfirm?.(paymentIntent.id);
    } catch (err) {
      onError?.(err.message || 'Betalningen misslyckades.');
    } finally {
      setConfirming(false);
    }
  };

  const handleExpressConfirm = async () => {
    await handleConfirmPayment();
  };

  return (
    <div className="embedded-payment-shell">
      <div className="express-checkout-wrap" style={expressReady ? undefined : { position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
        <ExpressCheckoutElement
          onConfirm={handleExpressConfirm}
          onReady={({ availablePaymentMethods }) => {
            const hasWallet = availablePaymentMethods?.applePay || availablePaymentMethods?.googlePay;
            setExpressReady(Boolean(hasWallet));
          }}
          options={{
            paymentMethods: {
              applePay: 'always',
              googlePay: 'always',
            },
            buttonTheme: {
              applePay: 'black',
              googlePay: 'black',
            },
            buttonType: {
              applePay: 'buy',
              googlePay: 'buy',
            },
          }}
        />
      </div>
      {expressReady && (
        <div className="payment-divider">
          <span>eller betala med kort</span>
        </div>
      )}
      {/* PaymentElement är alltid synlig så användaren kan betala med kort
          om Apple Pay/Google Pay inte är tillgängliga eller om de avbryter */}
      <PaymentElement />
      <button
        type="button"
        className="btn-pay"
        disabled={disabled || !stripe || confirming}
        onClick={handleConfirmPayment}
      >
        {confirming ? 'Bekräftar betalning...' : `Bekräfta och betala (${payLabel})`}
      </button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  usePreviewEmbedUi();
  const [config, setConfig] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState(null);
  const [bookingPrefillStylist, setBookingPrefillStylist] = useState(null);

  const clearBookingPrefill = useCallback(() => setBookingPrefill(null), []);
  const clearBookingPrefillStylist = useCallback(() => setBookingPrefillStylist(null), []);

  const catalogSalonId =
    config && !config.tenantNotFound
      ? config.salonId || 'a0000000-0000-0000-0000-000000000001'
      : null;
  const { categories, stylists, popularCombos, isLoadingCategories, isLoadingStylists } = useSalonCatalog(
    catalogSalonId,
    config,
  );

  /** homeService / homeStylist: ange null för att rensa respektive prefill */
  const openBookingModal = useCallback((homeService = null, homeStylist = null) => {
    setBookingPrefill(homeService ? { id: homeService.id, name: homeService.name } : null);
    setBookingPrefillStylist(
      homeStylist ? { id: homeStylist.id, name: homeStylist.name } : null,
    );
    setIsBookingModalOpen(true);
  }, []);

  const closeBookingModal = useCallback(() => {
    setIsBookingModalOpen(false);
    setBookingPrefill(null);
    setBookingPrefillStylist(null);
  }, []);

  useEffect(() => {
    if (config?.salonStatus !== 'expired') return;
    closeBookingModal();
  }, [config?.salonStatus, closeBookingModal]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const load = () => {
      fetchMergedSalonConfig()
        .then((merged) => {
          setConfig(merged);
          if (merged.tenantNotFound) {
            document.title = 'Salongen hittades inte | Appbok';
            return;
          }
          if (merged.theme) applyThemeToDocument(merged.theme);
          document.title = `${displaySalonName(merged.salonName)} | Boka Tid`;
        })
        .catch((err) => console.error('Could not load config', err));
    };

    load();

    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    const onFocus = () => load();
    const onSalonSavedElsewhere = () => load();
    const onStorage = (e) => {
      if (e.key === SALON_CONFIG_STORAGE_KEY) load();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    window.addEventListener(SALON_CONFIG_UPDATED, onSalonSavedElsewhere);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(SALON_CONFIG_UPDATED, onSalonSavedElsewhere);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const accentColor = useMemo(() => resolvePrimaryAccentHex(config?.theme), [config?.theme]);
  const previewEmbed = isPreviewEmbedClient();

  if (!config) return <div className="loading-screen">Laddar...</div>;

  if (config.tenantNotFound) {
    return <SalonTenantNotFoundView attemptedSlug={config.attemptedSlug} />;
  }

  const isDemo = config.salonStatus === 'demo';
  const isTrial = config.salonStatus === 'trial';
  const isLive = config.salonStatus === 'live';
  const isExpired = config.salonStatus === 'expired';
  // Banner visas ENDAST i demo/draft/active — alltså INTE under trial, live eller expired
  const showDemoBanner = !isTrial && !isLive && !isExpired && !previewEmbed;

  return (
    <div className="app-wrapper">
      {previewEmbed ? <PreviewDeviceStatusBar /> : null}
      {/* ── DEMO BANNER (visas endast innan testperioden är startad) ── */}
      {showDemoBanner && isDemo && (
        <div className="demo-status-banner">
          <span className="demo-status-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="#92400E" strokeWidth="2"/>
              <line x1="12" y1="8" x2="12" y2="13" stroke="#92400E" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="16.5" r="1" fill="#92400E"/>
            </svg>
          </span>
          <span className="demo-status-text">
            <strong>Förhandsvisning</strong> — Din sajt är under utveckling. Boka-knappen är inaktiverad tills du startar din testperiod.
          </span>
        </div>
      )}

      {/* ── DESKTOP FIXED HEADER ── */}
      <div className={`desktop-header ${scrollY > 50 ? 'desktop-header-scrolled' : ''}`}>
        <div /> {/* spacer */}
        <button
          type="button"
          onClick={isDemo || isExpired ? undefined : () => openBookingModal(null)}
          disabled={isDemo || isExpired}
          className="desktop-header-btn"
          style={
            isDemo || isExpired
              ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }
              : scrollY > 50
              ? { backgroundColor: accentColor, color: '#fff' }
              : undefined
          }
        >
          {isDemo ? 'Boka (inaktiverad)' : isExpired ? 'Bokning stängd' : 'Boka tid'}
        </button>
      </div>

      {/* ── MOBILE STICKY TOP BAR ── */}
      <div className={`sticky-top-bar ${scrollY > 350 ? 'visible' : ''}`}>
        <h3>{displaySalonName(config.salonName)}</h3>
      </div>

      {/* ── HERO ── */}
      <header
        className="hero-minimal"
        style={
          config.theme?.backgroundImageUrl?.trim()
            ? { backgroundImage: `url(${config.theme.backgroundImageUrl.trim()})` }
            : undefined
        }
      >
        <div className="hero-overlay"></div>
        <div className="container hero-container" style={{ position: 'relative', zIndex: 10 }}>
          <div className="hero-content">
            {config.logoUrl && (
              <img src={config.logoUrl} alt={displaySalonName(config.salonName)} className="hero-logo-img"
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
            )}
            <h1 className="hero-logo" style={{ display: config.logoUrl ? 'none' : 'block' }}>{displaySalonName(config.salonName)}</h1>
            <p className="hero-tagline">{config.tagline}</p>
          </div>
        </div>
      </header>

      <main className="content-card">

        {isExpired ? (
          <section className="home-section">
            <div className="container">
              <div className="expired-banner" role="status">
                <h2 className="expired-banner-title">Denna salongs testperiod är avslutad</h2>
                <p className="expired-banner-text">
                  Salongen har inte längre möjlighet att ta emot bokningar här.
                </p>
                <p className="expired-banner-text">
                  Kontakta salongen direkt för mer information.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* ── 1. POPULÄRA TJÄNSTER ── */}
            <section className="home-section">
              <div className="container">
                <div className="home-section-header home-section-header--popular">
                  <h2 className="home-section-title">Våra mest populära tjänster</h2>
                </div>
                <div className="services-popular-list">
                  {(() => {
                    const allServices = (categories || []).flatMap((cat) =>
                      (cat.services || []).map((svc) => ({
                        ...svc,
                        categoryName: cat.name,
                        isPopular: Boolean(svc.is_popular ?? svc.isPopular),
                      })),
                    );
                    const popularMarked = allServices.filter((s) => s.isPopular);
                    const raw =
                      popularMarked.length > 0
                        ? popularMarked.slice(0, 4)
                        : allServices.length > 0
                          ? allServices.slice(0, 4)
                          : CURATED_FALLBACK_SERVICES.filter((s) => s.isPopular).length > 0
                            ? CURATED_FALLBACK_SERVICES.filter((s) => s.isPopular)
                            : CURATED_FALLBACK_SERVICES;
                    const rows = raw.slice(0, 4).map(normalizeHomeService);
                    return rows.map((svc, i) => {
                      const metaParts = [svc.duration, svc.price].filter(Boolean);
                      const metaLine = metaParts.join(' · ');
                      return (
                        <div
                          key={svc.id || i}
                          className={`service-popular-row service-popular-row--interactive${isDemo ? ' service-popular-row--demo' : ''}`}
                          role={isDemo ? 'presentation' : 'button'}
                          tabIndex={isDemo ? -1 : 0}
                          onClick={isDemo ? undefined : () => openBookingModal(svc)}
                          onKeyDown={isDemo ? undefined : (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openBookingModal(svc);
                            }
                          }}
                          style={isDemo ? { opacity: 0.6, cursor: 'default' } : undefined}
                        >
                          <div className="service-popular-text">
                            <p className="service-popular-name">{svc.name}</p>
                            {metaLine ? (
                              <p className="service-popular-meta">{metaLine}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="service-popular-btn"
                            tabIndex={-1}
                            disabled={isDemo}
                            style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : { backgroundColor: accentColor }}
                          >
                            {isDemo ? 'Låst' : 'Välj'}
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </section>

            {/* ── 2. STYLISTER ── */}
            {(() => {
              const stylists = config.stylists || [];
              const display = stylists.length > 0 ? stylists : [
                { id: 1, name: 'Anna', title: 'Senior Stylist', photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=400&auto=format&fit=crop' },
                { id: 2, name: 'Sofia', title: 'Top Stylist', photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop' },
                { id: 3, name: 'Emma', title: 'Color Specialist', photo: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?q=80&w=400&auto=format&fit=crop' },
                { id: 4, name: 'Lina', title: 'Junior Stylist', photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=400&auto=format&fit=crop' },
              ];
              return (
                <section className="home-section home-section-alt">
                  <div className="container">
                    <div className="home-section-header">
                      <h2 className="home-section-title">Träffa vårt team</h2>
                    </div>
                    <div className="stylists-scroll-row">
                      {display.map((st, i) => (
                        <div
                          key={st.id || i}
                          role="button"
                          tabIndex={0}
                          className="stylist-card stylist-card--interactive"
                          onClick={() => openBookingModal(null, st)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openBookingModal(null, st);
                            }
                          }}
                        >
                          <div className="stylist-avatar">
                            {(st.photo || st.photo_url) ? (
                              <img src={st.photo || st.photo_url} alt={st.name} />
                            ) : (
                              <div className="stylist-avatar-fallback" aria-hidden />
                            )}
                          </div>
                          <p className="stylist-name">{st.name}</p>
                          <p className="stylist-title">{st.title || st.specialization || 'Stylist'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })()}
          </>
        )}

        {/* ── 3. INSTAGRAM ── */}
        {!isExpired && (config.instagram && config.instagram.length > 0) && (
          <section className="home-section">
            <div className="container">
              <div className="home-section-header" style={{ textAlign: 'center' }}>
                <p className="insta-label">Hitta Inspiration på Instagram</p>
                <h2 className="insta-handle">
                  @{config.contact?.instagramHandle && config.contact.instagramHandle !== '#'
                    ? String(config.contact.instagramHandle).replace(/^@/, '')
                    : displaySalonName(config.salonName).replace(/\s+/g, '').toLowerCase()}
                </h2>
                <p className="insta-sub">Följ oss för daglig inspiration</p>
              </div>
              <div className="insta-grid">
                {(config.instagram || []).map((img, idx) => (
                  <div key={idx} className="insta-item">
                    <img src={img} alt="Instagram feed" />
                    <div className="insta-overlay"><span>❤️</span></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 4. KONTAKT & KARTA ── */}
        {(config.contact?.address || config.contact?.phone || (config.contact?.hours && config.contact.hours.length > 0)) && (
          <section id="kontakt" className="contact-section">
            <div className="container">
              <h2 className="contact-title">Kontakt</h2>
              <div className="contact-grid-layout">
                <div className="contact-info-list">
                  {config.contact?.address && (
                    <div className="contact-info-item">
                      <div className="contact-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                      </div>
                      <div><h4>Adress</h4><p>{config.contact.address}</p></div>
                    </div>
                  )}
                  {config.contact?.phone && (
                    <div className="contact-info-item">
                      <div className="contact-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      </div>
                      <div><h4>Telefon</h4><p>{config.contact.phone}</p></div>
                    </div>
                  )}
                  {config.contact?.hours && config.contact.hours.length > 0 && (
                    <div className="contact-info-item align-top">
                      <div className="contact-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div>
                        <h4>Öppettider</h4>
                        {config.contact.hours.map((l, i) => <p key={i}>{l}</p>)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="contact-map-container">
                  {config.mapUrl && config.mapUrl !== '#'
                    ? <iframe src={config.mapUrl} width="100%" height="100%" style={{border:0}} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Karta"></iframe>
                    : <div className="map-placeholder">Karta saknas — lägg in Google Maps embed-URL i admin.</div>}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── FOOTER ── */}
        <footer className="footer-simple">
          <div className="container footer-simple-content">
            <p>© {new Date().getFullYear()} {displaySalonName(config.salonName)}. Alla rättigheter förbehållna.</p>
            <div className="footer-links">
              <a href="#">Integritetspolicy</a>
              <a href="#">Villkor</a>
            </div>
          </div>
        </footer>
      </main>

      <div className="floating-action mobile-only">
        <button
          type="button"
          className="btn-floating"
          disabled={isDemo || isExpired}
          style={isDemo || isExpired ? { opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#9CA3AF' } : { backgroundColor: accentColor }}
          onClick={isDemo || isExpired ? undefined : () => openBookingModal(null)}
        >
          {isDemo ? 'Boka (inaktiverad)' : isExpired ? 'Bokning stängd' : 'Boka Tid'}
        </button>
      </div>

      {/* ── BOOKING MODAL (always mounted so data loads early) ── */}
      <div
        className="booking-modal-overlay"
        style={{ display: !isExpired && isBookingModalOpen ? 'flex' : 'none' }}
        onClick={closeBookingModal}
      >
        <div className="booking-modal-sheet" onClick={e => e.stopPropagation()}>
          <BookingSection
            config={config}
            categories={categories}
            stylists={stylists}
            popularCombos={popularCombos}
            isLoadingCategories={isLoadingCategories}
            isLoadingStylists={isLoadingStylists}
            isModalOpen={isBookingModalOpen}
            onClose={closeBookingModal}
            prefillFromHome={bookingPrefill}
            onPrefillApplied={clearBookingPrefill}
            prefillStylistFromHome={bookingPrefillStylist}
            onStylistPrefillApplied={clearBookingPrefillStylist}
          />
        </div>
      </div>
    </div>
  );
}

// ─── BookingSection ───────────────────────────────────────────────────────────
const STEPS = ['service','stylist','time','details','checkout'];

function BookingSection({
  config,
  categories,
  stylists,
  popularCombos = [],
  isLoadingCategories,
  isLoadingStylists,
  isModalOpen,
  onClose,
  prefillFromHome,
  onPrefillApplied,
  prefillStylistFromHome,
  onStylistPrefillApplied,
}) {
  const [step, setStep]                   = useState('category');
  const [selectedCategory, setCategory]   = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedStylist, setStylist]     = useState(null);
  /** True när stylist valts via team-kort: hoppa över stylist-steget och annorlunda bakåt från tid */
  const [stylistPreChosenFromHome, setStylistPreChosenFromHome] = useState(false);
  const [selectedDate, setDate]           = useState(null);
  const [selectedTime, setTime]           = useState(null);
  const [form, setForm]                   = useState({ name:'', phone:'', email:'' });
  const [termsAccepted, setTerms]         = useState(false);
  const [notes, setNotes]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [apiError, setApiError]           = useState('');
  const [busySlots, setBusySlots]         = useState(new Set());
  const [busyLoading, setBusyLoading]     = useState(false);
  const [closedDateSet, setClosedDateSet] = useState(new Set());
  const allowPayOnSite = config?.allowPayOnSite !== false;
  const [paymentChoice, setPaymentChoice] = useState('swish');
  const [intentLoading, setIntentLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [intentRequested, setIntentRequested] = useState(false);

  const selectedStylistRef = useRef(null);
  selectedStylistRef.current = selectedStylist;

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

  const totalPriceÖre = useMemo(
    () => selectedServices.reduce((sum, s) => sum + servicePriceÖre(s), 0),
    [selectedServices],
  );
  const totalDurationMin = useMemo(
    () => selectedServices.reduce((sum, s) => sum + serviceDurationMin(s), 0),
    [selectedServices],
  );

  const prevModalOpenRef = useRef(false);

  useLayoutEffect(() => {
    if (isModalOpen && !prevModalOpenRef.current) {
      setStep('category');
      setCategory(null);
      setSelectedServices([]);
      setStylist(null);
      setDate(null);
      setTime(null);
      setBusySlots(new Set());
      setStylistPreChosenFromHome(false);
      setForm({ name: '', phone: '', email: '' });
      setNotes('');
      setTerms(false);
      setApiError('');
      setLoading(false);
      setPaymentChoice('swish');
      setIntentLoading(false);
      setClientSecret('');
      setStripePromise(null);
      setPaymentIntentId('');
      setIntentRequested(false);
    }
    prevModalOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  useEffect(() => {
    if (!allowPayOnSite) setPaymentChoice('swish');
  }, [allowPayOnSite]);

  // Öppnad från ”populära tjänster”: hoppa till välj stylist när tjänsten finns i katalogen
  useEffect(() => {
    if (!isModalOpen || !prefillFromHome) return;
    if (categories.length === 0) {
      if (!isLoadingCategories) onPrefillApplied?.();
      return;
    }
    const found = findCategoryAndServiceForPrefill(categories, prefillFromHome);
    if (found) {
      setCategory(found.category);
      setSelectedServices([found.service]);
      setStylist(null);
      setStylistPreChosenFromHome(false);
      setDate(null);
      setTime(null);
      setBusySlots(new Set());
      setStep('stylist');
    }
    onPrefillApplied?.();
  }, [isModalOpen, prefillFromHome, categories, isLoadingCategories, onPrefillApplied]);

  // Öppnad från team-kort: lås stylist, börja på kategori (körs efter tjänst-prefill så stylist inte nollas)
  useEffect(() => {
    if (!isModalOpen || !prefillStylistFromHome) return;
    if (stylists.length === 0) {
      if (!isLoadingStylists) onStylistPrefillApplied?.();
      return;
    }
    const found = findStylistForPrefill(stylists, prefillStylistFromHome);
    if (found) {
      setStylist(found);
      setStylistPreChosenFromHome(true);
      setDate(null);
      setTime(null);
      setBusySlots(new Set());
    }
    onStylistPrefillApplied?.();
  }, [isModalOpen, prefillStylistFromHome, stylists, isLoadingStylists, onStylistPrefillApplied]);

  const availableDates = useMemo(() => {
    const raw = getAvailableDates();
    if (!selectedStylist) return raw;
    return raw.filter((d) => !closedDateSet.has(localYmd(d)));
  }, [selectedStylist, closedDateSet]);

  useEffect(() => {
    if (!selectedDate || !availableDates.length) return;
    if (!availableDates.some((d) => localYmd(d) === localYmd(selectedDate))) {
      setDate(null);
      setTime(null);
    }
  }, [availableDates, selectedDate]);

  const selectedDateKey = selectedDate ? localYmd(selectedDate) : '';

  useEffect(() => {
    if (!selectedStylist || !config?.salonId) {
      setClosedDateSet(new Set());
      return;
    }
    setClosedDateSet(new Set());
    const from = localYmd(new Date());
    fetch(
      `/api/booking-availability/closed-dates?salon_id=${config.salonId}&stylist_id=${selectedStylist.id}&from=${from}&days=30`,
    )
      .then((r) => r.json())
      .then((d) => setClosedDateSet(new Set(d.closedDates || [])))
      .catch(() => setClosedDateSet(new Set()));
  }, [selectedStylist, config?.salonId]);

  // Tillgängliga starttider: schema, lunch, block, Google, befintliga bokningar (server)
  useEffect(() => {
    if (!selectedDate || !selectedStylist || !config?.salonId) return;
    setBusyLoading(true);
    setBusySlots(new Set());
    const dateStr = localYmd(selectedDate);
    const stylistId = selectedStylist.id;

    fetch(
      `/api/booking-availability?salon_id=${config.salonId}&stylist_id=${stylistId}&date=${dateStr}`,
    )
      .then((r) => r.json())
      .then((data) => {
        const avail = new Set(data.slots || []);
        const blocked = new Set(ALL_SLOTS.filter((slot) => !avail.has(slot)));
        setBusySlots(blocked);
        setBusyLoading(false);
      })
      .catch(() => {
        setBusySlots(new Set(ALL_SLOTS));
        setBusyLoading(false);
      });
  }, [selectedDate, selectedStylist, config?.salonId]);

  // Step index for stepper (0-based, total 6 visual steps including category)
  const stepMap = { category:0, service:1, stylist:2, time:3, details:4, checkout:5 };
  const stepIdx = stepMap[step] ?? 0;
  const totalSteps = 6;

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goBack = () => {
    if (step === 'time' && stylistPreChosenFromHome) {
      setStep('service');
      return;
    }
    const prev = { service:'category', stylist:'service', time:'stylist', details:'time', checkout:'details' };
    if (prev[step]) setStep(prev[step]);
  };

  const handleSelectCategory = (cat) => {
    setCategory(cat);
    setDate(null);
    setTime(null);
    if (selectedServices.length === 0 && !stylistPreChosenFromHome) {
      setStylist(null);
    }
    setStep('service');
  };

  const removeService = (serviceId) => {
    setSelectedServices((prev) => {
      const next = prev.filter((s) => s.id !== serviceId);
      if (next.length === 0) {
        setStep('category');
        setCategory(null);
      }
      return next;
    });
    setDate(null);
    setTime(null);
    setBusySlots(new Set());
  };

  const applyPopularCombo = useCallback(
    (combo) => {
      if (!combo?.serviceIds?.length) return;
      const flat = categories.flatMap((c) => c.services || []);
      const resolved = combo.serviceIds.map((id) => flat.find((s) => s.id === id)).filter(Boolean);
      if (resolved.length !== combo.serviceIds.length) return;
      setSelectedServices((prev) => {
        const next = [...prev];
        for (const s of resolved) {
          if (next.length >= 8) break;
          if (!next.some((x) => x.id === s.id)) next.push(s);
        }
        return next;
      });
      setDate(null);
      setTime(null);
      setBusySlots(new Set());
      setStep(selectedStylistRef.current ? 'time' : 'stylist');
    },
    [categories],
  );

  const handleSelectService = (svc) => {
    setSelectedServices((prev) => {
      if (prev.length >= 8) return prev;
      if (prev.some((s) => s.id === svc.id)) return prev;
      const isFirst = prev.length === 0;
      const next = [...prev, svc];

      setDate(null);
      setTime(null);
      setBusySlots(new Set());

      if (isFirst) {
        if (!selectedStylistRef.current) {
          setStylist(null);
          setStep('stylist');
        } else {
          setStep('time');
        }
      } else if (selectedStylistRef.current) {
        setStep('time');
      } else {
        setStep('stylist');
      }
      return next;
    });
  };

  const goAddAnotherService = () => {
    setCategory(null);
    setStep('category');
  };

  const handleSelectStylist = (st) => {
    setStylist(st);
    setStylistPreChosenFromHome(false);
    setDate(null);
    setTime(null);
    setBusySlots(new Set());
    setStep('time');
  };
  const handleContinueTime   = ()  => setStep('details');
  const handleContinueDetails= ()  => setStep('checkout');

  const priceAmount = totalPriceÖre;
  const selectedServiceIdsKey = selectedServices.map((s) => s.id).join(',');

  useEffect(() => {
    setClientSecret('');
    setPaymentIntentId('');
    setStripePromise(null);
    setIntentRequested(false);
  }, [selectedServiceIdsKey, selectedDateKey, selectedTime, form.email, config?.salonId]);

  const elementsOptions = useMemo(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: resolvePrimaryAccentHex(config?.theme),
          borderRadius: '12px',
        },
      },
    };
  }, [clientSecret, config?.theme]);

  const createBooking = useCallback(async ({ amountPaid, stripeSessionId, paymentIntentId }) => {
    const servicesPayload = selectedServices.map((s) => ({
      id: s.id,
      name: s.name,
      price_amount: servicePriceÖre(s),
      duration_minutes: serviceDurationMin(s),
      price_label: s.price_label || s.price,
      duration: s.duration,
    }));
    const payload = {
      salon_id: config.salonId,
      service_id: selectedServices[0]?.id,
      services: servicesPayload,
      stylist_id: selectedStylist?.id || 'any',
      customer_name: form.name,
      customer_email: form.email,
      customer_phone: form.phone,
      booking_date: selectedDate.toISOString().slice(0, 10),
      booking_time: selectedTime,
      duration_minutes: totalDurationMin,
      amount_paid: amountPaid,
      stripe_session_id: stripeSessionId || null,
      stripe_payment_intent_id: paymentIntentId || null,
      notes: notes.trim() ? notes.trim().slice(0, 500) : undefined,
    };
    const bookRes = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!bookRes.ok) {
      const bd = await bookRes.json().catch(() => ({}));
      throw new Error(bd.error || 'Kunde inte skapa bokning.');
    }
    return bookRes.json();
  }, [
    config?.salonId,
    form.email,
    form.name,
    form.phone,
    notes,
    selectedDate,
    selectedServices,
    selectedStylist,
    selectedTime,
    totalDurationMin,
  ]);

  /**
   * Skapar bokning och returnerar { id, customer_email, customer_phone, customer_name }.
   * Används för att bygga redirect-URL med kunddata till ThankYou-sidan.
   */

  const fetchPaymentIntent = useCallback(async () => {
    if (selectedServices.length === 0 || !selectedDate || !selectedTime) return;
    if (clientSecret || intentLoading || intentRequested) return;

    setIntentRequested(true);
    setIntentLoading(true);
    setApiError('');

    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId: config.salonId,
          amount: priceAmount,
          serviceName: selectedServices.map((s) => s.name).join(' + '),
          stylistName: selectedStylist?.name || 'Valfri stylist',
          date: selectedDate ? fmtDateLong(selectedDate) : '',
          time: selectedTime,
          customerName: form.name,
          customerEmail: form.email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte initiera onlinebetalning.');
      }
      if (!data.clientSecret) {
        throw new Error('Stripe returnerade ingen clientSecret.');
      }
      if (!data.publishableKey) {
        throw new Error('STRIPE_PUBLISHABLE_KEY saknas på servern.');
      }
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId || '');
      setStripePromise(
        loadStripe(
          data.publishableKey,
          data.stripeAccountId ? { stripeAccount: data.stripeAccountId } : undefined,
        ),
      );
    } catch (err) {
      setApiError(err.message || 'Kan inte nå betalservern.');
    } finally {
      setIntentLoading(false);
    }
  }, [
    clientSecret,
    config?.salonId,
    form.email,
    form.name,
    intentLoading,
    priceAmount,
    selectedDate,
    selectedServices,
    selectedStylist?.name,
    selectedTime,
    intentRequested,
  ]);

  useEffect(() => {
    if (step !== 'checkout') return;
    if (paymentChoice !== 'swish') return;
    if (intentRequested) return;
    fetchPaymentIntent();
  }, [fetchPaymentIntent, intentRequested, paymentChoice, step]);

  const handleBookPayOnSite = async () => {
    setLoading(true);
    setApiError('');
    try {
      const booking = await createBooking({ amountPaid: 0, stripeSessionId: 'pay_on_site' });
      sessionStorage.setItem('appbok_customer', JSON.stringify({
        email: form.email,
        phone: form.phone,
        name: form.name,
        bookingId: booking?.id,
      }));
      window.location.href = booking?.id ? `/tack?session_id=${encodeURIComponent(booking.id)}` : '/tack';
    } catch (err) {
      setApiError(err.message || 'Kunde inte skapa bokningen.');
      setLoading(false);
    }
  };

  const handleSwishConfirmed = async (confirmedPaymentIntentId) => {
    setLoading(true);
    setApiError('');
    try {
      const booking = await createBooking({
        amountPaid: priceAmount,
        stripeSessionId: confirmedPaymentIntentId || paymentIntentId || null,
        paymentIntentId: confirmedPaymentIntentId || paymentIntentId || null,
      });
      sessionStorage.setItem('appbok_customer', JSON.stringify({
        email: form.email,
        phone: form.phone,
        name: form.name,
        bookingId: booking?.id,
      }));
      const sid = encodeURIComponent(confirmedPaymentIntentId || paymentIntentId || '');
      window.location.href = sid ? `/tack?session_id=${sid}` : '/tack';
    } catch (err) {
      setApiError(err.message || 'Kunde inte skapa bokningen efter betalning.');
      setLoading(false);
    }
  };

  // ── Valda tjänster (chips + total + lägg till) ─────────────────────────────
  const SelectedServicesSummary = () =>
    selectedServices.length > 0 ? (
      <div className="selected-services-block">
        <div className="selected-services-scroll-row">
          {selectedServices.map((svc) => (
            <div key={svc.id} className="selected-service-chip">
              <span className="ssc-name">{svc.name}</span>
              <span className="ssc-meta">{svc.price}</span>
              <button
                type="button"
                className="selected-service-chip-remove"
                onClick={() => removeService(svc.id)}
                aria-label={`Ta bort ${svc.name}`}
              >
                ×
              </button>
            </div>
          ))}
          {selectedServices.length >= 1 && selectedServices.length < 8 ? (
            <button type="button" className="add-service-chip-btn" onClick={goAddAnotherService}>
              <Plus className="add-service-chip-icon" size={16} strokeWidth={2.25} aria-hidden />
              <span>Lägg till tjänst</span>
            </button>
          ) : null}
        </div>
        <p className="selected-services-total-line">
          Totalt: {fmtPrice(totalPriceÖre)} · {fmtDurationTotal(totalDurationMin)}
        </p>
      </div>
    ) : null;

  return (
    <>
      <div className="booking-modal-header">
        <div className="booking-modal-header-text">
          <h3 className="booking-modal-title">Boka tid</h3>
          {selectedStylist ? (
            <p className="booking-modal-stylist-hint">
              Bokar med {selectedStylist.name}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="close-btn" aria-label="Stäng">
          ✕
        </button>
      </div>
      <div className="booking-modal-body">
        <div id="boka-nu" className="booking-modal-inner">
          <div className="container booking-container" style={{ padding: '1rem', paddingBottom: '2.5rem' }}>

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
              {selectedServices.length >= 1 && popularCombos.length > 0 ? (
                <div className="popular-combos">
                  <p className="popular-combos-title">Populära kombinationer</p>
                  <div className="popular-combos-grid">
                    {popularCombos.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        className="popular-combo-btn"
                        onClick={() => applyPopularCombo(c)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {isLoadingCategories ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  Laddar tjänster...
                </div>
              ) : categories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  Inga tjänster tillgängliga än.
                </div>
              ) : (
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
              )}
            </>
          )}

          {/* ── STEG 2: Välj tjänst ───────────────────────────────────────── */}
          {step === 'service' && selectedCategory && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">{selectedCategory.name}</h3>
              </div>
              {selectedServices.length >= 1 && popularCombos.length > 0 ? (
                <div className="popular-combos">
                  <p className="popular-combos-title">Populära kombinationer</p>
                  <div className="popular-combos-grid">
                    {popularCombos.map((c) => (
                      <button
                        key={`svc-${c.label}`}
                        type="button"
                        className="popular-combo-btn"
                        onClick={() => applyPopularCombo(c)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
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
          {step === 'stylist' && selectedServices.length > 0 && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">Välj stylist</h3>
              </div>
              <SelectedServicesSummary />
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
          {step === 'time' && selectedServices.length > 0 && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">Välj datum & tid</h3>
              </div>
              <SelectedServicesSummary />

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
          {step === 'details' && selectedServices.length > 0 && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">Dina uppgifter</h3>
              </div>
              <SelectedServicesSummary />

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
          {step === 'checkout' && selectedServices.length > 0 && (
            <>
              <div className="booking-step-header-with-back">
                <button className="back-arrow-btn" onClick={goBack}>←</button>
                <h3 className="booking-step-title">Bekräfta & betala</h3>
              </div>

              {/* Order summary */}
              <div className="checkout-summary">
                <p className="checkout-services-heading">Tjänster</p>
                {selectedServices.map((svc) => (
                  <div key={svc.id} className="checkout-row checkout-service-line">
                    <span>{svc.name}</span>
                    <span>{fmtPrice(servicePriceÖre(svc))}</span>
                  </div>
                ))}
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
                  <span>{selectedServices.length ? fmtPrice(totalPriceÖre) : '—'}</span>
                </div>
                <p className="checkout-duration-hint">
                  {selectedServices.length
                    ? `Sammanlagd tid: ${fmtDurationTotal(totalDurationMin)}`
                    : null}
                </p>
              </div>

              <div className="booking-notes">
                <label htmlFor="booking-notes-text">Meddelande till salongen (valfritt)</label>
                <textarea
                  id="booking-notes-text"
                  className="booking-notes-textarea"
                  placeholder="Något salongen bör veta? T.ex. allergier, särskilda önskemål..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={4}
                />
                <span className="char-count booking-notes-char-count">{notes.length}/500</span>
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
                    <li>Förskottsbetalning online är icke‑återbetalbar om du inte avbokar inom 24 timmar</li>
                    <li>Försenad ankomst kan leda till avbokning utan återbetalning</li>
                  </ul>
                </div>
              </div>

              <div className="payment-choice-section">
                <h4 className="payment-choice-title">Betalningssätt</h4>
                {allowPayOnSite ? (
                  <div className="payment-choice-grid">
                    <button
                      type="button"
                      className={`payment-choice-card ${paymentChoice === 'swish' ? 'payment-choice-card--active' : ''}`}
                      onClick={() => {
                        setPaymentChoice('swish');
                        setApiError('');
                      }}
                    >
                      <span className="payment-choice-heading">Betala online</span>
                      <span className="payment-choice-copy">Kort, Apple Pay och Google Pay via säker Stripe-ruta.</span>
                    </button>
                    <button
                      type="button"
                      className={`payment-choice-card ${paymentChoice === 'on_site' ? 'payment-choice-card--active' : ''}`}
                      onClick={() => {
                        setPaymentChoice('on_site');
                        setApiError('');
                      }}
                    >
                      <span className="payment-choice-heading">Betala på plats</span>
                      <span className="payment-choice-copy">Ingen förbetalning. Betala hela beloppet i salongen.</span>
                    </button>
                  </div>
                ) : (
                  <div className="payment-choice-forced">
                    Onlinebetalning är obligatorisk för denna salong.
                  </div>
                )}
              </div>

              {apiError && <p className="api-error">{apiError}</p>}

              {paymentChoice === 'swish' ? (
                <>
                  {intentLoading && <p className="payment-element-loading">Initierar onlinebetalning...</p>}
                  {!intentLoading && !clientSecret && apiError ? (
                    <div className="step-cta">
                      <button
                        type="button"
                        className="btn-continue"
                        onClick={() => {
                          setIntentRequested(false);
                          fetchPaymentIntent();
                        }}
                      >
                        Försök igen
                      </button>
                    </div>
                  ) : null}
                  {!intentLoading && clientSecret && stripePromise && elementsOptions ? (
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <SwishPaymentForm
                        disabled={!termsAccepted || loading}
                        payLabel={fmtPrice(priceAmount)}
                        onError={(msg) => setApiError(msg)}
                        onConfirm={handleSwishConfirmed}
                      />
                    </Elements>
                  ) : null}
                  <p className="stripe-note">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Säker inbäddad betalning via Stripe
                  </p>
                </>
              ) : (
                <div className="step-cta">
                  <button
                    className="btn-pay"
                    disabled={!termsAccepted || loading}
                    onClick={handleBookPayOnSite}
                  >
                    {loading ? 'Skapar bokning...' : 'Bekräfta bokning (betala på plats)'}
                  </button>
                </div>
              )}
            </>
          )}

        </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
