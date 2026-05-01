import { useState, useEffect, useRef } from 'react';

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

export default function ActionsDropdown({ salon, onEdit, onImpersonate, onInactivate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const [stripeBusy, setStripeBusy] = useState(false);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleCopyLink() {
    const link = `https://${salon.subdomain || salon.slug}.appbok.se`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleOpenStripe() {
    setStripeBusy(true);
    try {
      const res = await fetch('/api/stripe/connect-dashboard', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
          'X-Impersonate-Salon-Id': salon.id,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte öppna Stripe.');
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
      setOpen(false);
    } catch (e) {
      alert(e.message || 'Kunde inte öppna Stripe.');
    } finally {
      setStripeBusy(false);
    }
  }

  return (
    <div className="sa-actions" ref={ref}>
      <button
        type="button"
        className="sa-actions-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label="Åtgärder"
        aria-expanded={open}
      >
        <MoreIcon />
      </button>

      {open && (
        <div className="sa-actions-menu" role="menu">
          {onEdit ? (
            <button
              type="button"
              className="sa-actions-item"
              role="menuitem"
              onClick={() => { onEdit(); setOpen(false); }}
            >
              <EditIcon />
              <span>Redigera</span>
            </button>
          ) : null}

          <button
            type="button"
            className="sa-actions-item"
            role="menuitem"
            onClick={() => { onImpersonate(); setOpen(false); }}
          >
            <UserIcon />
            <span>Logga in som salong</span>
          </button>

          <button
            type="button"
            className="sa-actions-item"
            role="menuitem"
            onClick={handleCopyLink}
          >
            <CopyIcon />
            <span>{copied ? 'Link kopierad!' : 'Kopiera demolänk'}</span>
          </button>

          <button
            type="button"
            className="sa-actions-item"
            role="menuitem"
            onClick={handleOpenStripe}
            disabled={stripeBusy}
          >
            <ExternalLinkIcon />
            <span>{stripeBusy ? 'Öppnar Stripe…' : 'Öppna i Stripe'}</span>
          </button>

          <div className="sa-actions-divider" role="separator" />

          {onInactivate ? (
            <button
              type="button"
              className="sa-actions-item sa-actions-item--danger"
              role="menuitem"
              onClick={() => { onInactivate(); setOpen(false); }}
            >
              <BanIcon />
              <span>Inaktivera salong</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
