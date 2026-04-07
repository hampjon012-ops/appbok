import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLoginScreen from '../components/admin/AdminLoginScreen.jsx';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [salonName, setSalonName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Logga in — Appbok Admin';
    if (localStorage.getItem('sb_token')) navigate('/admin');
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body =
      mode === 'register'
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

  const onToggleMode = (next) => {
    setMode(next);
    setError('');
  };

  return (
    <AdminLoginScreen
      mode={mode}
      onToggleMode={onToggleMode}
      name={name}
      salonName={salonName}
      email={email}
      password={password}
      onNameChange={setName}
      onSalonNameChange={setSalonName}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      error={error}
      loading={loading}
      onSubmit={handleSubmit}
    />
  );
}
