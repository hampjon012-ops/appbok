import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyThemeToDocument, fetchMergedSalonConfig } from './lib/salonPublicConfig';
import SalonTenantNotFoundView from './components/SalonTenantNotFoundView.jsx';

export default function Terms() {
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
        document.title = `Bokningsvillkor – ${d.salonName}`;
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
    <div className="terms-page">
      <div className="terms-page-inner">
        <Link to="/" className="terms-back-link">‹ Tillbaka till startsidan</Link>

        <h1 className="terms-page-title">Bokningsvillkor — {salonName}</h1>

        <div className="terms-section">
          <h2>1. Avbokning och ändring</h2>
          <p>
            Avbokning eller ändring av bokad tid ska ske senast 24 timmar före bokad tid.
            Vid avbokning senare än 24 timmar före bokad tid debiteras 50&nbsp;% av
            tjänstens pris som avgift.
          </p>
        </div>

        <div className="terms-section">
          <h2>2. Betalning</h2>
          <p><strong>Swish:</strong> Betalning via Swish är en förbetalning och genomförs i
          samband med bokningstillfället. Beloppet dras omedelbart.</p>
          <p><strong>På plats:</strong> Betalning sker i salongen vid besökstillfället.
          Vi accepterar Swish, kort och kontant.</p>
        </div>

        <div className="terms-section">
          <h2>3. Återbetalning</h2>
          <p>
            Återbetalning av Swish-betalningar sker endast vid avbokning som görs minst
            24 timmar före bokad tid. Vid sen avbokning eller utebliven ankomst sker
            ingen återbetalning.
          </p>
        </div>

        <div className="terms-section">
          <h2>4. Försenad ankomst</h2>
          <p>
            Vi förbehåller oss rätten att avboka din tid utan återbetalning vid försenad
            ankomst. Kontakta oss så snart som möjligt om du vet att du blir försenad så
            att vi kan försöka hitta en lösning.
          </p>
        </div>

        <div className="terms-section">
          <h2>5. Ansvar</h2>
          <p>
            Kunden ansvarar för sina personliga tillhörigheter under besöket. {salonName} ansvarar
            inte för förlust av eller skador på värdesaker, smycken eller andra personliga
            tillhörigheter.
          </p>
        </div>

        <div className="terms-section">
          <h2>6. GDPR och personuppgifter</h2>
          <p>
            Vi lagrar namn, e-postadress och telefonnummer enbart för bokningshantering
            och kundkommunikation. Uppgifterna delas inte med tredje part och raderas på
            begäran. Du har rätt att begära utdrag, rättelse eller radering av dina
            uppgifter genom att kontakta oss.
          </p>
        </div>

        <div className="terms-section">
          <h2>7. Force majeure</h2>
          <p>
            Vi ansvarar inte för avbokningar eller ändringar som orsakas av omständigheter
            utanför vår kontroll, såsom brand, sjukdom, naturkatastrofer eller
            myndighetsåtgärder.
          </p>
        </div>

        <Link to="/" className="ty-back-btn" style={{ marginTop: '2rem', display: 'inline-block' }}>
          ← Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
}
