import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem('cookie_consent');
    } catch {
      return true;
    }
  });

  const handleAccept = () => {
    try {
      localStorage.setItem('cookie_consent', 'accepted');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie-samtycke">
      <div className="cookie-banner-inner">
        <div className="cookie-banner-icon" aria-hidden>🍪</div>
        <p className="cookie-banner-text">
          Vi använder cookies för att förbättra din upplevelse.{' '}
          <Link to="/cookies" className="cookie-banner-link">Läs mer</Link>
        </p>
        <button
          type="button"
          className="cookie-banner-accept-btn"
          onClick={handleAccept}
        >
          Acceptera
        </button>
      </div>
    </div>
  );
}