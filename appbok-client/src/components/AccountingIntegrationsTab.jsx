import { useState, useCallback, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { adminApiHeaders as authHeaders } from '../lib/adminApiHeaders.js';

const FORTNOX_STRIPE_URL =
  'https://www.fortnox.se/integrationer/integration/fortnox-ab-1778289/fortnox-stripe';
const INTEGRATI_STRIPE_URL =
  'https://www.fortnox.se/integrationer/integration/integrati/stripe-bokforing';

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: isoDate(from), to: isoDate(to) };
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Semikolon-separerat för enkel öppning i svensk Excel */
function buildCsv(rows) {
  const header = ['Datum', 'Kund', 'Tjänst', 'Belopp inkl. moms', 'Moms (25%)', 'Betalsätt'];
  const lines = [
    header.map(csvCell).join(';'),
    ...rows.map((r) => r.map(csvCell).join(';')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

function serviceNameFromBooking(b) {
  if (Array.isArray(b.booking_services) && b.booking_services.length) {
    return b.booking_services.map((s) => s?.name).filter(Boolean).join(' + ');
  }
  if (b.services && typeof b.services === 'object' && b.services.name) {
    return b.services.name;
  }
  return '—';
}

function paymentMethodLabel(b) {
  const paid = Number(b.amount_paid) || 0;
  if (paid <= 0) return '—';
  if (b.stripe_payment_intent_id) return 'Kort (Stripe)';
  return 'På plats / annat';
}

function formatSekFromÖre(öre) {
  const n = Math.round(Number(öre) || 0);
  return (n / 100).toFixed(2).replace('.', ',');
}

function vat25FromInclÖre(öre) {
  const total = Math.round(Number(öre) || 0);
  const vat = total - total / 1.25;
  return (vat / 100).toFixed(2).replace('.', ',');
}

export default function AccountingIntegrationsTab() {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const handleExport = useCallback(async () => {
    setExportMsg('');
    if (!dateFrom || !dateTo) {
      setExportMsg('Välj både från- och till-datum.');
      return;
    }
    if (dateFrom > dateTo) {
      setExportMsg('Från-datum får inte vara efter till-datum.');
      return;
    }

    setExportBusy(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const res = await fetch(`/api/bookings?${params}`, { headers: authHeaders(), cache: 'no-store' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Kunde inte hämta bokningar.');
      }
      if (!Array.isArray(data)) throw new Error('Ogiltigt svar från servern.');

      const rows = data.map((b) => {
        const d = b.booking_date
          ? new Date(`${b.booking_date}T12:00:00`).toLocaleDateString('sv-SE')
          : '—';
        const kund = b.customer_name || '—';
        const tjänst = serviceNameFromBooking(b);
        const belopp = formatSekFromÖre(b.amount_paid);
        const moms = vat25FromInclÖre(b.amount_paid);
        const sätt = paymentMethodLabel(b);
        return [d, kund, tjänst, belopp, moms, sätt];
      });

      const csv = buildCsv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appbok-export_${dateFrom}_${dateTo}.csv`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg(rows.length ? `Exporterade ${rows.length} rader.` : 'Inga bokningar i intervallet.');
    } catch (e) {
      setExportMsg(e?.message || 'Export misslyckades.');
    } finally {
      setExportBusy(false);
    }
  }, [dateFrom, dateTo]);

  return (
    <div className="admin-section accounting-integrations">
      <h2 className="admin-section-title">Bokföring &amp; Integrationer</h2>
      <p className="admin-card-desc accounting-integrations-lead">
        Automatisera din bokföring genom att koppla ihop Appbok med Fortnox, eller ladda ner dina underlag manuellt.
      </p>

      <h3 className="accounting-integrations-subtitle">Automatiska kopplingar</h3>
      <div className="accounting-integration-grid">
        <article className="admin-card accounting-integration-card">
          <h4 className="accounting-integration-card__title">Fortnox via Stripe (Officiell)</h4>
          <p className="accounting-integration-card__desc">
            Bäst för nystartade salonger. Gratis upp till 10 transaktioner/mån.
          </p>
          <a
            className="accounting-external-btn"
            href={FORTNOX_STRIPE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Läs mer &amp; Installera</span>
            <ExternalLink size={16} strokeWidth={2} aria-hidden />
          </a>
        </article>

        <article className="admin-card accounting-integration-card">
          <h4 className="accounting-integration-card__title">Fortnox via Integrati (Pro)</h4>
          <p className="accounting-integration-card__desc">
            Bäst för etablerade salonger. Fast månadspris (199 kr) oavsett volym.
          </p>
          <a
            className="accounting-external-btn"
            href={INTEGRATI_STRIPE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Läs mer &amp; Installera</span>
            <ExternalLink size={16} strokeWidth={2} aria-hidden />
          </a>
        </article>
      </div>

      <div className="admin-card accounting-export-card">
        <h3 className="admin-card-title">Manuell export</h3>
        <p className="admin-card-desc">
          Välj datumintervall utifrån <strong>bokningsdatum</strong>. Alla bokningar i perioden ingår; belopp och moms
          utgår från fältet betalt belopp (öre i databasen, visas som SEK nedan).
        </p>
        <div className="accounting-export-row">
          <label className="accounting-export-field">
            <span className="accounting-export-label">Från</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="accounting-export-input" />
          </label>
          <label className="accounting-export-field">
            <span className="accounting-export-label">Till</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="accounting-export-input" />
          </label>
        </div>
        <button type="button" className="btn-admin-primary accounting-export-btn" disabled={exportBusy} onClick={handleExport}>
          {exportBusy ? 'Exporterar…' : 'Ladda ner CSV-export'}
        </button>
        {exportMsg ? (
          <p className={`accounting-export-feedback ${exportMsg.startsWith('Exporterade') ? 'accounting-export-feedback--ok' : ''}`}>
            {exportMsg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
