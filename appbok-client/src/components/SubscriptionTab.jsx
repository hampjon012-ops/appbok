import { useState, useEffect, useCallback } from 'react';
import { CreditCard, ExternalLink, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { adminApiHeaders as authHeaders } from '../lib/adminApiHeaders.js';

const MONTHLY_PRICE = '2 000';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function brandLabel(brand) {
  const map = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'Amex',
    discover: 'Discover',
  };
  return map[brand?.toLowerCase()] || brand || 'Kort';
}

export default function SubscriptionTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subData, setSubData] = useState(null);
  const [actionBusy, setActionBusy] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/subscription/status', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte hämta status.');
      setSubData(data);
    } catch (err) {
      setError(err.message || 'Fel vid hämtning av prenumerationsstatus.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Check for success/canceled URL params from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      setActionMsg('✓ Prenumerationen har startats!');
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('subscription');
      window.history.replaceState({}, '', url.toString());
      // Reload status to get fresh data
      setTimeout(() => loadStatus(), 1500);
    }
    if (params.get('subscription') === 'canceled') {
      setActionMsg('Checkout avbröts.');
      const url = new URL(window.location.href);
      url.searchParams.delete('subscription');
      window.history.replaceState({}, '', url.toString());
    }
  }, [loadStatus]);

  const handleSetup = async () => {
    setActionBusy('setup');
    setActionMsg('');
    try {
      const res = await fetch('/api/stripe/subscription/setup', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta prenumeration.');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setActionMsg(err.message);
      setActionBusy('');
    }
  };

  const handlePortal = async () => {
    setActionBusy('portal');
    setActionMsg('');
    try {
      const res = await fetch('/api/stripe/subscription/portal', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte öppna kundportalen.');
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      setActionMsg(err.message);
    } finally {
      setActionBusy('');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Är du säker på att du vill avbryta prenumerationen? Den förblir aktiv till slutet av nuvarande period.')) {
      return;
    }
    setActionBusy('cancel');
    setActionMsg('');
    try {
      const res = await fetch('/api/stripe/subscription/cancel', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte avbryta prenumeration.');
      setActionMsg('✓ Prenumerationen avbryts vid periodens slut.');
      await loadStatus();
    } catch (err) {
      setActionMsg(err.message);
    } finally {
      setActionBusy('');
    }
  };

  if (loading) {
    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h1 className="admin-section-title">Prenumeration</h1>
        </div>
        <div className="admin-loading">
          <Loader2 className="spinner" size={22} /> Laddar…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h1 className="admin-section-title">Prenumeration</h1>
        </div>
        <div className="admin-card">
          <p className="save-error">{error}</p>
          <button type="button" className="btn-appbok-save" onClick={loadStatus} style={{ marginTop: '1rem' }}>
            Försök igen
          </button>
        </div>
      </div>
    );
  }

  const isActive = subData?.active;
  const isCanceling = subData?.cancelAtPeriodEnd;
  const hasSubscription = isActive || isCanceling;

  return (
    <div className="admin-section subscription-section">
      <div className="admin-section-header">
        <h1 className="admin-section-title">Prenumeration</h1>
      </div>

      <div className="admin-card subscription-card">
        {/* Status header */}
        <div className="subscription-status-header">
          <div className="subscription-status-icon-wrap">
            {hasSubscription ? (
              isCanceling ? (
                <AlertTriangle size={24} className="subscription-icon subscription-icon--warn" />
              ) : (
                <CheckCircle2 size={24} className="subscription-icon subscription-icon--ok" />
              )
            ) : (
              <XCircle size={24} className="subscription-icon subscription-icon--none" />
            )}
          </div>
          <div className="subscription-status-text">
            <h3 className="subscription-status-title">
              {hasSubscription
                ? isCanceling
                  ? 'Prenumeration avbryts'
                  : 'Aktiv prenumeration'
                : 'Ingen prenumeration'}
            </h3>
            <p className="subscription-status-desc">
              {hasSubscription
                ? isCanceling
                  ? `Aktiv till ${formatDate(subData.currentPeriodEnd)}. Därefter avslutas den.`
                  : `Nästa debitering: ${formatDate(subData.currentPeriodEnd)}`
                : 'Starta din prenumeration för att aktivera alla funktioner.'}
            </p>
          </div>
        </div>

        {/* Plan details */}
        <div className="subscription-plan-box">
          <div className="subscription-plan-row">
            <span className="subscription-plan-label">Plan</span>
            <span className="subscription-plan-value">Appbok Standard</span>
          </div>
          <div className="subscription-plan-row">
            <span className="subscription-plan-label">Pris</span>
            <span className="subscription-plan-value">{MONTHLY_PRICE} kr/mån</span>
          </div>
          {hasSubscription && subData.currentPeriodStart && (
            <div className="subscription-plan-row">
              <span className="subscription-plan-label">Aktiv sedan</span>
              <span className="subscription-plan-value">{formatDate(subData.currentPeriodStart)}</span>
            </div>
          )}
        </div>

        {/* Card info */}
        {hasSubscription && subData.card && (
          <div className="subscription-card-info">
            <CreditCard size={20} className="subscription-card-info-icon" />
            <span className="subscription-card-info-text">
              {brandLabel(subData.card.brand)} •••• {subData.card.last4}
            </span>
            <span className="subscription-card-info-exp">
              {String(subData.card.expMonth).padStart(2, '0')}/{subData.card.expYear}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="subscription-actions">
          {!hasSubscription && (
            <button
              type="button"
              className="btn-appbok-save subscription-btn-primary"
              disabled={!!actionBusy}
              onClick={handleSetup}
            >
              {actionBusy === 'setup' ? (
                <>
                  <Loader2 className="spinner" size={16} /> Startar…
                </>
              ) : (
                <>
                  <CreditCard size={16} /> Börja prenumeration
                </>
              )}
            </button>
          )}

          {hasSubscription && !isCanceling && (
            <>
              <button
                type="button"
                className="btn-appbok-save subscription-btn-secondary"
                disabled={!!actionBusy}
                onClick={handlePortal}
              >
                {actionBusy === 'portal' ? (
                  <>
                    <Loader2 className="spinner" size={16} /> Öppnar…
                  </>
                ) : (
                  <>
                    <ExternalLink size={16} /> Hantera betalkort
                  </>
                )}
              </button>
              <button
                type="button"
                className="subscription-btn-cancel"
                disabled={!!actionBusy}
                onClick={handleCancel}
              >
                {actionBusy === 'cancel' ? 'Avbryter…' : 'Avbryt prenumeration'}
              </button>
            </>
          )}

          {isCanceling && (
            <p className="subscription-canceling-notice">
              <AlertTriangle size={16} />
              Prenumerationen avslutas {formatDate(subData.currentPeriodEnd)}. Du har tillgång till alla funktioner tills dess.
            </p>
          )}
        </div>

        {/* Feedback message */}
        {actionMsg && (
          <p className={actionMsg.startsWith('✓') ? 'save-success' : 'save-error'} style={{ marginTop: '1rem' }}>
            {actionMsg}
          </p>
        )}
      </div>
    </div>
  );
}
