import { useMemo, useState } from 'react';
import { BookOpen, Zap, ExternalLink, Download } from 'lucide-react';
import '../accounting-tw.css';

const FORTNOX_STRIPE_URL =
  'https://www.fortnox.se/integrationer/integration/fortnox-ab-1778289/fortnox-stripe';
const INTEGRATI_STRIPE_URL =
  'https://www.fortnox.se/integrationer/integration/integrati/stripe-bokforing';

const integrationCtaClassName =
  'mt-6 w-fit gap-2 inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors';

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

export default function AccountingIntegrationsTab({ embedded = false }) {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const handleExportCSV = () => {
    // Placeholder tills export är kopplad till API igen
    console.log('[CSV export]', { dateFrom, dateTo });
  };

  return (
    <div className="max-w-5xl">
      {!embedded ? (
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bokföring &amp; Integrationer</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-600">
            Appbok tar inte ut några extra avgifter för bokföring. Välj en automatisk koppling nedan (avgifter från
            tredje part kan tillkomma) eller ladda ner dina underlag manuellt helt kostnadsfritt.
          </p>
        </header>
      ) : (
        <p className="mb-6 max-w-3xl text-sm leading-relaxed text-gray-600">
          Appbok tar inte ut några extra avgifter för bokföring. Välj en automatisk koppling nedan (avgifter från tredje
          part kan tillkomma) eller ladda ner dina underlag manuellt helt kostnadsfritt.
        </p>
      )}

      {!embedded ? (
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Automatiska kopplingar</p>
      ) : null}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <article className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-7">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <BookOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-gray-900">Fortnox via Stripe (Officiell)</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
            Bäst för nystartade salonger. Bokför dina onlinebetalningar helt automatiskt. Gratis upp till 10
            bokningar/månad.
          </p>
          <a
            href={FORTNOX_STRIPE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={integrationCtaClassName}
          >
            <span>Läs mer &amp; Installera</span>
            <ExternalLink className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
          </a>
        </article>

        <article className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-7">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <Zap className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-gray-900">Fortnox via Integrati (Pro)</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
            Bäst för etablerade salonger. Fast pris (199 kr/mån) oavsett volym. Hanterar Stripes avgifter och returer
            automatiskt ner på öret.
          </p>
          <a
            href={INTEGRATI_STRIPE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={integrationCtaClassName}
          >
            <span>Läs mer &amp; Installera</span>
            <ExternalLink className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
          </a>
        </article>
      </div>

      <p className="text-xs text-gray-500 text-center mt-6">
        * Eventuella kostnader för integrationerna ovan debiteras direkt av Fortnox eller Integrati.
      </p>

      <hr className="my-10 border-gray-200" />

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-gray-900">Kostnadsfri manuell export</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          Välj datumintervall för att ladda ner dina transaktioner. CSV-filen innehåller all nödvändig information om
          datum, tjänst, belopp och moms som din redovisningskonsult behöver.
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 sm:max-w-xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Från datum</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 sm:max-w-xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Till datum</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </label>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 sm:ml-0"
          >
            <Download className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Ladda ner CSV
          </button>
        </div>
      </section>
    </div>
  );
}
