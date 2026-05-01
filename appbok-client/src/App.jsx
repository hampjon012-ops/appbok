import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import {
  applyThemeToDocument,
  fetchMergedSalonConfig,
  displaySalonName,
  SALON_CONFIG_UPDATED,
  SALON_CONFIG_STORAGE_KEY,
  resolvePrimaryAccentHex,
  isSalonPreviewBookingMode,
} from './lib/salonPublicConfig';
import './App.css';
import { usePreviewEmbedUi } from './hooks/usePreviewEmbedUi.js';
import { useSalonCatalog } from './hooks/useSalonCatalog.js';
import PreviewDeviceStatusBar from './components/PreviewDeviceStatusBar.jsx';
import PublicOpeningHours from './components/PublicOpeningHours.jsx';
import SalonTenantNotFoundView from './components/SalonTenantNotFoundView.jsx';
import { getValidOpeningHoursWeek } from './lib/publicOpeningHours.js';
import PrivacyCheckbox from './components/PrivacyCheckbox.jsx';
import CookieBanner from './components/CookieBanner.jsx';
import { ChevronRight, ChevronLeft, CreditCard, Store, Lock, Plus, User, Users, X, CheckCircle2, Circle } from 'lucide-react';

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

function compareSlotTimes(a, b) {
  const pa = String(a).split(':').map((n) => parseInt(n, 10));
  const pb = String(b).split(':').map((n) => parseInt(n, 10));
  const am = (pa[0] || 0) * 60 + (pa[1] || 0);
  const bm = (pb[0] || 0) * 60 + (pb[1] || 0);
  return am - bm;
}

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

/** Touch-feedback i bokningsmodalen (Tailwind utilities, se @tailwind i index.css) */
const BTN_TOUCH_CARD =
  'active:scale-[0.99] active:bg-gray-50 transition-transform duration-75';
const BTN_TOUCH_PRIMARY =
  'active:scale-[0.98] active:opacity-80 transition-all duration-75';
const BTN_TOUCH_SECONDARY =
  'active:scale-[0.98] active:bg-gray-100 transition-all duration-75';

function SwishPaymentForm({ onConfirm, onError, disabled, payLabel, termsAccepted, setTerms }) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const isPayDisabled = disabled || !stripe || confirming || !paymentComplete;

  const handleConfirmPayment = async () => {
    if (!stripe || !elements || isPayDisabled) return;
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

  return (
    <div className="swish-payment-clean">
      <div className="stripe-payment-shell">
        <PaymentElement
          options={{ layout: 'accordion' }}
          onChange={(event) => {
            setPaymentComplete(Boolean(event.complete));
            if (event.error?.message) onError?.(event.error.message);
            else onError?.('');
          }}
        />
      </div>
      <label className="checkout-terms-row">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={e => setTerms(e.target.checked)}
          className="checkout-terms-input"
        />
        <span className="checkout-terms-text">
          Jag godkänner{' '}
          <Link to="/villkor" target="_blank" rel="noopener noreferrer" className="underline">
            bokningsvillkoren
          </Link>
        </span>
      </label>
      <button
        type="button"
        className={`checkout-cta-btn w-full ${
          isPayDisabled
            ? 'checkout-cta-btn--disabled'
            : 'checkout-cta-btn--active'
        }`}
        disabled={isPayDisabled}
        onClick={handleConfirmPayment}
      >
        {confirming ? 'Bekräftar betalning...' : `Bekräfta och betala ${payLabel}`}
      </button>
      <p className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-2">
        <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        Säker betalning via Stripe
      </p>
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
  const validOpeningWeek = useMemo(() => {
    if (!config || config.tenantNotFound) return null;
    return getValidOpeningHoursWeek(config.contact);
  }, [config]);
  const previewEmbed = isPreviewEmbedClient();

  if (!config) return <div className="loading-screen">Laddar...</div>;

  if (config.tenantNotFound) {
    return <SalonTenantNotFoundView attemptedSlug={config.attemptedSlug} />;
  }

  const isSalonPreviewMode = isSalonPreviewBookingMode(config.salonStatus);
  const isExpired = config.salonStatus === 'expired';
  const hasLegacyHours = Array.isArray(config.contact?.hours) && config.contact.hours.length > 0;
  const showStructuredOpeningHours = validOpeningWeek != null;
  const showLegacyOpeningHours = hasLegacyHours && !showStructuredOpeningHours;
  const showOpeningHoursPlaceholder =
    !showStructuredOpeningHours &&
    !hasLegacyHours &&
    (Boolean(config.contact?.address) ||
      Boolean(config.contact?.phone) ||
      (isSalonPreviewMode && !isExpired));
  const showContactSection =
    Boolean(config.contact?.address) ||
    Boolean(config.contact?.phone) ||
    hasLegacyHours ||
    showStructuredOpeningHours ||
    (isSalonPreviewMode && !isExpired);

  return (
    <div className="app-wrapper">
      {previewEmbed ? <PreviewDeviceStatusBar /> : null}
      {/* ── Förhandsgranskning: ingen riktig bokning förrän testperiod startats ── */}
      {isSalonPreviewMode && !previewEmbed && (
        <div className="preview-booking-banner" role="status">
          <span className="preview-booking-banner-text">
            ⚠️ Denna bokningssida är i förhandsgranskning. Riktiga bokningar kan inte genomföras.
          </span>
        </div>
      )}

      {/* ── DESKTOP FIXED HEADER ── */}
      <div className={`desktop-header ${scrollY > 50 ? 'desktop-header-scrolled' : ''}`}>
        <div /> {/* spacer */}
        <button
          type="button"
          onClick={isExpired ? undefined : () => openBookingModal(null)}
          disabled={isExpired}
          className="desktop-header-btn"
          style={
            isExpired
              ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }
              : scrollY > 50
              ? { backgroundColor: accentColor, color: '#fff' }
              : undefined
          }
        >
          {isExpired ? 'Bokning stängd' : 'Boka tid'}
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
                          className="service-popular-row service-popular-row--interactive"
                          role="button"
                          tabIndex={0}
                          onClick={() => openBookingModal(svc)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openBookingModal(svc);
                            }
                          }}
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
                            style={{ backgroundColor: accentColor }}
                          >
                            Välj
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
              // Renda alla stylister, inklusive "Valfri stylist"
              const displayStylists = stylists;
              // Om det BARA finns "Valfri stylist" (inga riktiga stylister tillagda ännu) kan vi välja om sekionen ska visas eller ej. Vi visar den.
              if (displayStylists.length === 0) return null;
              return (
                <section className="home-section home-section-alt">
                  <div className="container">
                    <div className="home-section-header">
                      <h2 className="home-section-title">Träffa vårt team</h2>
                    </div>
                    <div className="stylists-scroll-row">
                      {displayStylists.map((st, i) => (
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
                            ) : st.id === 'any' ? (
                              <div className="stylist-avatar-any" aria-hidden>
                                <Users className="stylist-fallback-icon" />
                              </div>
                            ) : (
                              <div className="stylist-avatar-placeholder-icon" aria-hidden>
                                <User className="stylist-fallback-icon" />
                              </div>
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

        {/* ── 3. INSTAGRAM / PORTFOLIO ── (visas om handtag och/eller portföljbilder finns) */}
        {(() => {
          const igHandleRaw = config.contact?.instagramHandle;
          const igHandle = igHandleRaw != null && String(igHandleRaw).trim()
            ? String(igHandleRaw).replace(/^@/, '').trim()
            : '';
          const hasPortfolioImages = Array.isArray(config.portfolioImages) && config.portfolioImages.length > 0;
          const showInstagramSection = !isExpired && (Boolean(igHandle) || hasPortfolioImages);
          if (!showInstagramSection) return null;
          return (
            <section className="home-section">
              <div className="container">
                <div className="home-section-header" style={{ textAlign: 'center' }}>
                  <p className="insta-label">Hitta Inspiration på Instagram</p>
                  {igHandle ? (
                    <a
                      href={`https://instagram.com/${igHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="insta-handle insta-handle-link"
                    >
                      @{igHandle}
                    </a>
                  ) : (
                    <h2 className="insta-handle">
                      @{displaySalonName(config.salonName).replace(/\s+/g, '').toLowerCase()}
                    </h2>
                  )}
                  <p className="insta-sub">Följ oss för daglig inspiration</p>
                </div>
                {hasPortfolioImages && (
                  <div className="insta-grid">
                    {config.portfolioImages.map((img, idx) => (
                      <div key={idx} className="insta-item">
                        {igHandle ? (
                          <a
                            href={`https://instagram.com/${igHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="insta-item-link"
                            aria-label={`Öppna Instagram @${igHandle} i ny flik`}
                          >
                            <img src={img} alt="Portfolio" className="insta-item-img" />
                            <div className="insta-overlay"><span>❤️</span></div>
                          </a>
                        ) : (
                          <>
                            <img src={img} alt="Portfolio" className="insta-item-img" />
                            <div className="insta-overlay"><span>❤️</span></div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* ── 4. KONTAKT & KARTA ── */}
        {showContactSection && (
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
                  {(showStructuredOpeningHours || showOpeningHoursPlaceholder) && (
                    <PublicOpeningHours week={validOpeningWeek} />
                  )}
                  {showLegacyOpeningHours && (
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
                  {(() => {
                    let url = config.mapUrl;
                    if (!url || url === '#') return <div className="map-placeholder">Karta saknas — lägg in Google Maps embed-URL i admin.</div>;
                    // Auto-extract src from <iframe> tag if stored as HTML
                    const iframeMatch = url.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                    if (iframeMatch) url = iframeMatch[1];
                    // Validate that it looks like a Google Maps URL
                    if (!url.includes('google.com/maps')) return <div className="map-placeholder">Ogiltig kart-URL — ange en Google Maps embed-URL.</div>;
                    return <iframe src={url} width="100%" height="100%" style={{border:0}} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Karta"></iframe>;
                  })()}
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
              <Link to="/privacy">Integritetspolicy</Link>
              <a href="#">Villkor</a>
            </div>
          </div>
        </footer>
      </main>

      <div className="floating-action mobile-only">
        <button
          type="button"
          className="btn-floating"
          disabled={isExpired}
          style={isExpired ? { opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#9CA3AF' } : { backgroundColor: accentColor }}
          onClick={isExpired ? undefined : () => openBookingModal(null)}
        >
          {isExpired ? 'Bokning stängd' : 'Boka Tid'}
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
            previewBookingLocked={isSalonPreviewMode}
          />
        </div>
      </div>

      {!isBookingModalOpen ? <CookieBanner /> : null}
    </div>
  );
}

// ─── BookingSection ───────────────────────────────────────────────────────────
const STEPS = ['service', 'stylist', 'time', 'details', 'checkout'];

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
  previewBookingLocked = false,
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
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsAccepted, setTerms]         = useState(false);
  const [notes, setNotes]                 = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [loading, setLoading]             = useState(false);
  const [apiError, setApiError]           = useState('');
  /** Endast tider som API returnerar (inga utgråade ”upptagen”-rutor) */
  const [availableSlots, setAvailableSlots] = useState([]);
  const [busyLoading, setBusyLoading]     = useState(false);
  const [closedDateSet, setClosedDateSet] = useState(new Set());
  const [slotFetchError, setSlotFetchError] = useState('');
  const allowPayOnSite = config?.allowPayOnSite !== false;
  const [paymentChoice, setPaymentChoice] = useState('swish');
  const [intentLoading, setIntentLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [intentRequested, setIntentRequested] = useState(false);

  const selectedStylistRef = useRef(null);
  selectedStylistRef.current = selectedStylist;
  const selectedDateRef = useRef(null);
  selectedDateRef.current = selectedDate;
  const salonIdRef = useRef(null);
  salonIdRef.current = config?.salonId;
  /** Ignorera avbrutna slot-fetch:ar så busyLoading och state inte fastnar. */
  const slotsFetchGenRef = useRef(0);

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
      setAvailableSlots([]);
      setBusyLoading(false);
      setSlotFetchError('');
      setStylistPreChosenFromHome(false);
      setForm({ name: '', phone: '', email: '' });
      setNotes('');
      setNotesExpanded(false);
      setTerms(false);
      setMarketingConsent(false);
      setApiError('');
      setSlotFetchError('');
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
      setAvailableSlots([]);
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
      setAvailableSlots([]);
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
    const ac = new AbortController();
    const stylistIdAtReq = selectedStylist.id;
    const salonIdAtReq = config.salonId;
    const from = localYmd(new Date());
    const closedQ = new URLSearchParams({
      salon_id: String(salonIdAtReq),
      stylist_id: String(stylistIdAtReq),
      from,
      days: '30',
    });
    fetch(`/api/booking-availability/closed-dates?${closedQ.toString()}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (
          selectedStylistRef.current?.id !== stylistIdAtReq ||
          salonIdRef.current !== salonIdAtReq
        ) {
          return;
        }
        setClosedDateSet(new Set(d.closedDates || []));
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        if (
          selectedStylistRef.current?.id !== stylistIdAtReq ||
          salonIdRef.current !== salonIdAtReq
        ) {
          return;
        }
        setClosedDateSet(new Set());
      });
    return () => ac.abort();
  }, [selectedStylist, config?.salonId]);

  // Tillgängliga starttider: schema, lunch, block, Google, befintliga bokningar (server)
  useEffect(() => {
    if (!selectedDate || !selectedStylist || !config?.salonId) return;
    const ac = new AbortController();
    const gen = ++slotsFetchGenRef.current;
    const stylistIdAtReq = selectedStylist.id;
    const salonIdAtReq = config.salonId;
    const dateStr = localYmd(selectedDate);
    setBusyLoading(true);
    setSlotFetchError('');
    setAvailableSlots([]);
    const q = new URLSearchParams({
      salon_id: String(salonIdAtReq),
      stylist_id: String(stylistIdAtReq),
      date: dateStr,
    });
    const stillCurrent = () =>
      slotsFetchGenRef.current === gen &&
      selectedStylistRef.current?.id === stylistIdAtReq &&
      salonIdRef.current === salonIdAtReq &&
      localYmd(selectedDateRef.current) === dateStr;

    fetch(`/api/booking-availability?${q.toString()}`, { signal: ac.signal })
      .then(async (r) => {
        let data = {};
        try {
          data = await r.json();
        } catch {
          data = {};
        }
        if (!stillCurrent()) return;
        if (!r.ok) {
          setAvailableSlots([]);
          setTime(null);
          setSlotFetchError(
            typeof data.error === 'string' && data.error.trim()
              ? data.error.trim()
              : 'Kunde inte hämta tillgängliga tider.',
          );
          return;
        }
        const raw = Array.isArray(data.slots) ? data.slots : [];
        const slots = [...new Set(raw.map((s) => String(s).slice(0, 5)))].sort(compareSlotTimes);
        setAvailableSlots(slots);
        setTime((prev) => (prev && slots.includes(prev) ? prev : null));
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        if (!stillCurrent()) return;
        setAvailableSlots([]);
        setTime(null);
        setSlotFetchError('Kunde inte hämta tillgängliga tider.');
      })
      .finally(() => {
        if (slotsFetchGenRef.current === gen) setBusyLoading(false);
      });
    return () => ac.abort();
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
    setAvailableSlots([]);
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
      setAvailableSlots([]);
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
      setAvailableSlots([]);

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
    setAvailableSlots([]);
    setStep('time');
  };
  const handleContinueTime   = ()  => setStep('details');
  const handleContinueDetails= ()  => setStep('checkout');
  const isDetailsValid =
    Boolean(form.name.trim()) && Boolean(form.phone.trim()) && Boolean(form.email.trim());
  const canPayOnSiteCheckout = !previewBookingLocked && termsAccepted && !loading;

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
        theme: 'flat',
        variables: {
          fontFamily: 'inherit',
          colorPrimary: '#111827',
          colorText: '#111827',
          colorTextSecondary: '#6b7280',
          colorDanger: '#b91c1c',
          colorBackground: '#ffffff',
          colorBorder: '#e8eaee',
          colorIcon: '#6b7280',
          fontSizeBase: '15px',
          fontWeightMedium: '650',
          spacingUnit: '4px',
          borderRadius: '16px',
        },
        rules: {
          '.AccordionItem': {
            border: '1px solid #ece7e0',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            marginBottom: '8px',
            boxShadow: '0 8px 18px rgba(17, 24, 39, 0.035)',
            transition: 'all 0.2s ease',
          },
          '.AccordionItem--selected': {
            borderColor: '#8b6f5a',
            borderWidth: '1px',
            backgroundColor: '#ffffff',
            boxShadow: '0 12px 26px rgba(139, 111, 90, 0.13)',
          },
          '.Block': {
            border: 'none',
            backgroundColor: 'transparent',
            boxShadow: 'none',
            padding: '2px 0 0',
          },
          '.Message': {
            border: 'none',
            backgroundColor: '#fbfaf8',
            boxShadow: 'none',
            color: '#6b7280',
            fontSize: '12px',
            borderRadius: '12px',
            marginTop: '8px',
            padding: '10px 12px',
          },
          '.TabList': {
            gap: '8px',
          },
          '.Tab': {
            border: '1px solid #e8eaee',
            borderRadius: '14px',
            backgroundColor: '#ffffff',
            boxShadow: 'none',
            minHeight: '52px',
            padding: '10px 12px',
          },
          '.Tab--selected': {
            borderColor: '#111827',
            borderWidth: '1px',
            backgroundColor: '#ffffff',
            boxShadow: '0 12px 24px rgba(17, 24, 39, 0.09)',
          },
          '.Input': {
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            padding: '12px',
          },
          '.Input:focus': {
            borderColor: '#111827',
            boxShadow: '0 0 0 3px rgba(17, 24, 39, 0.08)',
          },
          '.Label': {
            fontSize: '12px',
            color: '#4b5563',
            fontWeight: '600',
          },
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
      marketing_consent: marketingConsent,
      consent_sms_at: marketingConsent ? new Date().toISOString() : null,
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
    marketingConsent,
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
    if (previewBookingLocked) return;
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
    previewBookingLocked,
  ]);

  useEffect(() => {
    if (previewBookingLocked) return;
    if (step !== 'checkout') return;
    if (paymentChoice !== 'swish') return;
    if (intentRequested) return;
    fetchPaymentIntent();
  }, [fetchPaymentIntent, intentRequested, paymentChoice, previewBookingLocked, step]);

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
                className="selected-service-chip-remove -mr-2 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-2 text-gray-400 transition-colors hover:text-red-500 active:bg-red-50"
                onClick={() => removeService(svc.id)}
                aria-label={`Ta bort ${svc.name}`}
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ))}
          {selectedServices.length >= 1 && selectedServices.length < 8 ? (
            <button type="button" className={`add-service-chip-btn ${BTN_TOUCH_SECONDARY}`} onClick={goAddAnotherService}>
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
          {selectedStylist && selectedStylist.id !== 'any' ? (
            <p className="booking-modal-stylist-hint">
              Bokar med {selectedStylist.name}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className={`close-btn ${BTN_TOUCH_SECONDARY}`} aria-label="Stäng">
          ✕
        </button>
      </div>
      <div className="booking-modal-body">
        <div id="boka-nu" className="booking-modal-inner">
          <div className="container booking-container" style={{ padding: '1rem', paddingBottom: '1rem' }}>

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
                        className={`popular-combo-btn ${BTN_TOUCH_CARD}`}
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
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`category-selection-btn category-card-category ${BTN_TOUCH_CARD} min-w-0 w-full text-left`}
                      onClick={() => handleSelectCategory(cat)}
                    >
                      <div className="cat-sel-info cat-sel-info--category flex-1 min-w-0 pr-4 text-left">
                        <h4 className="line-clamp-2 break-words">{cat.name}</h4>
                        {cat.description ? (
                          <p className="cat-sel-desc line-clamp-2 break-words">{cat.description}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-sm text-gray-500">
                        <span className="whitespace-nowrap">{cat.services.length} val</span>
                        <ChevronRight className="shrink-0 opacity-70" size={18} strokeWidth={2} aria-hidden />
                      </div>
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
                <button type="button" className={`back-arrow-btn ${BTN_TOUCH_SECONDARY}`} onClick={goBack}>
                  ←
                </button>
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
                        className={`popular-combo-btn ${BTN_TOUCH_CARD}`}
                        onClick={() => applyPopularCombo(c)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="category-selection-list">
                {selectedCategory.services.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    className="category-selection-btn category-card-service min-w-0 w-full cursor-pointer text-left transition-all duration-75 active:scale-[0.99] active:bg-gray-50"
                    onClick={() => handleSelectService(svc)}
                  >
                    <div className="cat-sel-info cat-sel-info--service flex min-w-0 flex-1 flex-col pr-4 text-left">
                      <h4 className="font-medium text-gray-900 line-clamp-2 break-words">{svc.name}</h4>
                      <p className="mt-1 text-sm text-gray-500">{svc.duration}</p>
                    </div>
                    <div className="flex shrink-0 items-center text-sm text-gray-500">
                      <span className="whitespace-nowrap">{svc.price}</span>
                      <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} aria-hidden />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEG 3: Välj stylist ──────────────────────────────────────── */}
          {step === 'stylist' && selectedServices.length > 0 && (
            <>
              <div className="booking-step-header-with-back">
                <button type="button" className={`back-arrow-btn ${BTN_TOUCH_SECONDARY}`} onClick={goBack}>
                  ←
                </button>
                <h3 className="booking-step-title">Välj stylist</h3>
              </div>
              <SelectedServicesSummary />
              <div className="category-selection-list">
                {/* Valfri stylist — högst upp */}
                <button
                  type="button"
                  className="category-selection-btn stylist-row-btn min-w-0 w-full cursor-pointer text-left transition-all duration-75 active:scale-[0.99] active:bg-gray-50"
                  onClick={() => handleSelectStylist({ id: 'any', name: 'Valfri stylist' })}
                >
                  <div className="stylist-row-left">
                    <div className="stylist-avatar-sm">
                      <div className="stylist-avatar-any" aria-hidden>
                        <Users className="stylist-fallback-icon-sm" />
                      </div>
                    </div>
                    <div className="cat-sel-info">
                      <h4>Valfri stylist</h4>
                      <p>Hitta första lediga tid</p>
                    </div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} aria-hidden />
                </button>
                {stylists.filter(s => s.id !== 'any').map(st => (
                  <button
                    key={st.id}
                    type="button"
                    className="category-selection-btn stylist-row-btn min-w-0 w-full cursor-pointer text-left transition-all duration-75 active:scale-[0.99] active:bg-gray-50"
                    onClick={() => handleSelectStylist(st)}
                  >
                    <div className="stylist-row-left">
                      <div className="stylist-avatar-sm">
                        {st.photo
                          ? <img src={st.photo} alt={st.name} />
                          : <div className="stylist-avatar-placeholder-icon-sm" aria-hidden>
                              <User className="stylist-fallback-icon-sm" />
                            </div>
                        }
                      </div>
                      <div className="cat-sel-info">
                        <h4>{st.name}</h4>
                        <p>{st.title}</p>
                      </div>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} aria-hidden />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEG 4: Välj tid ──────────────────────────────────────────── */}
          {step === 'time' && selectedServices.length > 0 && (
            <>
              <div className="booking-step-header-with-back">
                <button type="button" className={`back-arrow-btn ${BTN_TOUCH_SECONDARY}`} onClick={goBack}>
                  ←
                </button>
                <h3 className="booking-step-title">Välj datum & tid</h3>
              </div>
              <SelectedServicesSummary />

              {/* Date strip */}
              <div className="date-strip">
                {availableDates.map((d, idx) => {
                  const isSelectedDate = selectedDate?.toDateString() === d.toDateString();
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`date-chip ${
                        isSelectedDate
                          ? 'selected bg-gray-900 text-white border-transparent'
                          : 'bg-white border border-gray-200 active:scale-[0.95] active:bg-gray-50 transition-all duration-75 cursor-pointer'
                      }`}
                      onClick={() => {
                        setDate(d);
                        setTime(null);
                      }}
                    >
                      <span className="date-chip-weekday">{d.toLocaleDateString('sv-SE',{weekday:'short'})}</span>
                      <span className="date-chip-day">{d.getDate()}</span>
                      <span className="date-chip-month">{d.toLocaleDateString('sv-SE',{month:'short'})}</span>
                    </button>
                  );
                })}
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div className="timeslots-wrap">
                  <p className="timeslots-label">{fmtDateLong(selectedDate)}</p>
                  {busyLoading ? (
                    <p className="timeslots-loading">Kontrollerar tillgänglighet...</p>
                  ) : slotFetchError ? (
                    <p className="timeslots-empty text-sm text-red-600 mt-4" role="alert">
                      {slotFetchError}
                    </p>
                  ) : availableSlots.length === 0 ? (
                    <p className="timeslots-empty text-sm text-gray-600 mt-4">Inga lediga tider denna dag.</p>
                  ) : (
                    <div className="timeslots-grid grid grid-cols-3 gap-3 mt-6">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={`timeslot py-3 border border-gray-200 rounded-md text-center text-sm font-medium text-gray-900 hover:border-black active:scale-[0.95] transition-all cursor-pointer ${
                            selectedTime === slot ? 'selected' : ''
                          }`}
                          onClick={() => setTime(slot)}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedDate && selectedTime && (
                <div className="step-cta">
                  <button
                    type="button"
                    className={`btn-continue ${BTN_TOUCH_PRIMARY} w-full sm:w-auto mt-6 py-4 sm:py-2 text-center`}
                    onClick={handleContinueTime}
                  >
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
                <button type="button" className={`back-arrow-btn ${BTN_TOUCH_SECONDARY}`} onClick={goBack}>
                  ←
                </button>
                <h3 className="booking-step-title">Dina uppgifter</h3>
              </div>
              <SelectedServicesSummary />

              <div className="details-form">
                <div className="form-group">
                  <label htmlFor="cust-name">Namn</label>
                  <input
                    id="cust-name"
                    type="text"
                    className="text-base sm:text-sm"
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
                    className="text-base sm:text-sm"
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
                    className="text-base sm:text-sm"
                    placeholder="din@email.se"
                    value={form.email}
                    onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  />
                </div>

                <div className="step-cta">
                  <button
                    type="button"
                    className={`btn-continue w-full sm:w-auto mt-4 py-4 sm:py-2 text-center flex justify-center items-center transition-all duration-75 ${
                      isDetailsValid
                        ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98] cursor-pointer'
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    }`}
                    disabled={!isDetailsValid}
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
            <div className="checkout-final">
              {/* ── A. HEADER ── */}
              <div className="checkout-header">
                <button
                  type="button"
                  className={`checkout-back ${BTN_TOUCH_SECONDARY}`}
                  onClick={goBack}
                  aria-label="Tillbaka"
                >
                  <ChevronLeft size={20} strokeWidth={2} />
                </button>
                <h3 className="checkout-header-title">Bekräfta</h3>
                <div className="w-10 shrink-0" />
              </div>

              {/* ── B. SAMMANFATTNING (Kvitto) ── */}
              <div className="checkout-receipt">
                {selectedServices.map((svc) => (
                  <div key={svc.id} className="checkout-receipt-row">
                    <span className="checkout-receipt-left">{svc.name}</span>
                    <span className="checkout-receipt-right">
                      {fmtPrice(servicePriceÖre(svc))}
                    </span>
                  </div>
                ))}
                <div className="checkout-receipt-row">
                  <span className="checkout-receipt-left">Stylist</span>
                  <span className="checkout-receipt-right">
                    {selectedStylist?.name}
                  </span>
                </div>
                <div className="checkout-receipt-row">
                  <span className="checkout-receipt-left">Datum</span>
                  <span className="checkout-receipt-right">
                    {selectedDate ? fmtDateLong(selectedDate) : '—'}
                  </span>
                </div>
                <div className="checkout-receipt-row">
                  <span className="checkout-receipt-left">Tid</span>
                  <span className="checkout-receipt-right">
                    {selectedTime}
                  </span>
                </div>
                <div className="checkout-receipt-row">
                  <span className="checkout-receipt-left">Kund</span>
                  <span className="checkout-receipt-right">
                    {form.name}
                  </span>
                </div>
                <div className="checkout-receipt-divider" />
                <div className="checkout-receipt-row checkout-receipt-total">
                  <span className="checkout-receipt-left">Totalt</span>
                  <span className="checkout-receipt-right">
                    {selectedServices.length ? fmtPrice(totalPriceÖre) : '—'}
                  </span>
                </div>
                {selectedServices.length > 0 && (
                  <p className="checkout-receipt-duration">{fmtDurationTotal(totalDurationMin)}</p>
                )}
              </div>

              {/* ── C. TILLVAL (Meddelande + SMS) ── */}
              <div className="checkout-options">
                {!notesExpanded ? (
                  <button
                    type="button"
                    className="checkout-note-toggle"
                    onClick={() => setNotesExpanded(true)}
                  >
                    <span>+ Lägg till meddelande</span>
                    <ChevronRight size={15} strokeWidth={2} />
                  </button>
                ) : (
                  <div className="checkout-note-area">
                    <label htmlFor="booking-notes-text" className="checkout-note-label">Meddelande till salongen</label>
                    <textarea
                      id="booking-notes-text"
                      className="checkout-note-textarea"
                      placeholder="Något salongen bör veta? T.ex. allergier..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                      maxLength={500}
                      rows={3}
                    />
                    <div className="checkout-note-footer">
                      <span className="checkout-note-count">{notes.length}/500</span>
                      <button type="button" className="checkout-note-hide" onClick={() => setNotesExpanded(false)}>Dölj</button>
                    </div>
                  </div>
                )}
                <label className="checkout-sms-row">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={e => setMarketingConsent(e.target.checked)}
                    className="checkout-sms-input"
                  />
                  <span className="checkout-sms-text">SMS-aviseringar</span>
                </label>
              </div>

              {/* ── D. BETALNINGSMETOD (Radio) ── */}
              <div className="checkout-payment-section">
                {allowPayOnSite && (
                  <>
                    <button
                      type="button"
                      className={`checkout-radio-row ${paymentChoice === 'swish' ? 'checkout-radio-row--active' : ''}`}
                      onClick={() => { setPaymentChoice('swish'); setApiError(''); }}
                    >
                      <span className="checkout-radio-left">
                        <CreditCard size={18} strokeWidth={1.8} className="checkout-pay-icon" />
                        <span className="checkout-pay-label">Onlinebetalning</span>
                      </span>
                      {paymentChoice === 'swish' ? (
                        <CheckCircle2 size={20} strokeWidth={1.5} className="text-gray-900 fill-gray-900" />
                      ) : (
                        <Circle size={20} strokeWidth={1.5} className="text-gray-300" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`checkout-radio-row ${paymentChoice === 'on_site' ? 'checkout-radio-row--active' : ''}`}
                      onClick={() => { setPaymentChoice('on_site'); setApiError(''); }}
                    >
                      <span className="checkout-radio-left">
                        <Store size={18} strokeWidth={1.8} className="checkout-pay-icon" />
                        <span className="checkout-pay-label">Betala på plats</span>
                      </span>
                      {paymentChoice === 'on_site' ? (
                        <CheckCircle2 size={20} strokeWidth={1.5} className="text-gray-900 fill-gray-900" />
                      ) : (
                        <Circle size={20} strokeWidth={1.5} className="text-gray-300" />
                      )}
                    </button>
                  </>
                )}
                {!allowPayOnSite && (
                  <div className="checkout-pay-locked">
                    <CreditCard size={18} strokeWidth={1.8} />
                    <span>Onlinebetalning är obligatorisk</span>
                  </div>
                )}
              </div>

              {/* ── E. STRIPE ELEMENT (Online — only when swish selected) ── */}
              {allowPayOnSite && paymentChoice === 'swish' && (
                <div className="checkout-stripe-area">
                  {previewBookingLocked ? (
                    <div className="checkout-stripe-message">Bokning inaktiverad i preview-läge</div>
                  ) : (
                    <>
                      {intentLoading && <p className="checkout-stripe-loading">Initierar betalning...</p>}
                      {!intentLoading && !clientSecret && apiError ? (
                        <button
                          type="button"
                          className={`btn-continue ${BTN_TOUCH_PRIMARY}`}
                          onClick={() => { setIntentRequested(false); fetchPaymentIntent(); }}
                        >
                          Försök igen
                        </button>
                      ) : null}
                      {!intentLoading && clientSecret && stripePromise && elementsOptions ? (
                        <Elements stripe={stripePromise} options={elementsOptions}>
                          <SwishPaymentForm
                            disabled={!termsAccepted || loading}
                            payLabel={fmtPrice(priceAmount)}
                            onError={(msg) => setApiError(msg)}
                            onConfirm={handleSwishConfirmed}
                            termsAccepted={termsAccepted}
                            setTerms={setTerms}
                          />
                        </Elements>
                      ) : null}
                    </>
                  )}
                </div>
              )}

              {/* ── G. HUVUDKNAPP (terms checkbox directly above, only for on_site) ── */}
              <div className="checkout-cta-section">
                {paymentChoice !== 'swish' && (
                  <label className="checkout-terms-row">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={e => setTerms(e.target.checked)}
                      className="checkout-terms-input"
                    />
                    <span className="checkout-terms-text">
                      Jag godkänner{' '}
                      <Link to="/villkor" target="_blank" rel="noopener noreferrer" className="underline">
                        bokningsvillkoren
                      </Link>
                    </span>
                  </label>
                )}

                {apiError && <p className="api-error">{apiError}</p>}

                {paymentChoice === 'swish' ? (
                  null
                ) : (
                  <button
                    type="button"
                    className={`checkout-cta-btn w-full ${
                      canPayOnSiteCheckout
                        ? 'checkout-cta-btn--active'
                        : 'checkout-cta-btn--disabled'
                    }`}
                    disabled={!canPayOnSiteCheckout}
                    onClick={previewBookingLocked ? undefined : handleBookPayOnSite}
                  >
                    {previewBookingLocked
                      ? 'Bokning inaktiverad i preview-läge'
                      : loading
                        ? 'Skapar bokning...'
                        : 'Bekräfta och betala'}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
