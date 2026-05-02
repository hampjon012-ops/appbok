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

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg className={open ? 'sa-actions-chevron sa-actions-chevron--open' : 'sa-actions-chevron'} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
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

function staffInitial(name) {
  return String(name || 'S').trim().charAt(0).toUpperCase() || 'S';
}

export default function ActionsDropdown({ salon, onEdit, onImpersonate, onImpersonateStaff, onInactivate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffList, setStaffList] = useState(null);

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

  async function toggleStaffPicker() {
    const nextOpen = !staffOpen;
    setStaffOpen(nextOpen);
    if (!nextOpen || staffList || staffLoading) return;

    setStaffLoading(true);
    setStaffError('');
    try {
      const res = await fetch(`/api/superadmin/salons/${salon.id}/staff`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
        },
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data.error || 'Kunde inte hämta stylister.');
      setStaffList((Array.isArray(data) ? data : []).filter((u) => u.role === 'staff' && u.active !== false));
    } catch (e) {
      setStaffError(e.message || 'Kunde inte hämta stylister.');
      setStaffList([]);
    } finally {
      setStaffLoading(false);
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

          {onImpersonateStaff ? (
            <>
              <button
                type="button"
                className="sa-actions-item"
                role="menuitem"
                onClick={toggleStaffPicker}
                aria-expanded={staffOpen}
              >
                <UsersIcon />
                <span>Logga in som stylist</span>
                <ChevronIcon open={staffOpen} />
              </button>

              {staffOpen ? (
                <div className="sa-staff-picker">
                  {staffLoading ? (
                    <div className="sa-staff-picker-state">Hämtar stylister…</div>
                  ) : staffError ? (
                    <div className="sa-staff-picker-state sa-staff-picker-state--error">{staffError}</div>
                  ) : staffList?.length ? (
                    staffList.map((staff) => (
                      <button
                        key={staff.id}
                        type="button"
                        className="sa-staff-picker-item"
                        onClick={() => {
                          onImpersonateStaff(staff);
                          setOpen(false);
                        }}
                      >
                        <span className="sa-staff-picker-avatar">{staffInitial(staff.name)}</span>
                        <span className="sa-staff-picker-copy">
                          <span className="sa-staff-picker-name">{staff.name || 'Namnlös stylist'}</span>
                          <span className="sa-staff-picker-meta">{staff.title || staff.email || 'Stylist'}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="sa-staff-picker-state">Inga stylister finns i salongen.</div>
                  )}
                </div>
              ) : null}
            </>
          ) : null}

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
