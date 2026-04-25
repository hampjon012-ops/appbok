import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyThemeToDocument, fetchMergedSalonConfig } from '../lib/salonPublicConfig.js';
import SalonTenantNotFoundView from '../components/SalonTenantNotFoundView.jsx';

export default function PrivacyPage({ salonSlug }) {
  const [salonName, setSalonName] = useState('Colorisma');
  const [pageState, setPageState] = useState('loading');
  const [missingTenantSlug, setMissingTenantSlug] = useState(null);

  useEffect(() => {
    fetchMergedSalonConfig()
      .then((d) => {
        if (d.tenantNotFound) {
          document.title = 'Integritetspolicy | Appbok';
          setMissingTenantSlug(d.attemptedSlug ?? null);
          setPageState('not_found');
          return;
        }
        setSalonName(d.salonName);
        document.title = `Integritetspolicy – ${d.salonName}`;
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
    <div className="privacy-page">
      <div className="privacy-page-inner">
        <Link to="/" className="privacy-back-link">‹ Tillbaka till startsidan</Link>

        <div className="privacy-page-header">
          <div className="privacy-page-lock-icon" aria-hidden>🔒</div>
          <h1 className="privacy-page-title">Integritetspolicy</h1>
          <p className="privacy-page-subtitle">för {salonName}</p>
          <p className="privacy-page-meta">Appbok · Uppdaterad april 2026</p>
        </div>

        <div className="privacy-section">
          <h2 className="privacy-section-heading">Personuppgifter vi samlar in</h2>
          <p className="privacy-section-body">
            Vid bokning samlar vi in följande uppgifter: <strong>namn, e-postadress och telefonnummer</strong>.
            Vi sparar även din bokningshistorik och eventuella meddelanden du skickar till salongen.
          </p>
        </div>

        <div className="privacy-section">
          <h2 className="privacy-section-heading">Hur vi använder uppgifterna</h2>
          <ul className="privacy-list">
            <li>Bekräftelse och påminnelse via SMS och e-post före din bokning</li>
            <li>Synkronisering med Google Kalender (om din stylist har kopplat sitt konto)</li>
            <li>Betalningshantering via Stripe vid onlinebetalning</li>
            <li>Support och kommunikation vid frågor om din bokning</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h2 className="privacy-section-heading">Lagringstid</h2>
          <p className="privacy-section-body">
            Bokningsuppgifter sparas i <strong>24 månader</strong> efter genomförd tjänst.
            Därefter anonymiseras personuppgifterna automatiskt i enlighet med GDPR.
          </p>
        </div>

        <div className="privacy-section">
          <h2 className="privacy-section-heading">Dina rättigheter</h2>
          <p className="privacy-section-body">Som kund har du rätt att:</p>
          <ul className="privacy-list">
            <li><strong>Rätt till tillgång (artikel 15):</strong> Begära en kopia av alla uppgifter vi har om dig.</li>
            <li><strong>Rätt till radering (artikel 17):</strong> Begära att vi raderar alla personuppgifter kopplade till dig.</li>
            <li><strong>Rätt att invända:</strong> Invända mot behandling av dina uppgifter.</li>
          </ul>
          <p className="privacy-section-body">
            Kontakta salongen direkt för att utöva dina rättigheter, eller mejla <strong>hej@appbok.se</strong>.
          </p>
        </div>

        <div className="privacy-section">
          <h2 className="privacy-section-heading">Personuppgiftsansvarig</h2>
          <p className="privacy-section-body">
            <strong>{salonName}</strong> är personuppgiftsansvarig för de uppgifter du lämnar vid bokning.
            Appbok AB (org.nr. 559347-XXXX) är personuppgiftsbiträde och behandlar uppgifterna på salongens uppdrag.
          </p>
        </div>

        <div className="privacy-section">
          <h2 className="privacy-section-heading">Kontakt</h2>
          <p className="privacy-section-body">
            Appbok AB<br />
            E-post: <a href="mailto:hej@appbok.se" className="privacy-link">hej@appbok.se</a><br />
            Webb: <a href="https://appbok.se" className="privacy-link" target="_blank" rel="noopener noreferrer">appbok.se</a>
          </p>
        </div>

        <div className="privacy-dpa-card">
          <div className="privacy-dpa-icon" aria-hidden>📄</div>
          <div>
            <p className="privacy-dpa-title">Databehandlingsavtal (DPA)</p>
            <p className="privacy-dpa-body">
              Salonger som behandlar personuppgifter via Appbok ska ha ett signerat DPA med Appbok AB.
            </p>
          </div>
        </div>

        <p className="privacy-footer-note">
          Genom att boka godkänner du salongens integritetspolicy och Appboks behandling av dina uppgifter.
        </p>
      </div>
    </div>
  );
}