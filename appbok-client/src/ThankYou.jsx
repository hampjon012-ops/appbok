import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { applyThemeToDocument, fetchMergedSalonConfig } from './lib/salonPublicConfig';
import SalonTenantNotFoundView from './components/SalonTenantNotFoundView.jsx';

export default function ThankYou() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [salonName, setSalonName] = useState('Colorisma');
  const [pageState, setPageState] = useState('loading');
  const [missingTenantSlug, setMissingTenantSlug] = useState(null);

  useEffect(() => {
    fetchMergedSalonConfig()
      .then((d) => {
        if (d.tenantNotFound) {
          document.title = 'Salongen hittades inte | Appbok';
          setMissingTenantSlug(d.attemptedSlug ?? null);
          setPageState('not_found');
          return;
        }
        setSalonName(d.salonName);
        document.title = `Tack för din bokning – ${d.salonName}`;
        if (d.theme) applyThemeToDocument(d.theme);
        setPageState('ready');
      })
      .catch(() => {
        setPageState('ready');
      });
  }, []);

  if (pageState === 'loading') {
    return <div className="loading-screen">Laddar...</div>;
  }

  if (pageState === 'not_found') {
    return <SalonTenantNotFoundView attemptedSlug={missingTenantSlug} />;
  }

  return (
    <div className="thankyou-page">
      <div className="thankyou-card">
        {/* Animated checkmark */}
        <div className="ty-icon">
          <svg viewBox="0 0 52 52" fill="none">
            <circle className="ty-circle" cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2"/>
            <path className="ty-check" d="M14 27l8 8 16-16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 className="ty-heading">Tack för din bokning!</h1>
        <p className="ty-sub">
          Betalningen gick igenom. Du får en bekräftelse via e-post och SMS inom kort.
        </p>

        {sessionId && (
          <p className="ty-session">Boknings-ID: <code>{sessionId.slice(-8).toUpperCase()}</code></p>
        )}

        <div className="ty-details">
          <div className="ty-detail-row">
            <span>📍</span>
            <span>{salonName}</span>
          </div>
          <div className="ty-detail-row">
            <span>📧</span>
            <span>Bekräftelse skickas till din e-postadress</span>
          </div>
          <div className="ty-detail-row">
            <span>💬</span>
            <span>SMS-bekräftelse skickas till ditt telefonnummer</span>
          </div>
          <div className="ty-detail-row">
            <span>⏰</span>
            <span>Avbokning måste ske senast 24h i förväg</span>
          </div>
        </div>

        <Link to="/" className="ty-back-btn">
          ← Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
}
