import React from 'react';

/**
 * Visas när användaren besöker en salongs-subdomän som inte finns i databasen
 * (strikt tenant-läge i fetchMergedSalonConfig).
 */
export default function SalonTenantNotFoundView({ attemptedSlug }) {
  return (
    <div
      className="loading-screen tenant-not-found-screen"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '0.75rem',
        textAlign: 'center',
        padding: '2rem 1.25rem',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Salongen hittades inte</h1>
      <p style={{ margin: 0, opacity: 0.85, maxWidth: 28 * 16 }}>
        Det finns ingen salong kopplad till den här adressen. Kontrollera stavningen eller gå till
        startsidan.
      </p>
      {attemptedSlug ? (
        <p style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.9rem', opacity: 0.7 }}>
          {attemptedSlug}.appbok.se
        </p>
      ) : null}
    </div>
  );
}
