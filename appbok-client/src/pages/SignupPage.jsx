import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

/** price_amount lagras i öre (API/databas); användaren skriver kronor i fälten. */
const DEFAULT_SERVICES = [
  { name: 'Klippning', price_amount: 35000, duration_minutes: 45 },
  { name: 'Färg', price_amount: 80000, duration_minutes: 120 },
  { name: 'Styling', price_amount: 40000, duration_minutes: 45 },
  { name: 'Barnklippning', price_amount: 20000, duration_minutes: 30 },
];

function priceOreToKrInputValue(ore) {
  if (ore === '' || ore === null || ore === undefined) return '';
  const n = Number(ore);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n / 100));
}

function handlePriceKrFieldChange(index, rawString, setServices) {
  setServices((prev) => {
    const next = [...prev];
    if (rawString === '') {
      next[index] = { ...next[index], price_amount: '' };
      return next;
    }
    const kr = parseInt(String(rawString), 10);
    if (Number.isNaN(kr) || kr < 0) return prev;
    next[index] = { ...next[index], price_amount: kr * 100 };
    return next;
  });
}

/** Skicka alltid heltal för price (ör) och duration till register — undvik tomma strängar som gör serverfiltrering tom. */
function servicesPayloadForRegister(rows) {
  return rows
    .filter((s) => {
      const name = String(s.name || '').trim();
      const price = Number(s.price_amount);
      return name && Number.isFinite(price) && price > 0;
    })
    .map((s) => {
      let dm = parseInt(String(s.duration_minutes ?? '').trim(), 10);
      if (!Number.isFinite(dm) || dm <= 0) dm = 60;
      return {
        name: String(s.name).trim(),
        price_amount: Math.round(Number(s.price_amount)),
        duration_minutes: dm,
      };
    });
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Base info
  const [salonName, setSalonName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Services
  const [services, setServices] = useState(
    DEFAULT_SERVICES.map(s => ({ ...s, active: true }))
  );

  // Step 3: Bokadirekt
  const [bokadirektUrl, setBokadirektUrl] = useState('');

  // Auto-generate subdomain from salonName if user hasn't typed in subdomain yet
  const handleSalonNameChange = (e) => {
    const val = e.target.value;
    setSalonName(val);
    const generated = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    setSubdomain(generated);
  };

  const handleSubdomainChange = (e) => {
    setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const updateService = (index, field, value) => {
    const newServices = [...services];
    if (field === 'duration_minutes') {
      newServices[index][field] = value !== '' && value != null ? parseInt(value, 10) : '';
    } else {
      newServices[index][field] = value;
    }
    setServices(newServices);
  };

  const submitForm = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Generera ägarnamn från e-postadressen (t.ex. "anna@salong.se" → "Anna")
      const nameFromEmail = email.trim().split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const payload = {
        name: nameFromEmail,
        email: email.trim(),
        password,
        salonName: salonName.trim(),
        salonSlug: subdomain.trim(),
        bokadirektUrl: bokadirektUrl.trim(),
        services: servicesPayloadForRegister(services),
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
        throw new Error(res.status === 502 || res.status === 503
          ? 'API-servern svarar inte. Starta om utveckling: cd appbok-client && npm run dev (startar både API och Vite).'
          : 'Tomt svar från servern. Kontrollera att du kör npm run dev i appbok-client.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Något gick fel vid registreringen.');
      }

      if (!data.token) {
        throw new Error('Registreringen lyckades men inget inloggningsbevis kom tillbaka. Kontakta support.');
      }

      // Spara inloggning och gå till admin dashboard (som är demo mode initialt)
      localStorage.setItem('sb_token', data.token);
      localStorage.setItem('sb_user', JSON.stringify(data.user));
      localStorage.setItem('sb_salon', JSON.stringify(data.salon));
      
      navigate('/admin');
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)', background: '#FAFAFA', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header mini */}
      <header style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center', background: '#FFFFFF', borderBottom: '1px solid #E5E5E5' }}>
        <Link to="/">
          <img src="/sidebar-logo.png" alt="Appbok" style={{ height: '32px', filter: 'brightness(0)' }} />
        </Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{
          background: '#FFFFFF', padding: '2.5rem', borderRadius: '16px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 10px 20px rgba(0,0,0,0.06), 0 24px 48px rgba(0,0,0,0.08)',
          maxWidth: '500px', width: '100%'
        }}>
          
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ 
                height: '4px', flex: 1, borderRadius: '4px',
                background: s <= step ? '#171717' : '#E5E5E5',
                transition: 'background 0.3s'
              }} />
            ))}
          </div>

          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '0.5rem', color: '#1A1A1A' }}>
            {step === 1 && 'Sätt upp din salong'}
            {step === 2 && 'Lägg till tjänster'}
            {step === 3 && 'Bokadirekt-import'}
          </h1>
          <p style={{ color: '#737373', marginBottom: '2rem' }}>
            {step === 1 && 'Skapa ditt konto på under 2 minuter.'}
            {step === 2 && 'Du kan lägga till 4 snabbtjänster nu eller ändra senare.'}
            {step === 3 && 'Har du en extern bokningssida vi ska flytta över?'}
          </p>

          {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</div>}

          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Salongens Namn</div>
                <input required type="text" value={salonName} onChange={handleSalonNameChange} style={inputStyle} placeholder="Annas Salong" />
              </label>

              <label>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Bokningslänk (Subdomän)</div>
                <div style={{ display: 'flex', alignItems: 'center', background: '#F5F5F5', borderRadius: '8px', overflow: 'hidden', padding: '0 0.5rem', border: '1px solid #E5E5E5' }}>
                  <input required type="text" value={subdomain} onChange={handleSubdomainChange} style={{ ...inputStyle, border: 'none', background: 'transparent', paddingLeft: '0.2rem' }} />
                  <span style={{ color: '#737373', fontSize: '0.9rem', paddingRight: '0.5rem' }}>.appbok.se</span>
                </div>
              </label>

              <label>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>E-postadress</div>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="anna@salong.se" />
              </label>

              <label>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Lösenord</div>
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="Minst 6 tecken" minLength={6} />
              </label>

              <button type="submit" style={primaryButtonStyle}>Nästa steg →</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {services.length === 0 ? (
                <p style={{ fontSize: '0.9rem', color: '#525252', lineHeight: 1.55, margin: 0 }}>
                  Du har valt att inte lägga in snabbtjänster nu. Efter registrering hittar du allt under{' '}
                  <strong>Tjänster</strong> i admin. Du behöver inga rader här för att gå vidare.
                </p>
              ) : null}
              {services.map((svc, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 2 }}>
                    {i === 0 && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#737373', marginBottom: '0.2rem' }}>Tjänst</div>}
                    <input type="text" value={svc.name} onChange={e => updateService(i, 'name', e.target.value)} placeholder={DEFAULT_SERVICES[i]?.name} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {i === 0 && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#737373', marginBottom: '0.2rem' }}>Pris (kr)</div>}
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={priceOreToKrInputValue(svc.price_amount)}
                      onChange={(e) => handlePriceKrFieldChange(i, e.target.value, setServices)}
                      style={inputStyle}
                      placeholder={DEFAULT_SERVICES[i] != null ? String(Math.round(DEFAULT_SERVICES[i].price_amount / 100)) : ''}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    {i === 0 && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#737373', marginBottom: '0.2rem' }}>Tid (min)</div>}
                    <input type="number" value={svc.duration_minutes} onChange={e => updateService(i, 'duration_minutes', e.target.value)} style={inputStyle} placeholder={DEFAULT_SERVICES[i]?.duration_minutes} />
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setStep(1)} style={{ ...buttonBase, background: '#F5F5F5', color: '#1A1A1A', flex: 1 }}>← Tillbaka</button>
                <button type="submit" style={{ ...primaryButtonStyle, flex: 2 }}>Nästa steg →</button>
              </div>
              <button
                type="button"
                className="signup-onboarding-skip"
                onClick={() => {
                  setServices([]);
                  setStep(3);
                }}
              >
                Hoppa över, jag lägger in tjänster senare
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={submitForm} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  padding: '1.35rem 1.25rem 1.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '0.5rem',
                    color: '#6366f1',
                  }}
                  aria-hidden
                >
                  <Sparkles size={24} strokeWidth={2} />
                </div>
                <h4
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontWeight: 600,
                    fontSize: '1.05rem',
                    color: '#171717',
                  }}
                >
                  Flytta från Bokadirekt?
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#737373', margin: '0 0 1rem', lineHeight: 1.5 }}>
                  Klistra in din nuvarande bokningslänk så konfigurerar vi hela ditt tjänsteutbud åt dig inom 24 timmar.
                </p>
                <input
                  type="url"
                  value={bokadirektUrl}
                  onChange={(e) => setBokadirektUrl(e.target.value)}
                  style={{ ...inputStyle, textAlign: 'left' }}
                  placeholder="https://www.bokadirekt.se/places/..."
                  autoComplete="url"
                  inputMode="url"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                <button type="button" onClick={() => setStep(2)} disabled={loading} style={{ ...buttonBase, background: '#F5F5F5', color: '#1A1A1A', flex: 1 }}>← Tillbaka</button>
                <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, flex: 2, justifyContent: 'center' }}>
                  {loading ? 'Skapar konto...' : 'Skicka in & Slutför'}
                </button>
              </div>
              <button
                type="button"
                className="signup-onboarding-skip"
                disabled={loading}
                onClick={() => void submitForm()}
              >
                Nej tack, jag sätter upp allt själv
              </button>
            </form>
          )}

        </div>
      </main>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  border: '1px solid #E5E5E5',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box'
};

const buttonBase = {
  padding: '0.85rem 1.5rem',
  borderRadius: '8px',
  border: 'none',
  fontSize: '1rem',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'transform 0.1s, opacity 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none'
};

const primaryButtonStyle = {
  ...buttonBase,
  background: '#171717',
  color: '#FFFFFF',
  width: '100%',
  boxShadow: '0 4px 14px rgba(0,0,0,0.22)'
};
