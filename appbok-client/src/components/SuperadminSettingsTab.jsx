import { useState } from 'react';

function EyeIcon({ off }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sa-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function Card({ title, children, className = '' }) {
  return (
    <div className={`sa-card ${className}`}>
      {title && <h2 className="sa-card-title">{title}</h2>}
      {children}
    </div>
  );
}

function Field({ label, id, hint, required, children }) {
  return (
    <div className="sa-field">
      <label className="sa-label" htmlFor={id}>
        {label}
        {required && <span className="sa-label-required">*</span>}
      </label>
      {children}
      {hint && <p className="sa-hint">{hint}</p>}
    </div>
  );
}

function Input({ id, type = 'text', placeholder, value, onChange, disabled, className = '' }) {
  return (
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`sa-input ${disabled ? 'sa-input--disabled' : ''} ${className}`}
    />
  );
}

function PasswordInput({ id, placeholder, value, onChange, disabled, onToggle, visible }) {
  return (
    <div className="sa-password-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`sa-input sa-input--pw ${disabled ? 'sa-input--disabled' : ''}`}
      />
      <button
        type="button"
        className="sa-pw-toggle"
        onClick={onToggle}
        disabled={disabled}
        tabIndex={-1}
        aria-label={visible ? 'Dölj' : 'Visa'}
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}

function SubmitBtn({ children, loading, disabled, variant = 'primary' }) {
  return (
    <button
      type="submit"
      className={`sa-btn sa-btn--${variant}`}
      disabled={disabled || loading}
    >
      {loading ? <SpinnerIcon /> : children}
    </button>
  );
}

function Msg({ msg }) {
  if (!msg) return null;
  const ok = msg === 'Sparat!';
  return (
    <p className={`sa-msg ${ok ? 'sa-msg--ok' : 'sa-msg--err'}`}>
      {ok && <CheckIcon />}
      {msg}
    </p>
  );
}

export default function SuperadminSettingsTab({ user }) {
  // ── Profile ─────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // ── Platform ────────────────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('Appbok AB');
  const [supportEmail, setSupportEmail] = useState('');
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformMsg, setPlatformMsg] = useState('');

  // ── Stripe ─────────────────────────────────────────────────────────────────
  const [stripeKey, setStripeKey] = useState('');
  const [stripeWebhook, setStripeWebhook] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeMsg, setStripeMsg] = useState('');

  async function handleProfile(e) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg('');
    await new Promise(r => setTimeout(r, 600));
    setProfileMsg('Sparat!');
    setNewPassword('');
    setProfileLoading(false);
  }

  async function handlePlatform(e) {
    e.preventDefault();
    setPlatformLoading(true);
    setPlatformMsg('');
    await new Promise(r => setTimeout(r, 600));
    setPlatformMsg('Sparat!');
    setPlatformLoading(false);
  }

  async function handleStripe(e) {
    e.preventDefault();
    setStripeLoading(true);
    setStripeMsg('');
    await new Promise(r => setTimeout(r, 600));
    setStripeMsg('Sparat!');
    setStripeKey('');
    setStripeWebhook('');
    setStripeLoading(false);
  }

  return (
    <div className="sa-settings-root">
      <div className="sa-settings-header">
        <h1 className="sa-settings-heading">Inställningar</h1>
        <p className="sa-settings-sub">Hantera konto, plattformsgemenskapa inställningar och API-nycklar.</p>
      </div>

      <div className="sa-settings-grid">

        {/* ── Card 1: Profil ──────────────────────────────────────────── */}
        <Card title="Konto &amp; Säkerhet">
          <form onSubmit={handleProfile} className="sa-card-form">
            <Field label="E-postadress" id="profile-email" hint="Mejladressen som används för att logga in.">
              <Input
                id="profile-email"
                type="email"
                placeholder="admin@appbok.se"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Nytt lösenord" id="profile-password" hint="Lämna blankt för att behålla nuvarande lösenord.">
              <Input
                id="profile-password"
                type="password"
                placeholder="Minst 8 tecken"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </Field>
            <div className="sa-card-actions">
              <SubmitBtn loading={profileLoading}>Uppdatera profil</SubmitBtn>
              <Msg msg={profileMsg} />
            </div>
          </form>
        </Card>

        {/* ── Card 2: Plattform ─────────────────────────────────────── */}
        <Card title="Globala Appbok-inställningar">
          <form onSubmit={handlePlatform} className="sa-card-form">
            <Field label="Företagsnamn" id="platform-name">
              <Input
                id="platform-name"
                placeholder="Appbok AB"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
              />
            </Field>
            <Field label="Support E-post" id="support-email" hint="Den adress salonger kontaktar vid problem.">
              <Input
                id="support-email"
                type="email"
                placeholder="support@appbok.se"
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
              />
            </Field>
            <div className="sa-card-actions">
              <SubmitBtn loading={platformLoading}>Spara inställningar</SubmitBtn>
              <Msg msg={platformMsg} />
            </div>
          </form>
        </Card>

        {/* ── Card 3: Integrationer & API ──────────────────────────── */}
        <Card title="Betalningsleverantör (Stripe)" className="sa-card--full">
          <form onSubmit={handleStripe} className="sa-card-form">
            <p className="sa-card-desc">
              API-nycklar för att hantera plattformens prenumerationsintäkter via Stripe.
              Håll dessa nycklar hemliga och rotera dem regelbundet.
            </p>
            <div className="sa-stripe-fields">
              <Field label="Stripe Secret Key" id="stripe-secret" hint="Hemlig nyckel från Stripe Dashboard.">
                <PasswordInput
                  id="stripe-secret"
                  placeholder="sk_live_..."
                  value={stripeKey}
                  onChange={e => setStripeKey(e.target.value)}
                  visible={showKey}
                  onToggle={() => setShowKey(v => !v)}
                />
              </Field>
              <Field label="Stripe Webhook Secret" id="stripe-webhook" hint="För att verifiera inkommande Stripe-webhooks.">
                <PasswordInput
                  id="stripe-webhook"
                  placeholder="whsec_..."
                  value={stripeWebhook}
                  onChange={e => setStripeWebhook(e.target.value)}
                  visible={showWebhook}
                  onToggle={() => setShowWebhook(v => !v)}
                />
              </Field>
            </div>
            <div className="sa-card-actions">
              <SubmitBtn loading={stripeLoading} variant="primary">Spara nycklar</SubmitBtn>
              <Msg msg={stripeMsg} />
            </div>
          </form>
        </Card>

      </div>
    </div>
  );
}
