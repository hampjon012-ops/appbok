import SidebarRoleBadge from './SidebarRoleBadge.jsx';

function CrownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
      <path d="M3 20h18"/>
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/>
    </svg>
  );
}

function CogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function LayoutDashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

const MENU_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',    Icon: LayoutDashboardIcon },
  { id: 'superadmin',  label: 'Salonger',     Icon: CrownIcon          },
  { id: 'billing',     label: 'Fakturering',  Icon: CreditCardIcon     },
  { id: 'settings',    label: 'Inställningar', Icon: CogIcon           },
];

export default function SuperadminSidebar({ activeTab, onTabChange, user, onLogout, className = '' }) {
  return (
    <aside className={`sa-sidebar${className ? ` ${className}` : ''}`}>
      <div className="sa-sidebar-scroll">
        <div className="sa-sidebar-header sa-sidebar-header--logo">
          <img
            src="/sidebar-logo.png"
            alt="Appbok"
            className="sidebar-brand-img"
            decoding="async"
          />
        </div>

        <nav className="sa-nav">
          {MENU_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`sa-nav-btn${activeTab === id ? ' sa-nav-btn--active' : ''}`}
              onClick={() => onTabChange(id)}
            >
              <span className="sa-nav-icon">
                <Icon />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sa-sidebar-footer">
        <div className="sa-user-info">
          <div className="sa-user-name-row">
            <span className="sa-user-name">{user?.name || 'Superadmin'}</span>
            <SidebarRoleBadge role={user?.role} />
          </div>
          <span className="sa-user-email">{user?.email}</span>
        </div>
        <button type="button" className="sa-logout-btn" onClick={onLogout}>
          <LogoutIcon />
          <span>Logga ut</span>
        </button>
      </div>
    </aside>
  );
}
