import React from 'react';
import { Link } from 'react-router-dom';

/** Vit sidebar-logo → svart på ljus landningssida */
const logoOnLight = {
  width: 'auto',
  display: 'block',
  filter: 'brightness(0)',
};

export default function MarketingLanding() {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: '#171717', background: '#FAFAFA', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '1.25rem 2rem',
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E5E5',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/sidebar-logo.png"
            alt="Appbok"
            style={{ ...logoOnLight, height: '32px' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to="/admin" style={{ 
            color: '#737373', 
            textDecoration: 'none', 
            fontWeight: '500', 
            fontSize: '0.95rem',
            transition: 'color 0.2s'
          }}>Logga in</Link>
          <Link to="/onboarding" style={{ 
            background: '#171717', 
            color: '#FFFFFF', 
            padding: '0.65rem 1.25rem', 
            borderRadius: '10px', 
            textDecoration: 'none', 
            fontWeight: '600',
            fontSize: '0.95rem',
            transition: 'background 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>Kom igång gratis</Link>
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section style={{ 
          padding: '6rem 2rem', 
          textAlign: 'center', 
          background: 'linear-gradient(180deg, #FFFFFF 0%, #F5F4F2 100%)',
          borderBottom: '1px solid #E5E5E5'
        }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ 
              display: 'inline-block', 
              background: '#E0E7FF', 
              color: '#166534', 
              padding: '0.4rem 1rem', 
              borderRadius: '50px', 
              fontWeight: '600', 
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
              letterSpacing: '0.5px'
            }}>
              Nyhet: Superekel salongsbokning
            </div>
            <h1 style={{ 
              fontSize: 'clamp(2.5rem, 5vw, 4rem)', 
              fontWeight: '700', 
              lineHeight: '1.1', 
              letterSpacing: '-1.5px',
              margin: '0 0 1.5rem 0',
              color: '#171717'
            }}>
              Den moderna plattformen för din verksamhet
            </h1>
            <p style={{ 
              fontSize: '1.15rem', 
              color: '#737373', 
              lineHeight: '1.6', 
              marginBottom: '2.5rem',
              maxWidth: '600px',
              margin: '0 auto 2.5rem'
            }}>
              Appbok ger dig allt du behöver för att driva din verksamhet. Bokningssida i världsklass,
              sömlösa betalningar med Stripe och möjlighet för varje stylist att koppla sin egen Google Kalender.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/onboarding" style={{ 
                  background: '#171717', 
                  color: '#FFFFFF', 
                  padding: '0.85rem 2rem', 
                  borderRadius: '12px', 
                  textDecoration: 'none', 
                  fontWeight: '600',
                  fontSize: '1.05rem',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                }}>Skapa din salong</Link>
                <a href="#features" style={{ 
                  background: '#FFFFFF', 
                  color: '#171717', 
                  border: '1.5px solid #E5E5E5',
                  padding: '0.85rem 2rem', 
                  borderRadius: '12px', 
                  textDecoration: 'none', 
                  fontWeight: '600',
                  fontSize: '1.05rem',
                  transition: 'background 0.2s, border-color 0.2s'
                }}>Se funktioner</a>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#737373' }}>14 dagar gratis – inget kreditkort krävs</p>
            </div>
          </div>
          
          {/* Screenshot Preview */}
          <div style={{ 
            marginTop: '5rem', 
            maxWidth: '1000px', 
            margin: '5rem auto 0',
            position: 'relative',
            zIndex: 1,
            padding: '0 1rem'
          }}>
            <img 
              src="/admin-preview-new.png" 
              alt="Appbok Admin Dashboard Preview" 
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: '16px',
                boxShadow: '0 30px 60px rgba(0,0,0,0.12), 0 10px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)'
              }} 
            />
          </div>
        </section>

        {/* Features */}
        <section id="features" style={{ padding: '6rem 2rem', background: '#FAFAFA' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h3 style={{ fontSize: '2.2rem', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '1rem' }}>Allt på ett ställe</h3>
              <p style={{ color: '#737373', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>
                En plattform som växer med din salong. Från första bokningen till fullbokade veckor.
              </p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '2rem' 
            }}>
              <FeatureCard 
                icon="📅"
                title="Smart bokning"
                desc="Din egen white-label bokningssida. Anpassad efter dina färger, helt fri från plattformens varumärke."
              />
              <FeatureCard 
                icon="💳"
                title="Säkra betalningar"
                desc="Ta betalt i förskott med Stripe. Minska no-shows och garantera dina intäkter direkt vid bokning."
              />
              <FeatureCard 
                icon="🔄"
                title="Google Kalender"
                desc="Varje stylist kopplar sin egen Google Kalender när de vill — tvåvägssynk som minskar risken för dubbelbokningar."
              />
              <FeatureCard 
                icon="📊"
                title="Admin Dashboard"
                desc="Ett kraftfullt men enkelt admin-gränssnitt för att hantera tjänster, personal, bokningar och statistik."
              />
              <FeatureCard 
                icon="👥"
                title="Personal & inbjudningar"
                desc="Bjud in stylister med en länk och ge rätt roller. Alla kommer igång utan krångel med konton och lösenord."
              />
              <FeatureCard 
                icon="✉️"
                title="E-postbekräftelser"
                desc="Kunder får automatiska bekräftelser vid bokning. Ni slipper dubbelarbete och missförstånd kring tider."
              />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="priser" style={{ padding: '6rem 2rem', background: '#FFFFFF', borderTop: '1px solid #E5E5E5' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '1rem', color: '#171717' }}>
                Enkel, transparent prissättning
              </h2>
              <p style={{ color: '#737373', fontSize: '1.1rem', maxWidth: '480px', margin: '0 auto' }}>
                Ett pris. Allt inkluderat. Prova gratis i 14 dagar — inget kreditkort krävs.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                background: '#171717',
                borderRadius: '24px',
                padding: '3rem',
                maxWidth: '480px',
                width: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Glow accent */}
                <div style={{
                  position: 'absolute', top: '-40px', right: '-40px',
                  width: '200px', height: '200px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }} />

                {/* Badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFFFFF',
                  padding: '0.35rem 0.9rem',
                  borderRadius: '50px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  letterSpacing: '0.5px',
                  marginBottom: '2rem',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                  14 DAGARS GRATIS PROVPERIOD
                </div>

                {/* Price */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '3.5rem', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-2px', lineHeight: 1 }}>
                    1 990
                  </span>
                  <span style={{ fontSize: '1.1rem', color: '#A3A3A3', marginLeft: '6px', fontWeight: '500' }}>
                    kr / mån
                  </span>
                </div>
                <p style={{ color: '#737373', fontSize: '0.9rem', marginBottom: '2.5rem', margin: '0 0 2.5rem 0' }}>
                  Exkl. moms · Faktureras månadsvis · Avsluta när som helst
                </p>

                {/* Features list */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {[
                    'Obegränsade bokningar',
                    'White-label bokningssida med eget tema',
                    'Stripe-betalningar & förskottsbetalning',
                    'Google Kalender per stylist (valfritt)',
                    'Obegränsad personal & roller',
                    'E-postbekräftelser till kunder',
                    'Admin-dashboard med statistik',
                    'Prioriterad support via e-post',
                  ].map((feat) => (
                    <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#D4D4D4', fontSize: '0.95rem' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.1)" />
                        <path d="M4.5 8l2.5 2.5 4-5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link to="/onboarding" style={{
                  display: 'block',
                  background: '#FFFFFF',
                  color: '#171717',
                  padding: '1rem',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  fontWeight: '700',
                  fontSize: '1rem',
                  textAlign: 'center',
                  boxShadow: '0 4px 20px rgba(255,255,255,0.15)',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Starta din 14-dagars provperiod →
                </Link>
                <p style={{ color: '#525252', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem', marginBottom: 0 }}>
                  Inget kreditkort krävs vid registrering
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ 
          padding: '6rem 2rem', 
          background: '#171717', 
          color: '#FFFFFF',
          textAlign: 'center'
        }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-1px', marginBottom: '1.5rem' }}>
              Redo att ta din salong till nästa nivå?
            </h2>
            <p style={{ color: '#A3A3A3', fontSize: '1.1rem', marginBottom: '2.5rem' }}>
              Sätt upp din bokningssida på under 5 minuter.
              Prova gratis i 14 dagar — inget kreditkort krävs.
            </p>
            <Link to="/onboarding" style={{ 
              display: 'inline-block',
              background: '#FFFFFF', 
              color: '#171717', 
              padding: '1rem 2.5rem', 
              borderRadius: '12px', 
              textDecoration: 'none', 
              fontWeight: '600',
              fontSize: '1.1rem',
              boxShadow: '0 4px 14px rgba(255,255,255,0.1)'
            }}>Starta gratis i 14 dagar</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ 
        background: '#FAFAFA', 
        borderTop: '1px solid #E5E5E5',
        padding: '3rem 2rem'
      }}>
        <div style={{ 
          maxWidth: '1100px', 
          margin: '0 auto', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/sidebar-logo.png"
              alt="Appbok"
              style={{ ...logoOnLight, height: '24px', opacity: 0.45 }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <Link to="/villkor" style={{ color: '#737373', textDecoration: 'none', fontSize: '0.9rem' }}>Villkor</Link>
            <a href="mailto:support@appbok.se" style={{ color: '#737373', textDecoration: 'none', fontSize: '0.9rem' }}>Kontakt</a>
          </div>
          <p style={{ color: '#A3A3A3', fontSize: '0.85rem', margin: 0 }}>
            © {new Date().getFullYear()} Appbok. Alla rättigheter förbehållna.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div style={{ 
      background: '#FFFFFF', 
      padding: '2rem', 
      borderRadius: '16px', 
      border: '1px solid #E5E5E5',
      boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.05)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)';
    }}
    >
      <div style={{ 
        width: '48px', 
        height: '48px', 
        background: '#F5F4F2', 
        borderRadius: '12px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {icon}
      </div>
      <h4 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.75rem', color: '#171717' }}>{title}</h4>
      <p style={{ color: '#737373', lineHeight: '1.6', fontSize: '0.95rem', margin: 0 }}>{desc}</p>
    </div>
  );
}
