import { Link } from 'react-router-dom';

export default function CookiesPage() {
  return (
    <div className="cookies-page">
      <div className="cookies-page-inner">
        <Link to="/" className="cookies-back-link">‹ Tillbaka till startsidan</Link>
        <h1 className="cookies-page-title">Cookies</h1>

        <div className="cookies-cookie-item">
          <p className="cookies-cookie-category">Nödvändiga cookies</p>
          <span className="cookies-cookie-status cookies-cookie-status--on">Alltid aktiva</span>
          <p className="cookies-cookie-desc">
            Dessa cookies är nödvändiga för att bokningssystemet ska fungera. De hanterar sessionsinformation,
            säker inloggning och tillfällig data som behövs för att du ska kunna boka en tid.
          </p>
        </div>

        <div className="cookies-cookie-item">
          <p className="cookies-cookie-category">Funktionella cookies</p>
          <span className="cookies-cookie-status cookies-cookie-status--on">Aktiva vid koppling</span>
          <p className="cookies-cookie-desc">
            Dessa cookies aktiveras endast om din stylist har kopplat sitt Google Kalender-konto eller om du väljer
            att betala online via Stripe. De används för att synkronisera bokningar med externa tjänster.
          </p>
        </div>

        <div className="cookies-cookie-item">
          <p className="cookies-cookie-category">Marknadsföringscookies</p>
          <span className="cookies-cookie-status cookies-cookie-status--off">Inga egna</span>
          <p className="cookies-cookie-desc">
            Vi använder inte Google Analytics, Facebook-pixel eller andra spårningsverktyg för marknadsföring.
            Appbok samlar inte in uppgifter för att bygga annonsprofiler.
          </p>
        </div>

        <div className="cookies-cookie-item">
          <p className="cookies-cookie-category">SMS-samtycke</p>
          <span className="cookies-cookie-status cookies-cookie-status--off">Frivilligt</span>
          <p className="cookies-cookie-desc">
            Om du väljer att ge samtycke till SMS-aviseringar vid bokning sparas detta tillsammans med din
            bokning. Du kan när som helst återkalla samtycket genom att kontakta salongen.
          </p>
        </div>
      </div>
    </div>
  );
}