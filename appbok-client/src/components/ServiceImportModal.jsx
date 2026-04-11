import { useState } from 'react';
import { parseServices, flattenServices } from '../lib/parseServices.js';
import { adminApiHeaders as authHeaders } from '../lib/adminApiHeaders.js';

const PLACEHOLDER_TEXT = `Klistra in din tjänstelista här, till exempel från Bokadirekt.

Exempel format:
Klippning 350 kr
Färg 800 kr
Styling 500 kr
Barnklippning 200 kr

Koppling eller färg
  Balayage 1200 kr
  Slingor 950 kr
  Folk 350 kr`;

function CategoryRow({ category }) {
  return (
    <div className="import-preview-category">
      <div className="import-preview-cat-name">{category.name}</div>
      {category.services.map((svc, i) => (
        <div key={i} className="import-preview-service">
          <span className="import-preview-service-name">{svc.name}</span>
          {svc.price_amount > 0 && (
            <span className="import-preview-service-price">
              {(svc.price_amount / 100).toLocaleString('sv-SE')} kr
            </span>
          )}
          {svc.duration_minutes && svc.duration_minutes !== 60 && (
            <span className="import-preview-service-duration">{svc.duration_minutes} min</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ServiceImportModal({ salonId, onClose, onImported }) {
  const [mode, setMode] = useState('paste'); // 'paste' | 'url'
  const [rawText, setRawText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [parsed, setParsed] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [importError, setImportError] = useState('');

  function handleParse() {
    const result = parseServices(rawText);
    setParsed(result.categories);
    setErrors(result.errors);
  }

  async function handleFetch() {
    if (!urlInput.trim()) return;
    setFetching(true);
    setFetchError('');
    setParsed(null);

    try {
      const res = await fetch(
        `/api/scrape/bokadirekt?url=${encodeURIComponent(urlInput.trim())}`,
        { headers: authHeaders() }
      );
      const raw = await res.text();
      let data = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            'API svarade inte med JSON. Kontrollera att backend är omstartad (npm run dev) och försök igen.'
          );
        }
      }

      if (!res.ok) {
        throw new Error(data.error || `Kunde inte hämta (${res.status})`);
      }

      // Scrape-resultat har categories + services (från prepareForImport)
      if (data.categories && Array.isArray(data.categories)) {
        setParsed(data.categories);
        setErrors(data.errors || []);
      } else {
        throw new Error('Inga tjänster hittades från den URL:en.');
      }
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setFetching(false);
    }
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return;
    setLoading(true);
    setImportError('');

    try {
      const flat = flattenServices(parsed);
      const res = await fetch(`/api/superadmin/salons/${salonId}/import-services`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ services: flat }),
      });

      const raw = await res.text();
      let data = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error('Import-API svarade med ogiltig data. Försök igen om en stund.');
        }
      }

      if (!res.ok) {
        throw new Error(data.error || 'Import misslyckades.');
      }

      onImported?.(data);
      onClose();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalServices = parsed?.reduce((sum, cat) => sum + cat.services.length, 0) ?? 0;

  return (
    <div className="sa-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sa-modal" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
        {/* Header */}
        <div className="sa-modal-header">
          <h2 className="sa-modal-title" id="import-modal-title">Importera tjänster</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Stäng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="import-tabs">
          <button
            type="button"
            className={`import-tab ${mode === 'paste' ? 'import-tab--active' : ''}`}
            onClick={() => { setMode('paste'); setParsed(null); setErrors([]); setFetchError(''); }}
          >
            Klistra in
          </button>
          <button
            type="button"
            className={`import-tab ${mode === 'url' ? 'import-tab--active' : ''}`}
            onClick={() => { setMode('url'); setParsed(null); setErrors([]); setFetchError(''); }}
          >
            Ange Bokadirekt-URL
          </button>
        </div>

        {/* Body */}
        <div className="sa-modal-body">
          {mode === 'paste' && (
            <>
              <p className="import-instructions">
                Klistra in din tjänstelista. Varje rad blir en tjänst med pris. Indenterade rader blir undertjänster under föregående kategori.
              </p>

              <textarea
                className="import-textarea"
                value={rawText}
                onChange={(e) => { setRawText(e.target.value); setParsed(null); }}
                placeholder={PLACEHOLDER_TEXT}
                rows={10}
                spellCheck={false}
              />

              <button
                type="button"
                className="import-parse-btn"
                onClick={handleParse}
                disabled={!rawText.trim()}
              >
                Förhandsvisa
              </button>
            </>
          )}

          {mode === 'url' && (
            <>
              <p className="import-instructions">
                Ange en publik Bokadirekt-URL så hämtar vi tjänsterna automatiskt.
              </p>

              <div className="import-url-row">
                <input
                  type="url"
                  className="import-url-input"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setParsed(null); setFetchError(''); }}
                  placeholder="https://www.bokadirekt.se/places/salongen-12345"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="import-fetch-btn"
                  onClick={handleFetch}
                  disabled={!urlInput.trim() || fetching}
                >
                  {fetching ? 'Hämtar…' : 'Hämta'}
                </button>
              </div>

              {fetchError && (
                <div className="import-errors">
                  <p className="import-error">{fetchError}</p>
                </div>
              )}
            </>
          )}

          {/* Parse / fetch errors */}
          {errors.length > 0 && (
            <div className="import-errors">
              {errors.map((e, i) => (
                <p key={i} className="import-error">{e}</p>
              ))}
            </div>
          )}

          {/* Preview */}
          {parsed && parsed.length > 0 && (
            <div className="import-preview">
              <div className="import-preview-header">
                <span className="import-preview-title">Förhandsvisning</span>
                <span className="import-preview-count">
                  {totalServices} tjänster i {parsed.length} {parsed.length === 1 ? 'kategori' : 'kategorier'}
                </span>
              </div>
              {parsed.map((cat, i) => (
                <CategoryRow key={i} category={cat} />
              ))}
            </div>
          )}

          {parsed && parsed.length === 0 && !errors.length && (
            <p className="import-empty">Inga tjänster hittades.</p>
          )}

          {importError && (
            <p className="import-error">{importError}</p>
          )}
        </div>

        {/* Footer */}
        {parsed && parsed.length > 0 && (
          <div className="sa-modal-footer">
            <button type="button" className="sa-btn sa-btn--secondary" onClick={onClose}>
              Avbryt
            </button>
            <button
              type="button"
              className="sa-btn sa-btn--primary"
              onClick={handleImport}
              disabled={loading}
            >
              {loading ? 'Importerar…' : `Importera ${totalServices} tjänster`}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .import-tabs {
          display: flex;
          border-bottom: 2px solid #f3f4f6;
          padding: 0 1.5rem;
          gap: 0;
        }
        .import-tab {
          padding: 0.6rem 1rem;
          background: none;
          border: none;
          font-size: 0.9rem;
          font-weight: 500;
          color: #9ca3af;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: color 0.15s, border-color 0.15s;
        }
        .import-tab:hover { color: #374151; }
        .import-tab--active {
          color: #A89483;
          border-bottom-color: #A89483;
          font-weight: 600;
        }
        .import-instructions {
          font-size: 0.9rem;
          color: #6b7280;
          margin: 0 0 0.75rem;
          line-height: 1.5;
        }
        .import-textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 0.75rem;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          resize: vertical;
          background: #fafafa;
          color: #111827;
          outline: none;
          transition: border-color 0.15s;
        }
        .import-textarea:focus { border-color: #A89483; background: #fff; }
        .import-url-row {
          display: flex;
          gap: 0.5rem;
          align-items: stretch;
        }
        .import-url-input {
          flex: 1;
          padding: 0.6rem 0.85rem;
          font-size: 0.875rem;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          background: #fafafa;
          color: #111827;
          outline: none;
          transition: border-color 0.15s;
        }
        .import-url-input:focus { border-color: #A89483; background: #fff; }
        .import-url-input::placeholder { color: #9ca3af; }
        .import-parse-btn, .import-fetch-btn {
          padding: 0.5rem 1.25rem;
          background: #A89483;
          border: none;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          white-space: nowrap;
          transition: filter 0.15s, opacity 0.15s;
        }
        .import-parse-btn { background: #f3f4f6; color: #374151; }
        .import-parse-btn:hover:not(:disabled) { background: #e5e7eb; }
        .import-fetch-btn:hover:not(:disabled) { filter: brightness(0.88); }
        .import-parse-btn:disabled, .import-fetch-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .import-preview {
          margin-top: 1.25rem;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }
        .import-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 1rem;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }
        .import-preview-title { font-size: 0.85rem; font-weight: 600; color: #374151; }
        .import-preview-count { font-size: 0.8rem; color: #9ca3af; }
        .import-preview-category { border-bottom: 1px solid #f3f4f6; }
        .import-preview-category:last-child { border-bottom: none; }
        .import-preview-cat-name {
          padding: 0.5rem 1rem 0.25rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: #A89483;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .import-preview-service {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.35rem 1rem;
        }
        .import-preview-service + .import-preview-service { border-top: 1px solid #f9fafb; }
        .import-preview-service-name { flex: 1; font-size: 0.9rem; color: #111827; }
        .import-preview-service-price { font-size: 0.875rem; font-weight: 600; color: #374151; white-space: nowrap; }
        .import-preview-service-duration { font-size: 0.8rem; color: #9ca3af; white-space: nowrap; }
        .import-errors {
          margin-top: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
        }
        .import-error { margin: 0; font-size: 0.85rem; color: #dc2626; }
        .import-empty { margin-top: 1rem; font-size: 0.9rem; color: #9ca3af; text-align: center; }
        .sa-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.55rem 1.25rem;
          border-radius: 9px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: filter 0.15s, opacity 0.15s;
        }
        .sa-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sa-btn--primary { background: #A89483; color: #fff; }
        .sa-btn--primary:hover:not(:disabled) { filter: brightness(0.88); }
        .sa-btn--secondary { background: #f3f4f6; color: #374151; }
        .sa-btn--secondary:hover:not(:disabled) { background: #e5e7eb; }
      `}</style>
    </div>
  );
}
