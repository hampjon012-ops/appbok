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

function InactivateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

export default function ActionsDropdown({ salon, onEdit, onImpersonate, onCopyLink }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isInactive, setIsInactive] = useState(
    () =>
      salon.status === 'paused' ||
      salon.status === 'suspended' ||
      salon.status === 'inactive',
  );

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

  async function handleToggleInactive() {
    const msg = isInactive
      ? `Aktivera salongen "${salon.name}"?`
      : `Inaktivera salongen "${salon.name}"? Kunder kan inte boka medan salongen är inaktiverad.`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await fetch(`/api/superadmin/salons/${salon.id}/billing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
        },
        body: JSON.stringify({ status: isInactive ? 'active' : 'inactive' }),
      });
      setIsInactive((v) => !v);
    } catch { /* ignore */ }
    finally {
      setBusy(false);
      setOpen(false);
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

          <div className="sa-actions-divider" role="separator" />

          <button
            type="button"
            className="sa-actions-item sa-actions-item--danger"
            role="menuitem"
            onClick={handleToggleInactive}
            disabled={busy}
          >
            <InactivateIcon />
            <span>
              {busy ? 'Uppdaterar…' : isInactive ? 'Aktivera salong' : 'Inaktivera salong'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
