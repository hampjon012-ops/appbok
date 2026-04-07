import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { replaceWithAdminDashboard } from '../lib/adminUrls.js';

export default function Invite() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [salonName, setSalonName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Validate token on mount
    fetch(`/api/staff/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setValid(true);
          setSalonName(data.salonName);
        } else {
          setErrorMsg(data.error || 'Inbjudan är ogiltig.');
        }
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('Systemfel vid validering.');
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/staff/invite/${token}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Något gick fel.');
      }

      // Success
      localStorage.setItem('sb_token', data.token);
      localStorage.setItem('sb_user', JSON.stringify(data.user));
      if (Array.isArray(data.salon) && data.salon.length > 0) {
        localStorage.setItem('sb_salon', JSON.stringify(data.salon[0]));
      } else {
        localStorage.setItem('sb_salon', JSON.stringify(data.salon || {}));
      }

      replaceWithAdminDashboard();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card invite-card" style={{ textAlign: 'center' }}>
          <div className="invite-mark">SB</div>
          <h2 className="invite-state-title">Validerar inbjudan...</h2>
          <p className="invite-state-text">Vi kontrollerar din lank, ett ogonblick.</p>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="login-page">
        <div className="login-card invite-card" style={{ textAlign: 'center' }}>
          <div className="invite-mark invite-mark-error">!</div>
          <h2 className="invite-state-title">Ogiltig lank</h2>
          <p className="api-error invite-error-inline">{errorMsg}</p>
          <button className="btn-pay" onClick={() => navigate('/')}>Till startsidan</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card invite-card">
        <div className="invite-mark">SB</div>
        <div className="login-header">
          <h1>Valkommen till {salonName}</h1>
          <p>Skapa ditt konto för att hantera dina bokningar.</p>
        </div>

        {errorMsg && <p className="api-error">{errorMsg}</p>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="invite-name">Ditt namn</label>
            <input 
              id="invite-name"
              type="text" 
              required 
              placeholder="T.ex. Emma Lindqvist"
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label htmlFor="invite-email">E-postadress</label>
            <input 
              id="invite-email"
              type="email" 
              required 
              placeholder="din.epost@example.com"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label htmlFor="invite-password">Valj losenord</label>
            <input 
              id="invite-password"
              type="password" 
              required 
              placeholder="Minst 6 tecken"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              minLength={6}
            />
          </div>

          <button type="submit" className="btn-pay" disabled={isSubmitting}>
            {isSubmitting ? 'Skapar konto...' : 'Skapa konto'}
          </button>
        </form>
        <p className="invite-footnote">Du blir automatiskt inloggad nar kontot ar skapat.</p>
      </div>
    </div>
  );
}
