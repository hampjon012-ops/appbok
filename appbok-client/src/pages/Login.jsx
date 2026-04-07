import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [salonName, setSalonName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Logga in — SalonBook Admin';
    // If already logged in, redirect
    if (localStorage.getItem('sb_token')) navigate('/admin');
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = mode === 'register'
      ? { email, password, name, salonName }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Något gick fel.');
        setLoading(false);
        return;
      }

      localStorage.setItem('sb_token', data.token);
      localStorage.setItem('sb_user', JSON.stringify(data.user));
      localStorage.setItem('sb_salon', JSON.stringify(data.salon));
      navigate('/admin');
    } catch {
      setError('Kan inte nå servern. Kontrollera att API:t körs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>SalonBook</h1>
          <p>{mode === 'login' ? 'Logga in på din salong' : 'Skapa konto för din salong'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label htmlFor="login-name">Ditt namn</label>
                <input
                  id="login-name"
                  type="text"
                  placeholder="Förnamn Efternamn"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-salon">Salongens namn</label>
                <input
                  id="login-salon"
                  type="text"
                  placeholder="T.ex. Studio Milano"
                  value={salonName}
                  onChange={e => setSalonName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="login-email">E-post</label>
            <input
              id="login-email"
              type="email"
              placeholder="din@email.se"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Lösenord</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="api-error">{error}</p>}

          <button type="submit" className="btn-pay" disabled={loading}>
            {loading
              ? '⏳ Vänta...'
              : mode === 'login' ? 'Logga in' : 'Skapa konto'
            }
          </button>
        </form>

        <div className="login-toggle">
          {mode === 'login' ? (
            <p>Har du inget konto? <button onClick={() => { setMode('register'); setError(''); }} className="text-link">Skapa ett här</button></p>
          ) : (
            <p>Har du redan ett konto? <button onClick={() => { setMode('login'); setError(''); }} className="text-link">Logga in</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
