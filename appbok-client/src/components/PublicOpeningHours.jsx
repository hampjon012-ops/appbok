import { formatOpeningHoursRange } from '../lib/publicOpeningHours.js';

const CLOCK_SVG = (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * Strukturerade öppettider på den publika bokningssidan (kontaktsektionen).
 * @param {{ week: Array<{ day: string, isOpen: boolean, openTime: string, closeTime: string }> | null }} props
 */
export default function PublicOpeningHours({ week }) {
  const hasWeek = Array.isArray(week) && week.length === 7;

  return (
    <div className="contact-info-item align-top">
      <div className="contact-icon">{CLOCK_SVG}</div>
      <div className="public-opening-hours-body">
        <h4>Öppettider</h4>
        {!hasWeek ? (
          <p className="public-opening-hours-placeholder">Öppettider kommer snart</p>
        ) : (
          <div className="public-opening-hours-rows">
            {week.map((d, i) => (
              <div key={`${d.day}-${i}`} className="public-opening-hours-row">
                <span className="public-opening-hours-day">{d.day}</span>
                <span className="public-opening-hours-times">{formatOpeningHoursRange(d)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
