import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brush, ChevronRight, Dumbbell, PenTool, Scissors, Sparkles, SlidersHorizontal } from 'lucide-react';
import { ADMIN_PUBLIC_ORIGIN } from '../lib/domainConfig.js';

const THEME_PRESETS = [
  {
    id: 'hair-warm-walnut',
    industryIds: ['hair', 'barber', 'sport'],
    name: 'Warm Walnut',
    description: 'Boutique-salong med varm valnöt, speglar och mjuk belysning.',
    bg: '#fbf4ea',
    text: '#2d2218',
    primary: '#7c4a2d',
    accent: '#ead9c8',
    image: '/images/onboarding/hair-warm-walnut.jpg',
  },
  {
    id: 'hair-nordic-studio',
    industryIds: ['hair'],
    name: 'Nordic Studio',
    description: 'Ljust, rent och skandinaviskt med mjuk salongskänsla.',
    bg: '#ffffff',
    text: '#111827',
    primary: '#000000',
    accent: '#f3f4f6',
    image: '/images/onboarding/hair-nordic-studio.jpg',
  },
  {
    id: 'hair-soft-blonde',
    industryIds: ['hair'],
    name: 'Soft Blonde',
    description: 'Varm champagne, mjuka blonda toner och elegant beauty-känsla.',
    bg: '#fffaf3',
    text: '#2f241b',
    primary: '#9a6a3f',
    accent: '#f2e7d8',
    image: '/images/onboarding/hair-soft-blonde.jpg',
  },
  {
    id: 'hair-noir-salon',
    industryIds: ['hair', 'barber', 'tattoo'],
    name: 'Noir Salon',
    description: 'Mörkt, exklusivt och high-end med subtila metallreflektioner.',
    bg: '#0f0f10',
    text: '#f8fafc',
    primary: '#f4f4f5',
    primaryText: '#111827',
    accent: '#1a1a1c',
    surface: '#151517',
    footer: '#18181b',
    image: '/images/onboarding/hair-noir-salon.jpg',
  },
  {
    id: 'hair-barber-steel',
    industryIds: ['barber'],
    name: 'Barber Steel',
    description: 'Maskulint barber-uttryck med läder, stål och varmt trä.',
    bg: '#11100f',
    text: '#f7f2eb',
    primary: '#9a5f38',
    primaryText: '#fff7ed',
    accent: '#201c18',
    surface: '#171412',
    footer: '#1d1915',
    image: '/images/onboarding/hair-barber-steel.jpg',
  },
];

const INDUSTRIES = [
  {
    id: 'hair',
    name: 'Frisör & Skönhet',
    label: 'Frisör, skönhet och klinik',
    defaultTheme: 'hair-warm-walnut',
    services: [
      { name: 'Klippning', price_amount: 55000, duration_minutes: 45 },
      { name: 'Färgbehandling', price_amount: 120000, duration_minutes: 120 },
      { name: 'Styling', price_amount: 65000, duration_minutes: 60 },
      { name: 'Konsultation', price_amount: 0, duration_minutes: 30 },
    ],
  },
  {
    id: 'barber',
    name: 'Barberare',
    label: 'Barber, grooming och herrsalong',
    defaultTheme: 'hair-barber-steel',
    services: [
      { name: 'Herrklippning', price_amount: 55000, duration_minutes: 45 },
      { name: 'Skäggtrimning', price_amount: 35000, duration_minutes: 30 },
      { name: 'Klippning & skägg', price_amount: 85000, duration_minutes: 75 },
      { name: 'Rakning', price_amount: 45000, duration_minutes: 40 },
    ],
  },
  {
    id: 'tattoo',
    name: 'Tatuerare',
    label: 'Tattoo, piercing och premium',
    defaultTheme: 'hair-noir-salon',
    services: [
      { name: 'Konsultation', price_amount: 0, duration_minutes: 30 },
      { name: 'Tatuering liten', price_amount: 150000, duration_minutes: 120 },
      { name: 'Heldag', price_amount: 600000, duration_minutes: 360 },
      { name: 'Touch-up', price_amount: 80000, duration_minutes: 60 },
    ],
  },
  {
    id: 'sport',
    name: 'PT & Sport',
    label: 'Personlig träning och sport',
    defaultTheme: 'hair-warm-walnut',
    services: [
      { name: 'PT-pass', price_amount: 75000, duration_minutes: 60 },
      { name: 'Intro coaching', price_amount: 0, duration_minutes: 30 },
      { name: 'Gruppträning', price_amount: 22000, duration_minutes: 45 },
      { name: 'Kostrådgivning', price_amount: 65000, duration_minutes: 60 },
    ],
  },
  {
    id: 'custom',
    name: 'Annat / Anpassa själv',
    label: 'Se alla teman och bygg en egen start',
    defaultTheme: 'hair-warm-walnut',
    services: [
      { name: 'Konsultation', price_amount: 0, duration_minutes: 30 },
      { name: 'Standardbokning', price_amount: 65000, duration_minutes: 60 },
      { name: 'Premiumbokning', price_amount: 120000, duration_minutes: 90 },
      { name: 'Uppföljning', price_amount: 45000, duration_minutes: 30 },
    ],
  },
];

const INDUSTRY_ICONS = {
  hair: Scissors,
  barber: Brush,
  tattoo: PenTool,
  sport: Dumbbell,
  custom: SlidersHorizontal,
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function priceOreToKrInputValue(ore) {
  if (ore === '' || ore === null || ore === undefined) return '';
  const value = Number(ore);
  if (!Number.isFinite(value)) return '';
  return String(Math.round(value / 100));
}

function servicesPayloadForRegister(rows) {
  return rows
    .filter((service) => {
      const name = String(service.name || '').trim();
      const price = Number(service.price_amount);
      return name && Number.isFinite(price) && price >= 0;
    })
    .map((service) => {
      const duration = parseInt(String(service.duration_minutes ?? '').trim(), 10);
      return {
        name: String(service.name).trim(),
        price_amount: Math.round(Number(service.price_amount)),
        duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 60,
      };
    });
}

function updatePriceAt(index, rawValue, setServices) {
  setServices((prev) => {
    const next = [...prev];
    if (rawValue === '') {
      next[index] = { ...next[index], price_amount: '' };
      return next;
    }
    const kr = parseInt(String(rawValue), 10);
    if (!Number.isFinite(kr) || kr < 0) return prev;
    next[index] = { ...next[index], price_amount: kr * 100 };
    return next;
  });
}

function ThemeSwatches({ theme }) {
  return (
    <span className="signup-v2-swatches" aria-hidden>
      {[theme.bg, theme.primary, theme.accent].map((color) => (
        <span key={color} style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

function LivePreview({ salonName, industry, theme, image, services }) {
  const displayServices = servicesPayloadForRegister(services).slice(0, 4);
  const rows = displayServices.length > 0 ? displayServices : industry.services;
  const safeSalonName = salonName.trim() || 'Studio Nova';
  const isDarkTheme = theme.bg === '#0f0f10' || theme.bg === '#11100f' || theme.bg === '#09090b' || theme.bg === '#171717';

  return (
    <div className="signup-v2-phone-frame">
      <div
        className="signup-v2-phone signup-v2-landing-preview"
        style={{
          '--signup-preview-bg': theme.bg,
          '--signup-preview-text': theme.text,
          '--signup-preview-accent': theme.primary,
          '--signup-preview-accent-text': theme.primaryText || '#ffffff',
          '--signup-preview-surface': theme.surface || theme.bg,
          '--signup-preview-muted': theme.text === '#ffffff' ? 'rgba(255,255,255,.68)' : '#78716c',
          '--signup-preview-chevron': isDarkTheme ? 'rgba(255,255,255,.42)' : '#9ca3af',
          '--signup-preview-footer-bg': isDarkTheme ? theme.footer || theme.surface || theme.bg : '#ffffff',
          '--signup-preview-divider': isDarkTheme ? 'rgba(255,255,255,.12)' : 'rgba(17,24,39,.1)',
        }}
      >
        <div
          className="signup-v2-preview-hero"
          style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.46), rgba(0,0,0,.46)), url(${image})` }}
        >
          <div className="signup-v2-preview-hero-content">
            <h2>{safeSalonName}</h2>
            <p>Upplev hantverk och personlig service i en lugn och modern miljö.</p>
          </div>
        </div>

        <div className="signup-v2-preview-card">
          <section className="signup-v2-preview-section">
            <h3>Våra mest populära tjänster</h3>
            {rows.map((service, index) => (
              <div
                key={`${service.name}-${index}`}
                className="signup-v2-preview-service-row"
                role="button"
                tabIndex={0}
              >
                <div>
                  <strong>{service.name || 'Ny tjänst'}</strong>
                  <span>
                    {service.duration_minutes || 60} min · Från{' '}
                    {Math.round(Number(service.price_amount || 0) / 100).toLocaleString('sv-SE')} kr
                  </span>
                </div>
                <ChevronRight className="signup-v2-preview-service-chevron" size={16} strokeWidth={2.15} aria-hidden />
              </div>
            ))}
          </section>
        </div>

        <div className="signup-v2-preview-footer">
          <button type="button">Boka Tid</button>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [salonName, setSalonName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [industryId, setIndustryId] = useState('hair');
  const [themeId, setThemeId] = useState('hair-warm-walnut');
  const [services, setServices] = useState(INDUSTRIES[0].services.map((service) => ({ ...service })));
  const [bokadirektUrl, setBokadirektUrl] = useState('');

  const industry = useMemo(
    () => INDUSTRIES.find((item) => item.id === industryId) || INDUSTRIES[0],
    [industryId],
  );
  const availableThemes = useMemo(
    () =>
      industryId === 'custom'
        ? THEME_PRESETS
        : THEME_PRESETS.filter((item) => item.industryIds.includes(industryId)),
    [industryId],
  );
  const theme = useMemo(
    () =>
      THEME_PRESETS.find((item) => item.id === themeId) ||
      availableThemes[0] ||
      THEME_PRESETS[0],
    [availableThemes, themeId],
  );
  const image = theme.image;

  function handleSalonNameChange(event) {
    const nextName = event.target.value;
    setSalonName(nextName);
    setSubdomain(slugify(nextName));
  }

  function handleIndustrySelect(nextIndustryId) {
    const nextIndustry = INDUSTRIES.find((item) => item.id === nextIndustryId) || INDUSTRIES[0];
    setIndustryId(nextIndustry.id);
    setThemeId(nextIndustry.defaultTheme);
    setServices(nextIndustry.services.map((service) => ({ ...service })));
  }

  function updateService(index, field, value) {
    setServices((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: field === 'duration_minutes' && value !== '' ? parseInt(value, 10) : value,
      };
      return next;
    });
  }

  async function submitForm(event) {
    event?.preventDefault();
    setError('');
    setLoading(true);

    try {
      const nameFromEmail = email
        .trim()
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

      const payload = {
        name: nameFromEmail,
        email: email.trim(),
        password,
        salonName: salonName.trim(),
        salonSlug: subdomain.trim(),
        bokadirektUrl: bokadirektUrl.trim(),
        businessType: industryId,
        themePreset: themeId,
        backgroundImageUrl: image,
        backgroundPreset: image,
        services: servicesPayloadForRegister(services),
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let data = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error('Servern svarade med ogiltig data. Försök igen om en stund.');
        }
      } else if (!res.ok) {
        throw new Error('Tomt svar från servern. Kontrollera att utvecklingsservern kör.');
      }

      if (!res.ok) throw new Error(data.error || 'Något gick fel vid registreringen.');
      if (!data.token) throw new Error('Registreringen lyckades men inget inloggningsbevis kom tillbaka.');

      const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
      const isApexMarketing = hostname === 'appbok.se' || hostname === 'www.appbok.se';

      if (isApexMarketing) {
        const adminOrigin = import.meta.env.VITE_ADMIN_ORIGIN || ADMIN_PUBLIC_ORIGIN;
        const sessionPayload = encodeURIComponent(
          JSON.stringify({ t: data.token, u: data.user, s: data.salon }),
        );
        window.location.href = `${adminOrigin}/admin/dashboard#sb=${sessionPayload}`;
        return;
      }

      localStorage.setItem('sb_token', data.token);
      localStorage.setItem('sb_user', JSON.stringify(data.user));
      localStorage.setItem('sb_salon', JSON.stringify(data.salon));
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="signup-v2-page">
      <Link to="/" className="signup-v2-logo" aria-label="Till startsidan">
        <img src="/sidebar-logo.png" alt="Appbok" />
      </Link>

      <main className={`signup-v2-shell${step < 3 ? ' signup-v2-shell--solo' : ''}`}>
        <section className="signup-v2-left">
          <div className="signup-v2-progress" aria-label={`Steg ${step} av 5`}>
            {[1, 2, 3, 4, 5].map((item) => (
              <span key={item} className={item <= step ? 'is-active' : ''} />
            ))}
          </div>

          {error ? <div className="signup-v2-error">{error}</div> : null}

          {step === 1 ? (
            <form className="signup-v2-step" onSubmit={(event) => { event.preventDefault(); setStep(2); }}>
              <div className="signup-v2-copy">
                <span>Steg 1 av 5</span>
                <h1>Vad bygger du?</h1>
                <p>Välj typ av verksamhet först. I nästa steg lägger du in uppgifterna och därefter väljer du utseende.</p>
              </div>

              <div className="signup-v2-industry-grid" role="radiogroup" aria-label="Bransch">
                {INDUSTRIES.map((item) => {
                  const Icon = INDUSTRY_ICONS[item.id] || Sparkles;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={item.id === industryId ? 'is-selected' : ''}
                      onClick={() => handleIndustrySelect(item.id)}
                      role="radio"
                      aria-checked={item.id === industryId}
                    >
                      <span><Icon size={17} strokeWidth={2.15} aria-hidden /></span>
                      <strong>{item.name}</strong>
                      <small>{item.label}</small>
                    </button>
                  );
                })}
              </div>

              <div className="signup-v2-actions">
                <button type="submit" className="signup-v2-primary">Fortsätt</button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <form className="signup-v2-step" onSubmit={(event) => { event.preventDefault(); setStep(3); }}>
              <div className="signup-v2-copy">
                <span>Steg 2 av 5</span>
                <h1>Grunduppgifter</h1>
                <p>Det här blir basen för din bokningssida och din inloggning till admin.</p>
              </div>

              <div className="signup-v2-fields">
                <label>
                  <span>Salongens namn</span>
                  <input required type="text" value={salonName} onChange={handleSalonNameChange} placeholder="Studio Nova" />
                </label>
                <label>
                  <span>Bokningslänk</span>
                  <div className="signup-v2-subdomain">
                    <input
                      required
                      type="text"
                      value={subdomain}
                      onChange={(event) => setSubdomain(slugify(event.target.value))}
                      placeholder="studio-nova"
                    />
                    <em>.appbok.se</em>
                  </div>
                </label>
                <div className="signup-v2-field-row">
                  <label>
                    <span>E-post</span>
                    <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="du@studio.se" />
                  </label>
                  <label>
                    <span>Lösenord</span>
                    <input
                      required
                      minLength={6}
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minst 6 tecken"
                    />
                  </label>
                </div>
              </div>

              <div className="signup-v2-actions signup-v2-actions--split">
                <button type="button" className="signup-v2-secondary" onClick={() => setStep(1)}>Tillbaka</button>
                <button type="submit" className="signup-v2-primary">Fortsätt</button>
              </div>
            </form>
          ) : null}

          {step === 3 ? (
            <form className="signup-v2-step" onSubmit={(event) => { event.preventDefault(); setStep(4); }}>
              <div className="signup-v2-copy">
                <span>Steg 3 av 5</span>
                <h1>Välj uttryck</h1>
                <p>Välj ett färdigt tema. Färger och 16:9-bakgrund följer med som ett matchat premium-paket.</p>
              </div>

              <div className="signup-v2-section-head">
                <span>Tema</span>
                <small>{availableThemes.length} matchade presets · {industry.name}</small>
              </div>

              <div className="signup-v2-theme-grid">
                {availableThemes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === themeId ? 'is-selected' : ''}
                    onClick={() => setThemeId(item.id)}
                    aria-pressed={item.id === themeId}
                  >
                    <span
                      className="signup-v2-theme-card-image"
                      style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.22), rgba(0,0,0,.28)), url(${item.image})` }}
                    />
                    <span className="signup-v2-theme-card-body">
                      <span className="signup-v2-theme-card-title">
                        <strong>{item.name}</strong>
                        <ThemeSwatches theme={item} />
                      </span>
                      <small>{item.description}</small>
                    </span>
                  </button>
                ))}
              </div>

              <div className="signup-v2-actions signup-v2-actions--split">
                <button type="button" className="signup-v2-secondary" onClick={() => setStep(2)}>Tillbaka</button>
                <button type="submit" className="signup-v2-primary">Fortsätt</button>
              </div>
            </form>
          ) : null}

          {step === 4 ? (
            <form className="signup-v2-step" onSubmit={(event) => { event.preventDefault(); setStep(5); }}>
              <div className="signup-v2-copy">
                <span>Steg 4 av 5</span>
                <h1>Lägg till tjänster</h1>
                <p>Skapa några starttjänster nu. De visas direkt i telefon-previewn.</p>
              </div>

              <div className="signup-v2-service-list">
                {services.map((service, index) => (
                  <div className="signup-v2-service-row" key={index}>
                    <label>
                      <span>Tjänst</span>
                      <input
                        type="text"
                        value={service.name}
                        onChange={(event) => updateService(index, 'name', event.target.value)}
                        placeholder="Tjänst"
                      />
                    </label>
                    <label>
                      <span>Pris</span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={priceOreToKrInputValue(service.price_amount)}
                        onChange={(event) => updatePriceAt(index, event.target.value, setServices)}
                        placeholder="0"
                      />
                    </label>
                    <label>
                      <span>Tid</span>
                      <input
                        type="number"
                        min={5}
                        inputMode="numeric"
                        value={service.duration_minutes}
                        onChange={(event) => updateService(index, 'duration_minutes', event.target.value)}
                        placeholder="60"
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="signup-v2-actions signup-v2-actions--split">
                <button type="button" className="signup-v2-secondary" onClick={() => setStep(3)}>Tillbaka</button>
                <button type="submit" className="signup-v2-primary">Fortsätt</button>
              </div>
            </form>
          ) : null}

          {step === 5 ? (
            <form className="signup-v2-step" onSubmit={submitForm}>
              <div className="signup-v2-copy">
                <span>Steg 5 av 5</span>
                <h1>Bokadirekt-import</h1>
                <p>Har du en befintlig Bokadirekt-sida kan vi importera tjänster automatiskt.</p>
              </div>

              <div className="signup-v2-import-card">
                <Sparkles size={24} strokeWidth={2} />
                <strong>Flytta från Bokadirekt?</strong>
                <p>Klistra in länken nu eller hoppa över. Du kan alltid lägga till mer i admin senare.</p>
                <input
                  type="url"
                  value={bokadirektUrl}
                  onChange={(event) => setBokadirektUrl(event.target.value)}
                  placeholder="https://www.bokadirekt.se/places/..."
                  inputMode="url"
                />
              </div>

              <div className="signup-v2-actions signup-v2-actions--split">
                <button type="button" className="signup-v2-secondary" onClick={() => setStep(4)} disabled={loading}>Tillbaka</button>
                <button type="submit" className="signup-v2-primary" disabled={loading}>
                  {loading ? 'Skapar...' : 'Skapa bokningssida'}
                </button>
              </div>
              <button
                type="button"
                className="signup-v2-skip"
                disabled={loading}
                onClick={() => void submitForm()}
              >
                Hoppa över import och slutför
              </button>
            </form>
          ) : null}
        </section>

        {step >= 3 ? (
          <aside className="signup-v2-right">
            <LivePreview salonName={salonName} industry={industry} theme={theme} image={image} services={services} />
          </aside>
        ) : null}
      </main>
    </div>
  );
}
