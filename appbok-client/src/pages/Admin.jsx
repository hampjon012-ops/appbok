import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  MessageSquare,
  X,
  CalendarCheck,
  BarChart3,
  Wallet,
  Users,
  Sparkles,
  User,
  Pencil,
  Trash2,
  GripVertical,
  Plus,
  CalendarOff,
  Shield,
  Download,
  ChevronDown,
  ListChecks,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SuperadminSidebar from '../components/SuperadminSidebar.jsx';
import SuperadminTab from './SuperadminTab.jsx';
import SuperadminSettingsTab from '../components/SuperadminSettingsTab.jsx';
import SalonAdminSettingsTab from '../components/SalonAdminSettingsTab.jsx';
import StaffEditSlideOver from '../components/StaffEditSlideOver.jsx';
import ScheduleTab from '../components/ScheduleTab.jsx';
import ServiceImportModal from '../components/ServiceImportModal.jsx';
import SidebarRoleBadge from '../components/SidebarRoleBadge.jsx';
import { adminApiHeaders as authHeaders, getSalonIdForPublicApi } from '../lib/adminApiHeaders.js';
import { notifySalonConfigUpdated } from '../lib/salonPublicConfig.js';
import {
  replaceWithAdminLogin,
  applyBootstrapAuthFromHash,
  getSalonPublicBookingPreviewUrl,
  copyTextToClipboard,
} from '../lib/adminUrls.js';

// ── Sidebar SVG Icons (same style as SuperadminSidebar) ─────────────────────
function SidebarDashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function SidebarBookingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function SidebarStaffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function SidebarServicesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

function SidebarScheduleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function SidebarSettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function SidebarLogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

// ── Auth helper ──────────────────────────────────────────────────────────────
function getAuth() {
  const token = localStorage.getItem('sb_token');
  const user = JSON.parse(localStorage.getItem('sb_user') || 'null');
  const salon = JSON.parse(localStorage.getItem('sb_salon') || 'null');

  if (user?.role === 'superadmin') {
    const impRaw = localStorage.getItem('sb_superadmin_impersonate');
    if (impRaw) {
      try {
        const impersonating = JSON.parse(impRaw);
        if (impersonating && typeof impersonating === 'object') {
          // Stylist-vy: { id, name, email, role: 'staff', salonId }
          if (impersonating.role === 'staff' && impersonating.salonId) {
            const salonFromStorage = JSON.parse(localStorage.getItem('sb_salon') || 'null');
            const fallbackSalon = {
              id: impersonating.salonId,
              name: impersonating.salonName || salon?.name || 'Salong',
              slug: impersonating.salonSlug || salon?.slug || '',
            };
            return {
              token,
              user: {
                ...user,
                role: 'staff',
                originalRole: 'superadmin',
                impersonatedName: impersonating.name || 'Stylist',
                impersonatedEmail: impersonating.email || '',
                impersonatedStaffId: impersonating.id,
              },
              salon:
                salonFromStorage && String(salonFromStorage.id) === String(impersonating.salonId)
                  ? salonFromStorage
                  : fallbackSalon,
            };
          }
          // Salong som admin (befintligt objekt med salongs-id som id)
          return {
            token,
            user: { ...user, role: 'admin', originalRole: 'superadmin' },
            salon: impersonating,
          };
        }
      } catch (e) {
        /* ignore */
      }
    }
  }

  return { token, user, salon };
}

function fmtKr(öre) {
  const n = typeof öre === 'number' && !Number.isNaN(öre) ? öre : 0;
  return `${(n / 100).toLocaleString('sv-SE')} kr`;
}

/** True om minst en i personalen har sparat arbetsschema (work_schedule i DB). */
function staffHasSavedSchedule(staffList) {
  if (!Array.isArray(staffList)) return false;
  return staffList.some((u) => {
    const ws = u?.work_schedule;
    if (ws == null || typeof ws !== 'object') return false;
    const days = ws.days;
    if (!Array.isArray(days)) return false;
    return days.some((d) => d && d.enabled);
  });
}

const CHART_AXIS_TICK = { fontSize: 12, fill: '#737373' };
const CHART_AXIS_LINE = { stroke: '#d4d4d4' };

function formatUpcomingBookingWhen(bookingDate, bookingTime) {
  const timeStr = (bookingTime || '').slice(0, 5) || '—';
  if (!bookingDate) return { timeStr, dateStr: '' };
  const parts = bookingDate.split('-').map(Number);
  if (parts.length < 3 || parts.some((x) => !Number.isFinite(x))) {
    return { timeStr, dateStr: bookingDate };
  }
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  const dateStr = dt.toLocaleDateString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return { timeStr, dateStr };
}

function upcomingBookingStatusMeta(status) {
  const s = status || 'confirmed';
  if (s === 'confirmed') return { label: 'Bekräftad', variant: 'confirmed' };
  if (s === 'completed') return { label: 'Genomförd', variant: 'completed' };
  if (s === 'cancelled') return { label: 'Avbokad', variant: 'cancelled' };
  return { label: String(s), variant: 'muted' };
}

function DashboardChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const p = row?.payload;
  const value = row?.value;
  const formatted = typeof value === 'number' ? fmtKr(value) : value;
  let labelLine = label;
  if (p?.monthLabel != null && p?.month) {
    labelLine = `${p.monthLabel} ${String(p.month).slice(0, 4)}`;
  } else if (p?.monthLabel != null) {
    labelLine = p.monthLabel;
  }
  return (
    <div className="dashboard-chart-tooltip">
      {labelLine != null && String(labelLine).length > 0 && (
        <div className="dashboard-chart-tooltip-label">{labelLine}</div>
      )}
      <div className="dashboard-chart-tooltip-value">{formatted}</div>
    </div>
  );
}

const DASHBOARD_MONTH_LABELS_SV = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Maj',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dec',
];

/** 12 staplar: innevarande kalenderår (Stockholm), månader utan data → 0. */
function buildDashboardRevenueChartData(apiMonthly) {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });
  const year = ymd.slice(0, 4);
  const map = new Map();
  (apiMonthly || []).forEach((row) => {
    if (row?.month && String(row.month).startsWith(year)) {
      map.set(row.month, typeof row.revenue === 'number' ? row.revenue : 0);
    }
  });
  return DASHBOARD_MONTH_LABELS_SV.map((monthLabel, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    return {
      month,
      monthLabel,
      revenue: map.get(month) ?? 0,
    };
  });
}

function DashboardBellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function DashboardChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const DASHBOARD_PERIOD_OPTIONS = [
  { id: 'today', label: 'Idag' },
  { id: 'week', label: 'Denna vecka' },
  { id: 'month', label: 'Denna månad' },
  { id: 'year', label: 'I år' },
];

// ── Admin Layout ─────────────────────────────────────────────────────────────
function ImpersonationBanner({ salonName, staffName }) {
  const staffMode = staffName != null && String(staffName).length > 0;
  return (
    <div
      className="admin-impersonation-banner"
      style={{
        background: '#f97316',
        color: 'white',
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        fontWeight: 'bold',
        zIndex: 9999,
      }}
    >
      <span>
        {staffMode
          ? `Du tittar på ${staffName}s vy · `
          : `Du är inloggad som ${salonName} · `}
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('sb_superadmin_impersonate');
            window.location.reload();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            padding: 0,
            cursor: 'pointer',
            fontWeight: 'bold',
            textDecoration: 'underline',
          }}
        >
          ← Tillbaka till superadmin
        </button>
      </span>
    </div>
  );
}

export default function Admin() {
  const location = useLocation();
  const navigate = useNavigate();
  applyBootstrapAuthFromHash();
  const { token, user, salon } = getAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0);
  /** Bumpar så getAuth() + sidomeny (schema-påminnelse) läser om efter onboarding / DB-uppdatering. */
  const [salonStorageBump, setSalonStorageBump] = useState(0);
  /** Reaktiv salon som uppdateras när localStorage ändras (t.ex. efter sparade öppettider). */
  const [salonState, setSalonState] = useState(() => getAuth().salon);

  /** När salonStorageBump ökar (efter SALON_CONFIG_UPDATED), läs om från localStorage. */
  useEffect(() => {
    setSalonState(getAuth().salon);
  }, [salonStorageBump]);
  /** null = laddar; true = minst en har sparat schema; false = inget schema */
  const [scheduleConfiguredForReminder, setScheduleConfiguredForReminder] = useState(null);
  const isStaffImpersonation = user?.originalRole === 'superadmin' && user?.role === 'staff';
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const impRaw = localStorage.getItem('sb_superadmin_impersonate');
      if (impRaw) {
        const imp = JSON.parse(impRaw);
        if (imp?.role === 'staff' && imp?.salonId) return 'bookings';
      }
    } catch {
      /* ignore */
    }
    const u = JSON.parse(localStorage.getItem('sb_user') || 'null');
    return u?.role === 'superadmin' ? 'superadmin' : 'dashboard';
  });

  useEffect(() => {
    if (!token) {
      replaceWithAdminLogin();
      return;
    }
    document.title = `Admin — ${salon?.name || 'Appbok'}`;
  }, [token, salon]);

  useEffect(() => {
    const p = location.pathname || '';
    if (p === '/admin/dashboard' || p.endsWith('/admin/dashboard')) {
      setActiveTab('dashboard');
    }
    if (
      p === '/admin/schema' ||
      p.endsWith('/admin/schema') ||
      p === '/admin/schedule' ||
      p.endsWith('/admin/schedule')
    ) {
      setActiveTab('schedule');
    }
    if (
      p === '/admin/tjanster' ||
      p.endsWith('/admin/tjanster') ||
      p === '/admin/services' ||
      p.endsWith('/admin/services')
    ) {
      setActiveTab('services');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!token) return;
    try {
      if (sessionStorage.getItem('sb_onboarding_bokadirekt_toast') === '1') {
        sessionStorage.removeItem('sb_onboarding_bokadirekt_toast');
        toast.success('✨ Magiskt! Vi hittade och importerade dina tjänster från Bokadirekt.');
        setServicesRefreshKey((k) => k + 1);
        window.dispatchEvent(new CustomEvent('appbok-services-updated'));
      }
    } catch {
      /* ignore */
    }
  }, [token]);

  const emailVerifyToastShownRef = useRef(false);
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(location.search);
    const verified = params.get('verified');
    const verifyErr = params.get('verify_error');

    if (verified === 'true') {
      if (!emailVerifyToastShownRef.current) {
        emailVerifyToastShownRef.current = true;
        toast.success('✨ Din e-postadress är nu verifierad! Ditt konto är fullt aktiverat.');
        fetch('/api/salons', { headers: authHeaders(), cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            try {
              localStorage.setItem('sb_salon', JSON.stringify(data));
              notifySalonConfigUpdated();
              setSalonStorageBump((b) => b + 1);
            } catch {
              /* ignore */
            }
          })
          .catch(() => {});
      }
      params.delete('verified');
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}${location.hash || ''}`, { replace: true });
      return;
    }

    if (verifyErr) {
      if (!emailVerifyToastShownRef.current) {
        emailVerifyToastShownRef.current = true;
        if (verifyErr === 'invalid' || verifyErr === 'missing') {
          toast.error('Denna verifieringslänk är ogiltig eller har redan använts.');
        } else {
          toast.error('E-postverifieringen misslyckades. Försök igen eller kontakta support.');
        }
      }
      params.delete('verify_error');
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}${location.hash || ''}`, { replace: true });
      return;
    }

    emailVerifyToastShownRef.current = false;
  }, [token, location.search, location.pathname, location.hash, navigate]);

  /** Lyssa på SALON_CONFIG_UPDATED så att Dashboard uppdateras när öppettider / andra inställningar sparas. */
  useEffect(() => {
    const handler = () => setSalonStorageBump((b) => b + 1);
    window.addEventListener('appbok:salon-config-updated', handler);
    return () => window.removeEventListener('appbok:salon-config-updated', handler);
  }, []);

  const loadScheduleConfiguredForReminder = useCallback(() => {
    if (!token || isSuperAdmin || user?.role !== 'admin') {
      setScheduleConfiguredForReminder(null);
      return;
    }
    const sid = getSalonIdForPublicApi();
    if (!sid) {
      setScheduleConfiguredForReminder(null);
      return;
    }
    fetch(`/api/staff?salon_id=${encodeURIComponent(sid)}`, { headers: authHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
      .then((staff) => setScheduleConfiguredForReminder(staffHasSavedSchedule(staff)))
      .catch(() => setScheduleConfiguredForReminder(false));
  }, [token, isSuperAdmin, user?.role]);

  useEffect(() => {
    loadScheduleConfiguredForReminder();
  }, [loadScheduleConfiguredForReminder, activeTab, salonStorageBump, servicesRefreshKey]);

  useEffect(() => {
    if (!token || isSuperAdmin || user?.role !== 'admin') return undefined;
    const h = () => loadScheduleConfiguredForReminder();
    window.addEventListener('appbok-staff-schedule-saved', h);
    return () => window.removeEventListener('appbok-staff-schedule-saved', h);
  }, [token, isSuperAdmin, user?.role, loadScheduleConfiguredForReminder]);

  /** Synka salong från API (t.ex. hide_onboarding_widget) vid inladdning. */
  useEffect(() => {
    if (!token || isSuperAdmin || user?.role !== 'admin') return undefined;
    let cancelled = false;
    fetch('/api/salons', { headers: authHeaders(), cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        try {
          localStorage.setItem('sb_salon', JSON.stringify(data));
          notifySalonConfigUpdated();
          setSalonStorageBump((b) => b + 1);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, isSuperAdmin, user?.role]);

  const handleLogout = () => {
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
    localStorage.removeItem('sb_salon');
    localStorage.removeItem('sb_superadmin_impersonate');
    replaceWithAdminLogin();
  };

  const tabs = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { id: 'dashboard',  label: 'Dashboard',     Icon: SidebarDashboardIcon, roles: ['superadmin'] },
        { id: 'superadmin',  label: 'Salonger',      Icon: SidebarStaffIcon,     roles: ['superadmin'] },
        { id: 'billing',     label: 'Fakturering',   Icon: SidebarBookingsIcon,  roles: ['superadmin'] },
        { id: 'settings',    label: 'Inställningar', Icon: SidebarSettingsIcon,  roles: ['superadmin'] },
      ];
    }
    if (isStaffImpersonation) {
      // Samma flikar som inloggad personal (ej begränsad vy)
      return [
        { id: 'bookings', label: 'Bokningar',     Icon: SidebarBookingsIcon,  roles: ['staff'] },
        { id: 'schedule', label: 'Schema',         Icon: SidebarScheduleIcon,  roles: ['staff'] },
        { id: 'settings', label: 'Inställningar',  Icon: SidebarSettingsIcon,  roles: ['staff'] },
      ];
    }
    return [
      { id: 'dashboard', label: 'Dashboard',     Icon: SidebarDashboardIcon, roles: ['admin'] },
      { id: 'bookings',  label: 'Bokningar',     Icon: SidebarBookingsIcon,  roles: ['admin', 'staff'] },
      { id: 'staff',     label: 'Personal',      Icon: SidebarStaffIcon,     roles: ['admin'] },
      { id: 'services',  label: 'Tjänster',      Icon: SidebarServicesIcon,  roles: ['admin'] },
      { id: 'schedule',  label: 'Schema',        Icon: SidebarScheduleIcon,  roles: ['admin', 'staff'] },
      { id: 'gdpr',      label: 'GDPR',          Icon: Shield,               roles: ['admin'] },
      { id: 'settings',  label: 'Inställningar', Icon: SidebarSettingsIcon,  roles: ['admin', 'staff'] },
    ].filter((t) => t.roles.includes(user?.role || 'admin'));
  }, [isSuperAdmin, isStaffImpersonation, user?.role]);

  const saTabs = ['dashboard', 'superadmin', 'billing', 'settings'];

  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const canOpenBookingsModal = useMemo(() => tabs.some((t) => t.id === 'bookings'), [tabs]);

  const showScheduleReminder =
    !isSuperAdmin &&
    user?.role === 'admin' &&
    salon?.hide_onboarding_widget === true &&
    scheduleConfiguredForReminder === false;

  useEffect(() => {
    if (activeTab !== 'bookings') setNewBookingOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (isSuperAdmin) {
      setActiveTab((cur) => (saTabs.includes(cur) ? cur : 'dashboard'));
      return;
    }
    setActiveTab((cur) => (tabs.some((t) => t.id === cur) ? cur : tabs[0]?.id || 'dashboard'));
  }, [isSuperAdmin, isStaffImpersonation, user?.role, tabs]);

  if (!token) return null;

  return (
    <div className="admin-page-root">
      <Toaster position="top-center" toastOptions={{ duration: 5500 }} />
      {user?.originalRole === 'superadmin' && (
        <ImpersonationBanner
          salonName={salon?.name || 'Salong'}
          staffName={isStaffImpersonation ? user?.impersonatedName : null}
        />
      )}
      <div className="admin-layout">
        {/* Sidebar — always superadmin variant */}
      {isSuperAdmin ? (
        <SuperadminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          user={user}
          onLogout={handleLogout}
        />
      ) : (
        <aside className="admin-sidebar">
          <div className="admin-sidebar-scroll">
            <div className="admin-sidebar-header admin-sidebar-header--logo">
              <img
                src="/sidebar-logo.png"
                alt="Appbok"
                className="sidebar-brand-img"
                decoding="async"
              />
            </div>
            <nav className="admin-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`admin-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="admin-nav-icon">
                    <tab.Icon />
                  </span>
                  <span className="admin-nav-btn-label">
                    {tab.label}
                    {tab.id === 'schedule' && showScheduleReminder ? (
                      <span
                        className="admin-nav-schedule-warning"
                        title="Ställ in arbetsschema så kunder kan boka."
                        aria-label="Påminnelse: ställ in schema"
                      >
                        <AlertTriangle
                          size={15}
                          strokeWidth={2.25}
                          className="admin-nav-schedule-warning-icon"
                          aria-hidden
                        />
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          <div className="admin-sidebar-footer">
            <div className="admin-user-info">
              <div className="admin-user-name-row">
                <span className="admin-user-name">
                  {isStaffImpersonation && user?.impersonatedName ? user.impersonatedName : user?.name}
                </span>
                <SidebarRoleBadge role={user?.role} />
              </div>
              <span className="admin-user-email">
                {isStaffImpersonation && user?.impersonatedEmail
                  ? user.impersonatedEmail
                  : user?.email}
              </span>
            </div>
            <button type="button" className="admin-logout-btn" onClick={handleLogout}>
              <SidebarLogoutIcon />
              <span>Logga ut</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main */}
      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <DashboardTab
            servicesRefreshKey={servicesRefreshKey}
            showNewBookingButton={canOpenBookingsModal}
            showSalonLifecycleBanner={!isSuperAdmin && user?.role === 'admin'}
            showOnboardingWidget={!isSuperAdmin && user?.role === 'admin'}
            salonHideOnboardingWidget={Boolean(salon?.hide_onboarding_widget)}
            openingHoursConfigured={Boolean(salonState?.opening_hours_configured)}
            onOnboardingDismissed={(data) => {
              try {
                localStorage.setItem('sb_salon', JSON.stringify(data));
              } catch {
                /* ignore */
              }
              notifySalonConfigUpdated();
              setSalonStorageBump((b) => b + 1);
            }}
            onGoToSalonPaymentsSettings={() => {
              try {
                sessionStorage.setItem('salonAdminInitialTab', 'payments');
              } catch (_) {
                /* ignore */
              }
              setActiveTab('settings');
            }}
            onNewBooking={() => {
              setActiveTab('bookings');
              setNewBookingOpen(true);
            }}
            onNavigateToSchedule={() => {
              setActiveTab('schedule');
              navigate('/admin/schema');
            }}
            onNavigateToHours={() => {
              try { sessionStorage.setItem('salonAdminInitialTab', 'hours'); } catch (_) { /* ignore */ }
              setActiveTab('settings');
            }}
            onNavigateToServices={() => {
              setActiveTab('services');
              navigate('/admin/tjanster');
            }}
          />
        )}
        {activeTab === 'bookings' && (
          <BookingsTab newBookingOpen={newBookingOpen} setNewBookingOpen={setNewBookingOpen} />
        )}
        {activeTab === 'staff'      && <StaffTab salonId={salon?.id} />}
        {activeTab === 'services'  && <ServicesTab />}
        {activeTab === 'schedule'  && <ScheduleTab user={user} />}
        {activeTab === 'settings' && (
          isSuperAdmin ? (
            <SuperadminSettingsTab user={user} />
          ) : user?.role === 'admin' ? (
            <SalonAdminSettingsTab
              onSalonUpdate={(updated) => {
                setSalonState((prev) => ({ ...(prev || {}), ...(updated || {}) }));
              }}
              onOpeningHoursSaved={() => {
                // Uppdatera salonState direkt med rätt värde så att DashboardTab uppdateras
                setSalonState((prev) => ({ ...(prev || {}), opening_hours_configured: true }));
                setActiveTab('dashboard');
              }}
            />
          ) : (
            <StaffSettingsTab />
          )
        )}
        {activeTab === 'superadmin' && <SuperadminTab />}
        {activeTab === 'billing'    && <BillingTab user={user} />}
        {activeTab === 'gdpr'       && <GdprTab user={user} />}
      </main>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────
function DashboardTab({
  onNewBooking,
  showNewBookingButton,
  showSalonLifecycleBanner,
  onGoToSalonPaymentsSettings,
  servicesRefreshKey = 0,
  showOnboardingWidget = false,
  salonHideOnboardingWidget = false,
  onOnboardingDismissed,
  onNavigateToSchedule,
  onNavigateToHours,
  onNavigateToServices,
  openingHoursConfigured = false,
}) {
  const [stats, setStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [topStylists, setTopStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [lifecycleSalon, setLifecycleSalon] = useState(null);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialMsg, setTrialMsg] = useState('');
  const [goLiveBusy, setGoLiveBusy] = useState(false);
  const [goLiveMsg, setGoLiveMsg] = useState('');
  const [previewLinkCopied, setPreviewLinkCopied] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadNotificationsCount] = useState(0);

  const [servicePreview, setServicePreview] = useState({
    loading: true,
    categories: [],
    error: '',
  });
  const [scheduleConfigured, setScheduleConfigured] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showOnboardingCard, setShowOnboardingCard] = useState(() => !salonHideOnboardingWidget);
  const [onboardingLeaving, setOnboardingLeaving] = useState(false);

  const bellAnchorRef = useRef(null);
  const dateAnchorRef = useRef(null);

  const selectedPeriodLabel = useMemo(
    () => DASHBOARD_PERIOD_OPTIONS.find((o) => o.id === selectedPeriod)?.label ?? 'Denna månad',
    [selectedPeriod]
  );

  const revenueChartData = useMemo(() => buildDashboardRevenueChartData(monthlyStats), [monthlyStats]);
  const revenueChartYear = revenueChartData[0]?.month?.slice(0, 4) || '';

  useEffect(() => {
    if (!isDateMenuOpen && !isNotificationOpen) return undefined;
    const onPointerDown = (e) => {
      const el = e.target;
      if (bellAnchorRef.current?.contains(el)) return;
      if (dateAnchorRef.current?.contains(el)) return;
      setIsDateMenuOpen(false);
      setIsNotificationOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isDateMenuOpen, isNotificationOpen]);

  useEffect(() => {
    if (!isDateMenuOpen && !isNotificationOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsDateMenuOpen(false);
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isDateMenuOpen, isNotificationOpen]);

  useEffect(() => {
    if (!showSalonLifecycleBanner) return;
    fetch('/api/salons', { headers: authHeaders(), cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 403 && data?.code === 'SALON_DELETED') {
          setLifecycleSalon(null);
          return;
        }
        if (data && !Array.isArray(data)) setLifecycleSalon(data);
      })
      .catch(() => setLifecycleSalon(null));
  }, [showSalonLifecycleBanner]);

  useEffect(() => {
    const parse = async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Fel ${r.status}`);
      return j;
    };
    Promise.all([
      fetch('/api/stats/overview', { headers: authHeaders() }).then(parse),
      fetch('/api/stats/monthly', { headers: authHeaders() }).then(parse),
      fetch('/api/stats/top-stylists', { headers: authHeaders() }).then(parse),
    ])
    .then(([overview, monthly, stylists]) => {
      setStats(overview);
      setMonthlyStats(Array.isArray(monthly) ? monthly : []);
      setTopStylists(Array.isArray(stylists) ? stylists : []);
      setStatsError('');
      setLoading(false);
    })
    .catch((e) => {
      setStats(null);
      setStatsError(e?.message || 'Kunde inte hämta statistik.');
      setLoading(false);
    });
  }, []);

  const loadOnboardingDashboardData = useCallback(() => {
    const sid = getSalonIdForPublicApi();
    if (!sid) {
      setServicePreview({ loading: false, categories: [], error: '' });
      setScheduleConfigured(false);
      return;
    }
    setServicePreview((prev) => ({ ...prev, loading: true, error: '' }));
    Promise.all([
      fetch(`/api/services?salon_id=${encodeURIComponent(sid)}`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      fetch(`/api/staff?salon_id=${encodeURIComponent(sid)}`, { headers: authHeaders() }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
    ])
      .then(([cats, staff]) => {
        setServicePreview({
          loading: false,
          categories: Array.isArray(cats) ? cats : [],
          error: '',
        });
        setScheduleConfigured(staffHasSavedSchedule(staff));
      })
      .catch(() => {
        setServicePreview({ loading: false, categories: [], error: 'Kunde inte ladda tjänster och schema.' });
        setScheduleConfigured(false);
      });
  }, []);

  useEffect(() => {
    loadOnboardingDashboardData();
  }, [loadOnboardingDashboardData, servicesRefreshKey]);

  useEffect(() => {
    setShowOnboardingCard(!salonHideOnboardingWidget);
  }, [salonHideOnboardingWidget]);

  const handleDismissOnboarding = useCallback(async () => {
    setOnboardingLeaving(true);
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ hide_onboarding_widget: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      await new Promise((r) => setTimeout(r, 280));
      onOnboardingDismissed?.(data);
      setShowOnboardingCard(false);
    } catch (e) {
      setOnboardingLeaving(false);
      toast.error(e?.message || 'Kunde inte spara.');
    }
  }, [onOnboardingDismissed]);

  const dashboardServiceCount = useMemo(() => {
    const cats = servicePreview.categories || [];
    return cats.reduce((n, c) => n + (Array.isArray(c.services) ? c.services.length : 0), 0);
  }, [servicePreview.categories]);

  if (loading) return <div className="admin-loading">Laddar...</div>;
  if (statsError) return <div className="admin-empty">{statsError}</div>;
  if (!stats) return <div className="admin-empty">Kunde inte hämta statistik.</div>;

  const ls = lifecycleSalon;
  const isDraftSalon = ls?.status === 'draft';
  const isDemoSalon = ls?.status === 'demo';
  const isActiveSalon = ls?.status === 'active';
  const isTrialSalon = ls?.status === 'trial';
  const isLiveSalon = ls?.status === 'live';
  const isExpiredSalon = ls?.status === 'expired';
  const isPreTrialSalon = isDraftSalon || isDemoSalon || isActiveSalon;
  const knownLifecycle = isPreTrialSalon || isTrialSalon || isLiveSalon || isExpiredSalon;
  const stripeConnected = Boolean(
    ls?.stripe_account_id ||
      (ls?.contact && typeof ls.contact === 'object' && ls.contact.stripe_connected),
  );
  const previewBookingUrl = ls ? getSalonPublicBookingPreviewUrl(ls) : '';
  const openingHoursFromLifecycle = Boolean(
    ls?.opening_hours_configured ||
      (ls?.contact &&
        typeof ls.contact === 'object' &&
        Array.isArray(ls.contact.opening_hours_week) &&
        ls.contact.opening_hours_week.length > 0),
  );
  const openingHoursSavedFlag = (() => {
    try {
      return sessionStorage.getItem('appbok_opening_hours_saved') === '1';
    } catch {
      return false;
    }
  })();

  const step1Done = dashboardServiceCount > 0;
  const step2Done =
    scheduleConfigured ||
    (typeof openingHoursConfigured === 'boolean' ? openingHoursConfigured : false) ||
    openingHoursFromLifecycle ||
    openingHoursSavedFlag;
  const step3Done = stripeConnected;
  const completedSteps = [step1Done, step2Done, step3Done].filter(Boolean).length;
  const progressPct = Math.round((completedSteps / 3) * 100);
  const lifecycleLabel = isDraftSalon
    ? 'Utkast'
    : isDemoSalon
      ? 'Demo'
      : isActiveSalon
        ? 'Förhandsvisning'
        : isTrialSalon
          ? 'Trial'
          : isLiveSalon
            ? 'Live'
            : isExpiredSalon
              ? 'Utgången'
              : (ls?.status || 'Okänd');

  const handleGoLive = async () => {
    if (
      !confirm(
        'Gå live nu? Din bokningssida blir synlig för alla och Stripe-betalningar aktiveras.',
      )
    ) {
      return;
    }
    setGoLiveBusy(true);
    setGoLiveMsg('');
    try {
      const res = await fetch('/api/salons/current/go-live', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte gå live.');
      setLifecycleSalon(data);
      try {
        localStorage.setItem('sb_salon', JSON.stringify(data));
      } catch (_) {
        /* ignore */
      }
      notifySalonConfigUpdated();
      setGoLiveMsg('✓ Grattis! Er sajt är nu live.');
    } catch (err) {
      setGoLiveMsg(`✗ ${err.message}`);
    } finally {
      setGoLiveBusy(false);
    }
  };

  const handleCopyPreviewLink = async () => {
    if (!previewBookingUrl) return;
    const ok = await copyTextToClipboard(previewBookingUrl);
    setPreviewLinkCopied(ok);
    window.setTimeout(() => setPreviewLinkCopied(false), 2500);
  };

  const handleDashboardStartTrial = async () => {
    if (
      !confirm(
        'Publicera din bokningssida och starta 14 dagars provperiod? Efter 14 dagar behöver du ha ett aktivt Stripe-konto.',
      )
    ) {
      return;
    }
    setTrialBusy(true);
    setTrialMsg('');
    try {
      const res = await fetch('/api/salons/current/trial', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta trial.');
      setLifecycleSalon(data);
      try {
        localStorage.setItem('sb_salon', JSON.stringify(data));
      } catch (_) {
        /* ignore */
      }
      notifySalonConfigUpdated();
      setTrialMsg('✓ Grattis! Din bokningssida är nu live.');
    } catch (err) {
      setTrialMsg(`✗ ${err.message}`);
    } finally {
      setTrialBusy(false);
    }
  };

  return (
    <div className="admin-section dashboard-section">
      {/* ── ONBOARDING-CHECKLIST – pre-trial ── */}
      {showSalonLifecycleBanner && ls && isPreTrialSalon && (
        <div style={{
          marginBottom: '1.25rem',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
          width: '100%',
          overflow: 'hidden',
        }}>
          {/* ── Clickable header ── */}
          <button
            type="button"
            className="dashboard-onboarding-toggle-btn"
            onClick={() => setIsOpen((o) => !o)}
            aria-expanded={isOpen}
          >
            {/* Top row: icon + title + status badge (left) + progress + chevron (right) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              {/* Left: icon + title + lifecycle badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                <ListChecks size={18} color="#2563eb" aria-hidden style={{ flexShrink: 0 }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                  Kom igång med din salong
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#1e3a8a',
                  background: '#dbeafe',
                  border: '1px solid #93c5fd',
                  borderRadius: '999px',
                  padding: '0.15rem 0.5rem',
                  flexShrink: 0,
                }}>
                  {lifecycleLabel}
                </span>
              </div>

              {/* Right: progress bar + X/3 + chevron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                {completedSteps === 3 ? (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#16a34a',
                    background: '#DCFCE7',
                    border: '1px solid #86EFAC',
                    borderRadius: '999px',
                    padding: '0.15rem 0.55rem',
                  }}>
                    ✓ Klart!
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
                      {completedSteps}/3
                    </span>
                    <div style={{ width: '96px', height: '5px', background: '#F3F4F6', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${progressPct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #1E3A5F, #3b82f6)',
                        borderRadius: '999px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )}
                <ChevronDown
                  size={18}
                  color="#9CA3AF"
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    transition: 'transform 0.25s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </div>
            </div>

            {/* Caption: shown when OPEN only */}
            {isOpen && (
              <div style={{ paddingLeft: '2.2rem' }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#9CA3AF' }}>
                  {completedSteps === 3
                    ? 'Alla steg klara — din salong är redo att publiceras!'
                    : 'Fyll i stegen för att låsa upp publicering'}
                </p>
              </div>
            )}
          </button>

          {/* ── Expanded content ── */}
          <div style={{
            padding: isOpen ? '0 1.5rem 1.25rem' : '0 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: isOpen ? 'fadeSlideDown 0.2s ease' : 'none',
          }}>
            {/* Progress bar — shown when open */}
            {isOpen && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                      Slutför alla steg nedan för att publicera din bokningssida.
                    </p>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', letterSpacing: '0.02em' }}>
                      {progressPct}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#F3F4F6', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${progressPct}%`,
                      height: '100%',
                      background: completedSteps === 3
                        ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                        : 'linear-gradient(90deg, #1E3A5F, #3b82f6)',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>

                {/* ── Steg-lista ── */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Steg 1: Tjänster */}
                  {[
                    {
                      done: step1Done,
                      label: 'Skapa din första tjänst',
                      actionLabel: 'Gå till Tjänster',
                      action: typeof onNavigateToServices === 'function' ? onNavigateToServices : null,
                    },
                    {
                      done: step2Done,
                      label: 'Ställ in dina öppettider',
                      actionLabel: 'Gå till Öppettider',
                      action: typeof onNavigateToHours === 'function' ? onNavigateToHours : null,
                    },
                    {
                      done: stripeConnected,
                      label: 'Koppla betalningar (Stripe)',
                      actionLabel: 'Koppla Stripe',
                      action: typeof onGoToSalonPaymentsSettings === 'function' ? onGoToSalonPaymentsSettings : null,
                    },
                  ].map((step, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.6rem 0',
                      borderTop: idx > 0 ? '1px solid #F3F4F6' : 'none',
                    }}>
                      {/* Ikon: grå cirkel eller grön check */}
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: step.done ? '#DCFCE7' : '#F3F4F6',
                        border: step.done ? '1.5px solid #86EFAC' : '1.5px solid #D1D5DB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {step.done ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9CA3AF', display: 'block' }} />
                        )}
                      </div>

                      {/* Label */}
                      <span style={{
                        flex: 1,
                        fontSize: '0.88rem',
                        fontWeight: step.done ? 500 : 400,
                        color: step.done ? '#374151' : '#6B7280',
                      }}>
                        {step.label}
                      </span>

                      {/* Aktionsknapp / klar */}
                      {step.done ? (
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#16a34a',
                          background: '#DCFCE7',
                          border: '1px solid #86EFAC',
                          borderRadius: '6px',
                          padding: '0.2rem 0.6rem',
                        }}>
                          Klart
                        </span>
                      ) : step.action ? (
                        <button
                          type="button"
                          onClick={step.action}
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#1E3A5F',
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            borderRadius: '7px',
                            padding: '0.3rem 0.75rem',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF'; }}
                        >
                          {step.actionLabel}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* ── Divider + Go Live ── */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {trialMsg && (
                    <p style={{
                      margin: 0,
                      fontSize: '0.8rem',
                      color: trialMsg.startsWith('✓') ? '#16a34a' : '#dc2626',
                      fontWeight: 500,
                    }}>
                      {trialMsg}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={trialBusy || completedSteps < 3}
                    onClick={handleDashboardStartTrial}
                    title={completedSteps < 3 ? 'Slutför alla steg först för att kunna publicera.' : 'Publicera och starta 14 dagars provperiod'}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      cursor: completedSteps < 3 ? 'not-allowed' : 'pointer',
                      opacity: completedSteps < 3 ? 0.45 : 1,
                      background: completedSteps < 3 ? '#F3F4F6' : '#171717',
                      color: completedSteps < 3 ? '#9CA3AF' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'background 0.15s, opacity 0.15s',
                      letterSpacing: '0.01em',
                    }}
                    onMouseEnter={e => { if (completedSteps >= 3) e.currentTarget.style.background = '#2d2d2d'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#171717'; }}
                  >
                    {trialBusy ? (
                      <>Startar…</>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        Publicera bokningssidan &amp; Starta gratis provperiod
                      </>
                    )}
                  </button>
                  {completedSteps < 3 && (
                    <p style={{ margin: 0, textAlign: 'center', fontSize: '0.72rem', color: '#9CA3AF' }}>
                      Slutför alla steg ovan för att låsa upp
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TRIAL-BANNER ── */}
      {showSalonLifecycleBanner && ls && isTrialSalon && (
        <div style={{
          marginBottom: '1.25rem',
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.6rem', flexShrink: 1, minWidth: 0 }}>
            <span style={{
              background: '#FEF9C3',
              color: '#92400E',
              fontWeight: 700,
              fontSize: '0.7rem',
              letterSpacing: '0.05em',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              border: '1px solid #FDE68A',
              flexShrink: 0,
            }}>TRIAL</span>
            <span style={{ fontSize: '0.8rem', color: '#4B5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ls.trial_ends_at
                ? (() => {
                    const left = Math.ceil(
                      (new Date(ls.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24),
                    );
                    return left > 0
                      ? `${left} dagar kvar av din testperiod — din bokningssida är aktiv.`
                      : 'Testperioden har gått ut.';
                  })()
                : 'Din testperiod är aktiv.'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            <button
              type="button"
              disabled={goLiveBusy}
              onClick={handleGoLive}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                padding: '0.4rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: goLiveBusy ? 0.6 : 1,
              }}
            >
              {goLiveBusy ? 'Startar...' : 'Gå Live'}
            </button>
          </div>
          {goLiveMsg && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: goLiveMsg.startsWith('✓') ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
              {goLiveMsg}
            </p>
          )}
        </div>
      )}

      {/* ── EXPIRED TRIAL BANNER ── */}
      {showSalonLifecycleBanner && ls && isExpiredSalon && (
        <div style={{
          marginBottom: '1.25rem',
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          border: '1px solid #fdba74',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          width: '100%',
        }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.15rem', lineHeight: 1.2, flexShrink: 0 }} aria-hidden>⚠️</span>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#9a3412', fontWeight: 600, lineHeight: 1.45 }}>
              Din testperiod är avslutad. För att fortsätta ta emot bokningar, gå live med Stripe.
            </p>
          </div>
          {ls.allow_pay_on_site !== false && !stripeConnected ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#57534e', lineHeight: 1.45 }}>
              Betalning på plats är aktiverat, men för att ta betalt online behöver du koppla Stripe.
            </p>
          ) : null}
          <div>
            <button
              type="button"
              disabled={goLiveBusy}
              onClick={handleGoLive}
              style={{
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.65rem 1.35rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: goLiveBusy ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(234, 88, 12, 0.35)',
                minWidth: 'min(100%, 220px)',
              }}
            >
              {goLiveBusy ? 'Startar...' : 'Gå live med Stripe'}
            </button>
          </div>
          {goLiveMsg && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: goLiveMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>
              {goLiveMsg}
            </p>
          )}
        </div>
      )}

      {/* ── LIVE-BANNER ── */}
      {showSalonLifecycleBanner && ls && isLiveSalon && (
        <div style={{
          marginBottom: '1.25rem',
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0.6rem',
        }}>
          <span style={{
            background: '#DCFCE7',
            color: '#166534',
            fontWeight: 700,
            fontSize: '0.7rem',
            letterSpacing: '0.05em',
            padding: '0.2rem 0.55rem',
            borderRadius: '9999px',
            border: '1px solid #86EFAC',
            flexShrink: 0,
          }}>LIVE</span>
          <span style={{ fontSize: '0.8rem', color: '#4B5563' }}>
            💳 <strong style={{ fontWeight: 600 }}>Du är live</strong>
            {' — '}kunder kan boka och betala direkt.
          </span>
        </div>
      )}

      {/* ── UNKNOWN STATUS BANNER ── */}
      {showSalonLifecycleBanner && ls && !knownLifecycle && (
        <div style={{
          marginBottom: '1.25rem',
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0.6rem',
        }}>
          <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>
            Salongstatus: <strong>{ls.status || '—'}</strong> — Vid problem, kontakta support.
          </span>
        </div>
      )}
      <div className="dashboard-action-bar">
        <h1 className="dashboard-overview-title">Översikt</h1>
        <div className="dashboard-action-tools">
          <div className="dashboard-popover-anchor" ref={bellAnchorRef}>
            <button
              type="button"
              className="dashboard-bell-btn"
              aria-label={
                unreadNotificationsCount > 0
                  ? `Notiser, ${unreadNotificationsCount} olästa`
                  : 'Notiser'
              }
              aria-expanded={isNotificationOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setIsNotificationOpen((v) => !v);
                setIsDateMenuOpen(false);
              }}
            >
              <DashboardBellIcon />
              {unreadNotificationsCount > 0 ? (
                <span className="dashboard-bell-dot" aria-hidden />
              ) : null}
            </button>
            {isNotificationOpen ? (
              <div
                className="dashboard-dropdown-panel dashboard-dropdown-panel--notifications"
                role="dialog"
                aria-label="Notiser"
              >
                <div className="dashboard-dropdown-panel-title">Notiser</div>
                <p className="dashboard-dropdown-panel-placeholder">Du har inga nya notiser just nu.</p>
              </div>
            ) : null}
          </div>
          <div className="dashboard-popover-anchor" ref={dateAnchorRef}>
            <button
              type="button"
              className="dashboard-date-filter-btn"
              aria-expanded={isDateMenuOpen}
              aria-haspopup="listbox"
              onClick={() => {
                setIsDateMenuOpen((v) => !v);
                setIsNotificationOpen(false);
              }}
            >
              {selectedPeriodLabel}
              <DashboardChevronDownIcon />
            </button>
            {isDateMenuOpen ? (
              <ul className="dashboard-dropdown-panel dashboard-dropdown-menu" role="listbox">
                {DASHBOARD_PERIOD_OPTIONS.map((opt) => (
                  <li key={opt.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className="dashboard-dropdown-menu-item"
                      aria-selected={selectedPeriod === opt.id}
                      onClick={() => {
                        setSelectedPeriod(opt.id);
                        setIsDateMenuOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {showNewBookingButton ? (
            <button type="button" className="dashboard-new-booking-btn" onClick={onNewBooking}>
              + Ny bokning
            </button>
          ) : null}
        </div>
      </div>

      <div className="stats-cards dashboard-kpi-grid">
        <div className="stat-card dashboard-kpi-card">
          <span className="stat-icon stat-icon--blue">
            <CalendarCheck size={22} strokeWidth={1.8} />
          </span>
          <div className="stat-info">
            <span className="stat-value">{stats.todayBookings}</span>
            <span className="stat-label">Bokningar idag</span>
          </div>
        </div>
        <div className="stat-card dashboard-kpi-card">
          <span className="stat-icon stat-icon--purple">
            <BarChart3 size={22} strokeWidth={1.8} />
          </span>
          <div className="stat-info">
            <span className="stat-value">{stats.monthBookings}</span>
            <span className="stat-label">Denna månad</span>
          </div>
        </div>
        <div className="stat-card dashboard-kpi-card">
          <span className="stat-icon stat-icon--green">
            <Wallet size={22} strokeWidth={1.8} />
          </span>
          <div className="stat-info">
            <span className="stat-value">{fmtKr(stats.monthRevenue)}</span>
            <span className="stat-label">Omsättning (månad)</span>
          </div>
        </div>
        <div className="stat-card dashboard-kpi-card">
          <span className="stat-icon stat-icon--amber">
            <Users size={22} strokeWidth={1.8} />
          </span>
          <div className="stat-info">
            <span className="stat-value">{stats.staffCount}</span>
            <span className="stat-label">Aktiv personal</span>
          </div>
        </div>
      </div>

      {servicePreview.error ? (
        <p className="dashboard-services-preview-error" style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#b45309' }}>
          {servicePreview.error}
        </p>
      ) : null}

      {showOnboardingWidget && showOnboardingCard && !isPreTrialSalon && servicePreview.loading ? (
        <div className="admin-card" style={{ marginTop: '1.25rem', fontSize: '0.9rem', color: '#6b7280' }}>
          Laddar kom igång…
        </div>
      ) : null}

      {showOnboardingWidget &&
      showOnboardingCard &&
      !isPreTrialSalon &&
      !servicePreview.loading &&
      !(dashboardServiceCount > 0 && scheduleConfigured) ? (
        <div
          className={`dashboard-onboarding-widget-shell${onboardingLeaving ? ' dashboard-onboarding-widget-shell--leave' : ''}`}
        >
          <div
            className="admin-card dashboard-onboarding-widget"
            style={{
              marginTop: 0,
              padding: '1.35rem 1.5rem',
              paddingRight: '2.75rem',
              position: 'relative',
              background:
                'linear-gradient(135deg, rgba(250, 245, 240, 0.95) 0%, #ffffff 55%, rgba(255, 255, 255, 1) 100%)',
              border: '1px solid #e7e5e4',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.04)',
              borderRadius: '14px',
            }}
          >
            <button
              type="button"
              className="dashboard-onboarding-dismiss"
              onClick={handleDismissOnboarding}
              aria-label="Stäng kom igång"
              disabled={onboardingLeaving}
            >
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
            {dashboardServiceCount === 0 ? (
              <>
                <h3 className="dashboard-upcoming-title" style={{ margin: '0 0 1rem' }}>
                  Nästa steg: Lägg till dina tjänster för att kunna ta emot bokningar.
                </h3>
                {onNavigateToServices ? (
                  <button
                    type="button"
                    className="dashboard-onboarding-primary-btn"
                    onClick={onNavigateToServices}
                  >
                    Lägg till tjänster
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <h3 className="dashboard-upcoming-title" style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={18} strokeWidth={2} style={{ color: '#d97706', flexShrink: 0 }} aria-hidden />
                  Dina tjänster är redo!
                </h3>
                <p style={{ margin: '0 0 1.125rem', fontSize: '0.92rem', color: '#57534e', lineHeight: 1.55 }}>
                  Vi har importerat {dashboardServiceCount} tjänster åt dig. Ta gärna en titt och dubbelkolla priserna, eller
                  fortsätt med att ställa in ditt schema.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
                  {onNavigateToSchedule ? (
                    <button
                      type="button"
                      className="dashboard-onboarding-primary-btn"
                      onClick={onNavigateToSchedule}
                    >
                      Ställ in schema
                    </button>
                  ) : null}
                  {onNavigateToServices ? (
                    <button type="button" className="dashboard-onboarding-secondary-btn" onClick={onNavigateToServices}>
                      Granska tjänster
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Charts ───────────────────────────────────────────── */}
      <div className="charts-grid">
        <div className="admin-card chart-card dashboard-chart-card">
          <h3>{revenueChartYear ? `Omsättning (${revenueChartYear})` : 'Omsättning'}</h3>
          <div className="dashboard-chart-wrap">
            <ResponsiveContainer width="100%" height={260} minWidth={240} minHeight={220}>
              <BarChart data={revenueChartData} margin={{ top: 10, right: 8, left: 4, bottom: 4 }} barCategoryGap="12%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#d4d4d4"
                  strokeWidth={1}
                />
                <XAxis
                  dataKey="monthLabel"
                  tick={CHART_AXIS_TICK}
                  tickLine={CHART_AXIS_LINE}
                  axisLine={CHART_AXIS_LINE}
                />
                <YAxis
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v / 100} kr`}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(23, 23, 23, 0.06)' }}
                  content={<DashboardChartTooltip />}
                />
                <Bar dataKey="revenue" fill="#171717" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card chart-card dashboard-chart-card">
          <h3>Toppstylister (Månad)</h3>
          <div className="dashboard-chart-wrap">
            {topStylists.length > 0 ? (
              <ResponsiveContainer width="100%" height={260} minWidth={240} minHeight={220}>
                <BarChart
                  data={topStylists}
                  layout="vertical"
                  margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    horizontal
                    stroke="#d4d4d4"
                    strokeWidth={1}
                  />
                  <XAxis
                    type="number"
                    tick={CHART_AXIS_TICK}
                    tickLine={false}
                    axisLine={CHART_AXIS_LINE}
                    tickFormatter={(v) => `${v / 100} kr`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={CHART_AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={88}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(23, 23, 23, 0.06)' }}
                    content={<DashboardChartTooltip />}
                  />
                  <Bar dataKey="revenue" fill="#171717" radius={[0, 4, 4, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="admin-empty dashboard-chart-empty" style={{ flexDirection: 'column', gap: '0.65rem' }}>
                <Users size={48} strokeWidth={1.5} color="#e5e7eb" aria-hidden />
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#6b7280', textAlign: 'center' }}>
                  Här kommer dina toppstylister att visas när bokningarna börjar rulla in.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {stats.upcomingBookings?.length > 0 ? (
        <div className="admin-card dashboard-upcoming-card">
          <h3 className="dashboard-upcoming-title">Kommande bokningar</h3>
          <div className="booking-list dashboard-upcoming-list">
            {stats.upcomingBookings.map((b) => {
              const { timeStr, dateStr } = formatUpcomingBookingWhen(b.booking_date, b.booking_time);
              const st = upcomingBookingStatusMeta(b.status);
              return (
                <div key={b.id} className="booking-row dashboard-upcoming-row">
                  <div className="booking-row-left">
                    <div className="booking-datetime">
                      <span className="booking-time">{timeStr}</span>
                      {dateStr ? <span className="booking-date-part">{dateStr}</span> : null}
                    </div>
                    <span className="booking-customer">{b.customer_name}</span>
                  </div>
                  <div className="booking-row-right">
                    <div className="booking-service-row">
                      <span className="booking-service">{b.services?.name}</span>
                      <span
                        className={`dashboard-status-badge dashboard-status-badge--${st.variant}`}
                        title={st.label}
                      >
                        <span className="dashboard-status-dot" aria-hidden />
                        <span className="dashboard-status-label">{st.label}</span>
                      </span>
                    </div>
                    <span className="booking-stylist">
                      {b.stylist?.name || 'Valfri'}
                      {b.salons?.name ? ` · ${b.salons.name}` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="admin-card dashboard-upcoming-card">
          <h3 className="dashboard-upcoming-title">Kommande bokningar</h3>
          <div
            style={{
              minHeight: '150px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem',
            }}
          >
            <CalendarOff size={48} strokeWidth={1.5} color="#e5e7eb" aria-hidden />
            <p style={{ margin: 0, fontSize: '0.86rem', color: '#6b7280', textAlign: 'center' }}>
              Här kommer dina kommande bokningar att visas när bokningarna börjar rulla in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab ────────────────────────────────────────────────────────────
// ─── New Booking Modal (multi-step) ───────────────────────────────────────────
function NewBookingModal({ onClose, onCreated }) {
  const salonId = getSalonIdForPublicApi();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [form, setForm] = useState({
    service_id: '',
    stylist_id: 'any',
    booking_date: '',
    booking_time: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState(null);
  const [busySlots, setBusySlots] = useState(new Set());
  const [busyLoading, setBusyLoading] = useState(false);

  const ALL_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

  useEffect(() => {
    Promise.all([
      fetch(`/api/services?salon_id=${salonId}`).then(r => r.json()),
      fetch(`/api/staff?salon_id=${salonId}`).then(r => r.json()),
    ]).then(([cats, staff]) => {
      setServices((cats || []).flatMap(c => c.services || []));
      setStylists(Array.isArray(staff) ? staff.filter(s => s.id !== 'any') : []);
    });
  }, [salonId]);

  useEffect(() => {
    if (!form.booking_date || !form.stylist_id) return;
    setBusyLoading(true);
    setBusySlots(new Set());
    const stylistId = form.stylist_id === 'any' ? '' : form.stylist_id;
    Promise.all([
      fetch(`/api/calendar/busy?stylist_id=${stylistId}&date=${form.booking_date}`).then(r => r.json()).catch(() => ({ busy: [] })),
      fetch(`/api/bookings/available?stylist_id=${stylistId || 'any'}&date=${form.booking_date}`).then(r => r.json()).catch(() => ({ booked: [] })),
    ]).then(([cal, book]) => {
      const blocked = new Set();
      (cal.busy || []).forEach(b => {
        const start = new Date(b.start);
        const end = new Date(b.end);
        const d = new Date(form.booking_date);
        ALL_SLOTS.forEach(slot => {
          const [h, m] = slot.split(':').map(Number);
          const t = new Date(d); t.setHours(h, m, 0, 0);
          if (t >= start && t < end) blocked.add(slot);
        });
      });
      (book.booked || []).forEach(t => blocked.add(t.slice(0, 5)));
      setBusySlots(blocked);
      setBusyLoading(false);
    });
  }, [form.booking_date, form.stylist_id]);

  const checkExistingCustomer = (email, phone) => {
    if (!email && !phone) return;
    fetch(`/api/customers?search=${encodeURIComponent(email || phone)}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const found = (data || []).find(c =>
          (email && c.email?.toLowerCase() === email.toLowerCase()) ||
          (phone && c.phone === phone)
        );
        setExistingCustomer(found || null);
      })
      .catch(() => setExistingCustomer(null));
  };

  const handleCustomerBlur = () => {
    checkExistingCustomer(form.customer_email, form.customer_phone);
  };

  const selectedService = services.find(s => s.id === form.service_id);

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          salon_id: salonId,
          service_id: form.service_id,
          stylist_id: form.stylist_id || 'any',
          customer_name: form.customer_name,
          customer_email: form.customer_email,
          customer_phone: form.customer_phone,
          booking_date: form.booking_date,
          booking_time: form.booking_time,
          duration_minutes: selectedService?.duration_minutes || 60,
          amount_paid: selectedService?.price_amount || 0,
          stripe_session_id: 'admin_manual_booking',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte skapa bokning.');
      onCreated(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = (s) => {
    if (s === 1) return form.service_id;
    if (s === 2) return form.stylist_id;
    if (s === 3) return form.booking_date && form.booking_time;
    if (s === 4) return form.customer_name.trim() && (form.customer_email.trim() || form.customer_phone.trim());
    return false;
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card booking-modal-card">
        <div className="booking-modal-header">
          <h3>Ny bokning</h3>
          <div className="booking-modal-stepper">
            {[1,2,3,4].map(s => (
              <div key={s} className={`booking-step-dot ${step === s ? 'active' : step > s ? 'done' : ''}`} />
            ))}
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="booking-modal-body">
          {error && <p className="api-error">{error}</p>}

          {/* Steg 1: Välj tjänst */}
          {step === 1 && (
            <div className="booking-step-content">
              <p className="booking-step-label">Vilken tjänst?</p>
              <div className="booking-choice-list">
                {services.map(s => (
                  <button
                    key={s.id}
                    className={`booking-choice-btn ${form.service_id === s.id ? 'selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, service_id: s.id }))}
                  >
                    <span className="bcb-name">{s.name}</span>
                    <span className="bcb-meta">{s.duration} · {(s.price_amount / 100).toLocaleString('sv-SE')} kr</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Steg 2: Välj stylist */}
          {step === 2 && (
            <div className="booking-step-content">
              <p className="booking-step-label">Vilken stylist?</p>
              <div className="booking-choice-list">
                <button
                  className={`booking-choice-btn ${form.stylist_id === 'any' ? 'selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, stylist_id: 'any' }))}
                >
                  <span className="bcb-name">Valfri stylist</span>
                  <span className="bcb-meta">Bästa tillgängliga tid</span>
                </button>
                {stylists.map(s => (
                  <button
                    key={s.id}
                    className={`booking-choice-btn ${form.stylist_id === s.id ? 'selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, stylist_id: s.id }))}
                  >
                    <span className="bcb-name">{s.name}</span>
                    <span className="bcb-meta">{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Steg 3: Datum & Tid */}
          {step === 3 && (
            <div className="booking-step-content">
              <p className="booking-step-label">Vilket datum och tid?</p>
              <input
                type="date"
                className="admin-input"
                value={form.booking_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setForm(f => ({ ...f, booking_date: e.target.value, booking_time: '' }))}
                style={{ marginBottom: '1rem' }}
              />
              {form.booking_date && (
                <div className="timeslots-grid">
                  {busyLoading ? (
                    <p className="admin-card-desc">Kontrollerar...</p>
                  ) : ALL_SLOTS.map(slot => (
                    <button
                      key={slot}
                      className={`timeslot ${busySlots.has(slot) ? 'booked' : ''} ${form.booking_time === slot ? 'selected' : ''}`}
                      disabled={busySlots.has(slot)}
                      onClick={() => !busySlots.has(slot) && setForm(f => ({ ...f, booking_time: slot }))}
                    >
                      {slot}
                      {busySlots.has(slot) && <span className="slot-booked-label">Upptagen</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Steg 4: Kunduppgifter */}
          {step === 4 && (
            <div className="booking-step-content">
              <p className="booking-step-label">Kunduppgifter</p>
              {existingCustomer && (
                <div className="existing-customer-notice">
                  <span>✓ Kund hittades: <strong>{existingCustomer.name}</strong></span>
                </div>
              )}
              <div className="form-group">
                <label>Namn</label>
                <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="För- och efternamn" />
              </div>
              <div className="form-group">
                <label>E-post</label>
                <input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} onBlur={handleCustomerBlur} placeholder="epost@exempel.se" />
              </div>
              <div className="form-group">
                <label>Telefon</label>
                <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} onBlur={handleCustomerBlur} placeholder="070-000 00 00" />
              </div>
            </div>
          )}
        </div>

        <div className="booking-modal-footer">
          {step > 1 && (
            <button className="btn-sm btn-ghost" onClick={() => setStep(s => s - 1)}>← Tillbaka</button>
          )}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button className="btn-admin-primary" disabled={!canProceed(step)} onClick={() => setStep(s => s + 1)}>
              Fortsätt →
            </button>
          ) : (
            <button className="btn-admin-primary" disabled={!canProceed(4) || saving} onClick={handleSubmit}>
              {saving ? 'Sparar...' : 'Bekräfta bokning'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function bookingNotesTrimmed(b) {
  if (b?.notes == null) return '';
  return String(b.notes).trim();
}

/** Radlista från booking_services (JSONB) eller en tjänst via join. */
function bookingServicesList(b) {
  let raw = b?.booking_services;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (Array.isArray(raw) && raw.length > 0) return raw;
  return null;
}

function bookingServicesTotalÖre(b) {
  const lines = bookingServicesList(b);
  if (lines?.length) {
    return lines.reduce((sum, row) => sum + (Number(row.price_amount) || 0), 0);
  }
  const pa = b?.services?.price_amount;
  return typeof pa === 'number' ? pa : 0;
}

function bookingServiceCellLabel(b) {
  const lines = bookingServicesList(b);
  if (lines?.length > 1) return `${lines.map((x) => x.name).join(' · ')}`;
  if (lines?.length === 1) return lines[0].name;
  return b?.services?.name || '—';
}

const BOOKING_LIST_MONTHS_SV = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** Visar t.ex. "28 apr" från ISO-datum (YYYY-MM-DD). */
function bookingListDateLabel(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return isoDate;
  const day = parseInt(m[3], 10);
  const monthIdx = parseInt(m[2], 10) - 1;
  if (!day || monthIdx < 0 || monthIdx > 11) return isoDate;
  return `${day} ${BOOKING_LIST_MONTHS_SV[monthIdx]}`;
}

function bookingListTimeLabel(time) {
  if (!time || typeof time !== 'string') return '';
  return time.slice(0, 5);
}

/** Första bokstaven i kundnamnet (avatar). */
function customerAvatarLetter(displayName) {
  const s = String(displayName || '').trim();
  if (!s) return '?';
  return s[0].toLocaleUpperCase('sv-SE');
}

/** Hover-tooltip med meddelandetext (portal så tabell-scroll inte klipper) */
function BookingNoteTooltip({ text, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchorRef = useRef(null);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top, left: r.left + r.width / 2 });
  }, []);

  useLayoutEffect(() => {
    if (!show) return;
    updatePos();
  }, [show, updatePos]);

  useEffect(() => {
    if (!show) return;
    const handler = () => updatePos();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [show, updatePos]);

  return (
    <>
      <span
        ref={anchorRef}
        className="booking-note-tooltip-anchor"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </span>
      {show && text
        ? createPortal(
            <div
              className="booking-note-tooltip-content"
              role="tooltip"
              style={{
                position: 'fixed',
                left: pos.left,
                top: pos.top,
                transform: 'translate(-50%, calc(-100% - 8px))',
              }}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// ─── BookingsTab ────────────────────────────────────────────────────────────
function BookingsTab({ newBookingOpen, setNewBookingOpen }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [detailBooking, setDetailBooking] = useState(null);

  const loadBookings = useCallback((searchTerm, dateFrom) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (dateFrom) params.set('date_from', dateFrom);
    const qs = params.toString();
    fetch(`/api/bookings${qs ? `?${qs}` : ''}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setBookings(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadBookings(search, dateFilter), 280);
    return () => clearTimeout(timer);
  }, [search, dateFilter, loadBookings]);

  useEffect(() => {
    if (!detailBooking) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDetailBooking(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailBooking]);

  const handleCancel = async (id) => {
    if (!confirm('Vill du avboka denna bokning?')) return;
    await fetch(`/api/bookings/${id}/cancel`, { method: 'PATCH', headers: authHeaders() });
    loadBookings(search, dateFilter);
  };

  const handleCreated = () => {
    setNewBookingOpen(false);
    loadBookings(search, dateFilter);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Bokningar</h2>
        <button type="button" className="btn-admin-primary" onClick={() => setNewBookingOpen(true)}>
          + Ny bokning
        </button>
      </div>

      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <div className="bookings-filter-row">
          <input
            className="invite-url-input"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem', flex: 2 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sök bokning (kundnamn, telefon, e-post)..."
          />
          <input
            type="date"
            className="admin-input"
            style={{ flex: 1, maxWidth: '180px' }}
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <button className="btn-sm btn-ghost" onClick={() => setDateFilter('')}>Rensa datum</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">Laddar bokningar...</div>
      ) : bookings.length === 0 ? (
        <div className="admin-empty">Inga bokningar hittades.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table bookings-table-modern">
            <thead>
              <tr>
                <th scope="col">Datum &amp; tid</th>
                <th scope="col">Kund</th>
                <th scope="col">Tjänst</th>
                <th scope="col">Stylist</th>
                <th scope="col">Status</th>
                <th scope="col" className="bookings-table-th-actions" aria-label="Åtgärder" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const rowNotes = bookingNotesTrimmed(b);
                const timeLine = bookingListTimeLabel(b.booking_time);
                return (
                <tr
                  key={b.id}
                  className={`bookings-table-row-clickable ${b.status === 'cancelled' ? 'row-cancelled' : ''}`}
                  onClick={() => setDetailBooking(b)}
                >
                  <td>
                    <div className="bookings-table-datetime-cell">
                      <div className="bookings-table-datetime-day">{bookingListDateLabel(b.booking_date)}</div>
                      <div className="bookings-table-datetime-time">{timeLine || '—'}</div>
                    </div>
                  </td>
                  <td className="booking-customer-td">
                    <div className="bookings-table-customer-row">
                      <div className="bookings-table-customer-avatar" aria-hidden>
                        {customerAvatarLetter(b.customer_name)}
                      </div>
                      <div className="bookings-table-customer-info">
                        <div className="bookings-table-customer-name-row">
                          <span className="bookings-table-customer-name">{b.customer_name}</span>
                          {rowNotes ? (
                            <BookingNoteTooltip text={rowNotes}>
                              <MessageSquare
                                className="booking-note-icon"
                                size={16}
                                strokeWidth={1.75}
                                aria-hidden
                              />
                            </BookingNoteTooltip>
                          ) : null}
                        </div>
                        <div className="bookings-table-customer-contact">
                          {b.customer_email || b.customer_phone || ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{bookingServiceCellLabel(b)}</td>
                  <td>{b.stylist?.name || 'Valfri'}</td>
                  <td>
                    <span className={`status-badge status-${b.status}`}>
                      {b.status === 'confirmed' ? 'Bekräftad' : b.status === 'rebooked' ? 'Ombokad' : b.status === 'cancelled' ? 'Avbokad' : b.status === 'completed' ? 'Genomförd' : b.status}
                    </span>
                  </td>
                  <td className="bookings-table-actions-cell">
                    {(b.status === 'confirmed' || b.status === 'rebooked') && (
                      <button
                        type="button"
                        className="bookings-table-cancel-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(b.id);
                        }}
                      >
                        Avboka
                      </button>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      {newBookingOpen && (
        <NewBookingModal
          onClose={() => setNewBookingOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {detailBooking ? (
        <aside
          className="bookings-detail-sheet"
          aria-labelledby="booking-detail-title"
          role="dialog"
          aria-modal="false"
        >
          <div className="bookings-detail-sheet-header">
            <h2 id="booking-detail-title" className="bookings-detail-sheet-title">
              Bokningsdetaljer
            </h2>
            <button
              type="button"
              className="bookings-detail-sheet-close"
              onClick={() => setDetailBooking(null)}
              aria-label="Stäng panel"
            >
              ×
            </button>
          </div>
          <div className="bookings-detail-sheet-body">
            <dl className="booking-detail-dl">
              <div>
                <dt>Datum & tid</dt>
                <dd>
                  {detailBooking.booking_date}{' '}
                  {detailBooking.booking_time ? detailBooking.booking_time.slice(0, 5) : ''}
                </dd>
              </div>
              <div>
                <dt>Kund</dt>
                <dd>{detailBooking.customer_name}</dd>
              </div>
              <div>
                <dt>Kontakt</dt>
                <dd>
                  {[detailBooking.customer_email, detailBooking.customer_phone].filter(Boolean).join(' · ') || '—'}
                </dd>
              </div>
              <div>
                <dt>Tjänster</dt>
                <dd>
                  {bookingServicesList(detailBooking) ? (
                    <div className="booking-detail-services-wrap">
                      <ul className="booking-detail-service-bullets">
                        {bookingServicesList(detailBooking).map((row, idx) => (
                          <li key={`${row.service_id || 's'}-${idx}`}>
                            {row.name} — {fmtKr(Number(row.price_amount) || 0)}
                          </li>
                        ))}
                      </ul>
                      <p className="booking-detail-service-total-line">
                        Totalt: {fmtKr(bookingServicesTotalÖre(detailBooking))}
                      </p>
                    </div>
                  ) : (
                    detailBooking.services?.name || '—'
                  )}
                </dd>
              </div>
              <div>
                <dt>Stylist</dt>
                <dd>{detailBooking.stylist?.name || 'Valfri'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`status-badge status-${detailBooking.status}`}>
                    {detailBooking.status === 'confirmed'
                      ? 'Bekräftad'
                      : detailBooking.status === 'rebooked'
                        ? 'Ombokad'
                        : detailBooking.status === 'cancelled'
                          ? 'Avbokad'
                          : detailBooking.status === 'completed'
                            ? 'Genomförd'
                            : detailBooking.status}
                  </span>
                </dd>
              </div>
              <div
                className={`booking-detail-dl-row booking-detail-dl-row--message ${
                  bookingNotesTrimmed(detailBooking) ? 'booking-detail-dl-row--message-filled' : ''
                }`}
              >
                <dt>Meddelande från kunden</dt>
                <dd>
                  {bookingNotesTrimmed(detailBooking) ? (
                    <span className="booking-detail-message-body">{bookingNotesTrimmed(detailBooking)}</span>
                  ) : (
                    <span className="booking-detail-message-empty">Inget meddelande</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

// ─── Staff Tab ───────────────────────────────────────────────────────────────
function StaffTab({ salonId: salonIdProp }) {
  const [staff, setStaff] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);
  const [calendarStatus, setCalendarStatus] = useState({});
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const salonId = salonIdProp || getSalonIdForPublicApi();

  const loadStaff = useCallback(() => {
    setLoadError('');
    if (!salonId) {
      setStaff([]);
      setLoading(false);
      setLoadError('Saknar salong-ID. Välj "Öppna som salong" i Salonger eller logga in igen.');
      return;
    }
    setLoading(true);
    fetch('/api/staff/list', { headers: authHeaders() })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setStaff([]);
          setLoadError(typeof d.error === 'string' ? d.error : `Kunde inte hämta personal (HTTP ${r.status}).`);
          setLoading(false);
          return;
        }
        const filtered = Array.isArray(d) ? d.filter((s) => s.id !== 'any') : [];
        setStaff(filtered);
        setLoading(false);
        filtered.forEach((s) => {
          fetch(`/api/calendar/busy?stylist_id=${s.id}&date=${new Date().toISOString().slice(0, 10)}`)
            .then((r2) => r2.json())
            .then((data) => {
              setCalendarStatus((prev) => ({ ...prev, [s.id]: data.calendarConnected || false }));
            })
            .catch(() => {});
        });
      })
      .catch(() => {
        setLoading(false);
        setLoadError('Nätverksfel vid hämtning av personal.');
      });
  }, [salonId]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const handleInvite = async () => {
    setInviteLoading(true);
    setInviteMessage('');
    setInviteUrl('');
    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email: inviteEmail || undefined }),
    });
    const data = await res.json();
    setInviteLoading(false);
    if (data.inviteUrl) setInviteUrl(data.inviteUrl);
    if (data.message) setInviteMessage(data.message);
    if (!inviteEmail) setShowInviteForm(false);
  };

  const handleRemove = async (id) => {
    if (!confirm('Vill du ta bort denna personal?')) return;
    await fetch(`/api/staff/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    loadStaff();
  };

  const handleStaffSaved = (updated) => {
    if (updated && typeof updated === 'object' && updated.id) {
      setStaff((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      setEditingStaff((cur) => (cur && cur.id === updated.id ? { ...cur, ...updated } : cur));
    }
  };

  if (loading) return <div className="admin-loading">Laddar personal...</div>;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Personal</h2>
        <button className="btn-admin-primary" onClick={() => { setShowInviteForm(!showInviteForm); setInviteMessage(''); setInviteUrl(''); setInviteEmail(''); }}>
          + Bjud in personal
        </button>
      </div>

      {showInviteForm && (
        <div className="admin-card" style={{ marginBottom: '16px' }}>
          <h3 className="admin-card-title">Bjud in ny personal</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
            <input
              type="email"
              placeholder="Ange e-postadress"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="invite-url-input"
              style={{ flex: 1 }}
            />
            <button className="btn-admin-primary" onClick={handleInvite} disabled={inviteLoading}>
              {inviteLoading ? 'Skickar...' : 'Skicka inbjudan'}
            </button>
          </div>
          {!inviteEmail && (
            <button className="btn-sm btn-ghost" style={{ marginTop: '8px' }} onClick={handleInvite} disabled={inviteLoading}>
              Skapa länk utan email (dela manuellt)
            </button>
          )}
        </div>
      )}

      {inviteMessage && (
        <div className="invite-url-box">
          <p>{inviteMessage}</p>
          {inviteUrl && (
            <div className="invite-url-row">
              <input type="text" readOnly value={inviteUrl} className="invite-url-input" />
              <button className="btn-sm" onClick={() => { navigator.clipboard.writeText(inviteUrl); }}>Kopiera</button>
            </div>
          )}
        </div>
      )}

      {loadError ? (
        <p className="admin-hint" style={{ color: '#b91c1c', marginBottom: '1rem' }}>
          {loadError}
        </p>
      ) : null}

      <div className="staff-grid-admin">
        {!loading && staff.length === 0 && !loadError ? (
          <p className="admin-empty" style={{ gridColumn: '1 / -1' }}>
            Ingen personal listad. Bjud in med knappen ovan.
          </p>
        ) : null}
        {staff.map(s => (
          <div key={s.id} className="staff-card-admin staff-card-admin--interactive">
            <div className="staff-card-left">
              {s.photo_url
                ? <img src={s.photo_url} alt={s.name} className="staff-avatar-admin" />
                : <div className="staff-avatar-admin staff-avatar-placeholder-admin">
                    <User className="staff-avatar-icon-admin" />
                  </div>
              }
              <div>
                <h4>{s.name}</h4>
                <p>{s.title || 'Stylist'}</p>
                <span className={`calendar-badge ${calendarStatus[s.id] ? 'connected' : 'disconnected'}`}>
                  {calendarStatus[s.id] ? (
                    <>
                      <CalendarCheck className="calendar-badge-icon" size={14} strokeWidth={2} aria-hidden />
                      <span>Kalender kopplad</span>
                    </>
                  ) : (
                    <>
                      <CalendarOff className="calendar-badge-icon" size={14} strokeWidth={2} aria-hidden />
                      <span>Kalender ej kopplad</span>
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="staff-card-actions">
              <button
                type="button"
                className="staff-card-btn-icon staff-card-btn-icon--edit"
                title="Redigera"
                aria-label="Redigera"
                onClick={() => setEditingStaff(s)}
              >
                <Pencil size={18} strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className="staff-card-btn-icon staff-card-btn-icon--delete"
                title="Ta bort"
                aria-label="Ta bort"
                onClick={() => handleRemove(s.id)}
              >
                <Trash2 size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>

      <StaffEditSlideOver
        staff={editingStaff}
        onClose={() => setEditingStaff(null)}
        onSaved={handleStaffSaved}
      />
    </div>
  );
}

/** Stjärnikon — SVG utan pointer-events så klick träffar alltid knappen (samma som kundvyns fallback: första 4 om inga is_popular). */
function ServicePopularStarIcon({ filled }) {
  return (
    <svg
      className="service-row-popular-star-svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
    >
      {filled ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      )}
    </svg>
  );
}

// ─── Services Tab ────────────────────────────────────────────────────────────
function ServicesTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [editingService, setEditingService] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirmingDeleteCat, setConfirmingDeleteCat] = useState(null);
  const [addingToCategory, setAddingToCategory] = useState(null);
  const [addForm, setAddForm] = useState({ name: '', price_label: '', price_amount: 0, duration: '', duration_minutes: 60 });
  const [addingCategory, setAddingCategory] = useState(false);
  const [addCatForm, setAddCatForm] = useState({ name: '', description: '' });
  const [showImportModal, setShowImportModal] = useState(false);

  const loadServices = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const sid = getSalonIdForPublicApi();
    if (!sid) {
      setCategories([]);
      setLoadError('Saknar salong-ID. Logga in igen.');
      setLoading(false);
      return;
    }
    fetch(`/api/services?salon_id=${encodeURIComponent(sid)}`)
      .then((r) => {
        if (!r.ok) return Promise.reject(new Error(`HTTP ${r.status}`));
        return r.json();
      })
      .then((d) => {
        setCategories(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => {
        setLoadError('Kunde inte ladda tjänster.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    const onServicesUpdated = () => loadServices();
    window.addEventListener('appbok-services-updated', onServicesUpdated);
    return () => window.removeEventListener('appbok-services-updated', onServicesUpdated);
  }, [loadServices]);

  const handleEdit = (svc) => {
    setEditingService(svc.id);
    setEditForm({
      name: svc.name,
      price_label: svc.price_label,
      price_amount: svc.price_amount,
      duration: svc.duration,
      duration_minutes: svc.duration_minutes,
    });
  };

  const handleSave = async (svcId) => {
    await fetch(`/api/services/${svcId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(editForm),
    });
    setEditingService(null);
    loadServices();
  };

  const handleDelete = async (svcId) => {
    if (!window.confirm('Ta bort denna tjänst?')) return;
    await fetch(`/api/services/${svcId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    loadServices();
  };

  const handleCreateService = async (categoryId) => {
    if (!addForm.name) return alert('Tjänstens namn krävs.');
    await fetch('/api/services', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ...addForm, category_id: categoryId }),
    });
    setAddingToCategory(null);
    setAddForm({ name: '', price_label: '', price_amount: 0, duration: '', duration_minutes: 60 });
    loadServices();
  };

  const handleCreateCategory = async () => {
    if (!addCatForm.name) return alert('Kategorins namn krävs.');
    await fetch('/api/services/categories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(addCatForm),
    });
    setAddingCategory(false);
    setAddCatForm({ name: '', description: '' });
    loadServices();
  };

  const executeDeleteCategory = async (catId) => {
    setConfirmingDeleteCat(null);
    try {
      const res = await fetch(`/api/services/categories/${catId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json();
        alert('Ett fel uppstod: ' + (errData.error || res.status));
      }
      loadServices();
    } catch (err) {
      alert('Nätverksfel: ' + err.message);
    }
  };

  /** Endast DB-flaggor — inte kundvyns "första fyra"-fallback (annars ser stjärnor ut att sparas men laddas om). */
  const serviceIsPopular = (svc) => Boolean(svc.is_popular ?? svc.isPopular);

  const handleTogglePopular = async (svc, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const previous = serviceIsPopular(svc);
    const next = !previous;

    setCategories((cats) =>
      cats.map((c) => ({
        ...c,
        services: c.services?.map((s) =>
          s.id === svc.id ? { ...s, is_popular: next, isPopular: next } : s,
        ),
      })),
    );

    try {
      const res = await fetch(`/api/services/${svc.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ is_popular: next }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setCategories((cats) =>
        cats.map((c) => ({
          ...c,
          services: c.services?.map((s) =>
            s.id === svc.id ? { ...s, is_popular: previous, isPopular: previous } : s,
          ),
        })),
      );
      console.error('Kunde inte växla populär-markering:', err);
      const msg =
        typeof err?.message === 'string' && err.message.trim()
          ? err.message
          : 'Kunde inte spara stjärnmarkering. Kontrollera nätverk eller logga in igen.';
      setToggleError(msg);
      window.setTimeout(() => setToggleError(''), 12000);
    }
  };

  if (loading) return <div className="admin-loading">Laddar tjänster...</div>;

  return (
    <div className="admin-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 className="admin-section-title" style={{ margin: 0 }}>Tjänster</h2>
        <button
          className="btn-admin-secondary"
          style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
          onClick={() => setShowImportModal(true)}
        >
          Importera från Bokadirekt
        </button>
      </div>
      {toggleError ? (
        <p className="admin-hint" style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>
          {toggleError}
        </p>
      ) : null}
      {loadError ? (
        <p className="admin-hint" style={{ color: '#b91c1c', marginBottom: '1rem' }}>
          {loadError}
        </p>
      ) : null}

      {categories.map(cat => (
        <div key={cat.id} className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="admin-card-title">{cat.name}</h3>
              <p className="admin-card-desc">{cat.description}</p>
            </div>
            {confirmingDeleteCat === cat.id ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#E48989', marginRight: '8px' }}>Radera alla tjänster i menyn?</span>
                <button className="btn-sm btn-danger" onClick={() => executeDeleteCategory(cat.id)}>Ja, radera</button>
                <button className="btn-sm btn-ghost" onClick={() => setConfirmingDeleteCat(null)}>Avbryt</button>
              </div>
            ) : (
              <button 
                className="btn-sm btn-ghost" 
                style={{ color: '#E48989' }} 
                onClick={() => setConfirmingDeleteCat(cat.id)}
              >
                Ta bort kategori
              </button>
            )}
          </div>

          <div className="service-list-admin">
            {cat.services?.map(svc => (
              <div key={svc.id} className="service-row-admin">
                {editingService === svc.id ? (
                  <div className="service-edit-form">
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({...f, name: e.target.value}))}
                      placeholder="Tjänstnamn"
                    />
                    <input
                      value={editForm.price_label}
                      onChange={e => setEditForm(f => ({...f, price_label: e.target.value}))}
                      placeholder="Pristext"
                    />
                    <input
                      type="number"
                      value={editForm.price_amount / 100}
                      onChange={e => setEditForm(f => ({...f, price_amount: Math.round(parseFloat(e.target.value) * 100)}))}
                      placeholder="Pris (kr)"
                    />
                    <input
                      value={editForm.duration}
                      onChange={e => setEditForm(f => ({...f, duration: e.target.value}))}
                      placeholder="Tid (t.ex. 60 min)"
                    />
                    <div className="service-edit-actions">
                      <button className="btn-sm" onClick={() => handleSave(svc.id)}>Spara</button>
                      <button className="btn-sm btn-ghost" onClick={() => setEditingService(null)}>Avbryt</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="service-row-grip" aria-hidden title="Dra för att sortera (kommer snart)">
                      <GripVertical size={18} strokeWidth={2} />
                    </span>
                    <div className="service-row-main">
                      <span className="service-row-name">{svc.name}</span>
                    </div>
                    <div className="service-row-meta">
                      {svc.duration ? (
                        <span className="service-row-duration">{svc.duration}</span>
                      ) : null}
                      {svc.duration && svc.price_label ? (
                        <span className="service-row-meta-sep" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      {svc.price_label ? (
                        <span className="service-row-price">{svc.price_label}</span>
                      ) : null}
                    </div>
                    <div className="service-row-actions">
                      <button
                        type="button"
                        className={`service-row-popular-btn ${serviceIsPopular(svc) ? 'service-row-popular-btn--on' : 'service-row-popular-btn--off'}`}
                        title={
                          serviceIsPopular(svc)
                            ? 'Ta bort från populära'
                            : 'Markera som populär'
                        }
                        aria-label={
                          serviceIsPopular(svc)
                            ? 'Ta bort från populära'
                            : 'Markera som populär'
                        }
                        aria-pressed={serviceIsPopular(svc)}
                        onClick={(ev) => handleTogglePopular(svc, ev)}
                      >
                        <ServicePopularStarIcon filled={serviceIsPopular(svc)} />
                      </button>
                      <button
                        type="button"
                        className="service-row-icon-btn service-row-icon-btn--edit"
                        title="Redigera tjänst"
                        aria-label="Redigera tjänst"
                        onClick={() => handleEdit(svc)}
                      >
                        <Pencil size={18} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="service-row-icon-btn service-row-icon-btn--delete"
                        title="Ta bort tjänst"
                        aria-label="Ta bort tjänst"
                        onClick={() => handleDelete(svc.id)}
                      >
                        <Trash2 size={18} strokeWidth={2} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {addingToCategory === cat.id ? (
              <div className="service-row-admin">
                <div className="service-edit-form">
                  <input
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({...f, name: e.target.value}))}
                    placeholder="Tjänstnamn (Ex: Barnklippning)"
                  />
                  <input
                    value={addForm.price_label}
                    onChange={e => setAddForm(f => ({...f, price_label: e.target.value}))}
                    placeholder="Pristext (Ex: Från 350 kr)"
                  />
                  <input
                    type="number"
                    value={addForm.price_amount ? (addForm.price_amount / 100).toString() : ''}
                    onChange={e => setAddForm(f => ({...f, price_amount: Math.round(parseFloat(e.target.value || 0) * 100)}))}
                    placeholder="Pris i kr (Ex: 350)"
                  />
                  <input
                    value={addForm.duration}
                    onChange={e => setAddForm(f => ({...f, duration: e.target.value}))}
                    placeholder="Tid (Ex: 30 min)"
                  />
                  <div className="service-edit-actions">
                    <button className="btn-sm" onClick={() => handleCreateService(cat.id)}>Skapa tjänst</button>
                    <button className="btn-sm btn-ghost" onClick={() => setAddingToCategory(null)}>Avbryt</button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="service-add-service-btn"
                onClick={() => {
                  setAddingToCategory(cat.id);
                  setAddForm({ name: '', price_label: '', price_amount: 0, duration: '', duration_minutes: 60 });
                }}
              >
                <Plus size={16} strokeWidth={2} aria-hidden />
                <span>Lägg till tjänst i {cat.name}</span>
              </button>
            )}

          </div>
        </div>
      ))}

      {addingCategory ? (
        <div className="admin-card" style={{ border: '2px dashed #a3a3a3' }}>
          <h3 className="admin-card-title">Ny huvudkategori</h3>
          <div className="service-edit-form" style={{ marginTop: '1rem' }}>
            <input
              value={addCatForm.name}
              onChange={e => setAddCatForm(f => ({...f, name: e.target.value}))}
              placeholder="Kategorinamn (Ex: Herrklippning)"
            />
            <input
              value={addCatForm.description}
              onChange={e => setAddCatForm(f => ({...f, description: e.target.value}))}
              placeholder="Beskrivning (valfritt)"
            />
            <div className="service-edit-actions">
              <button className="btn-admin-primary" onClick={handleCreateCategory}>Skapa kategori</button>
              <button className="btn-sm btn-ghost" onClick={() => setAddingCategory(false)}>Avbryt</button>
            </div>
          </div>
        </div>
      ) : (
        <button 
          className="btn-admin-secondary" 
          style={{ width: '100%', padding: '16px', borderStyle: 'dashed', borderColor: '#d4d4d4' }}
          onClick={() => setAddingCategory(true)}
        >
          + Lägg till ny Huvudkategori
        </button>
      )}

      {showImportModal && (
        <ServiceImportModal
          salonId={getSalonIdForPublicApi()}
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); loadServices(); }}
        />
      )}
    </div>
  );
}

// ─── Inställningar — endast personal (kalender). Salongsadmin använder SalonAdminSettingsTab. ─
function StaffSettingsTab() {
  const [calStatus, setCalStatus] = useState(null);
  const [calLoading, setCalLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar/status', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setCalStatus(d);
        setCalLoading(false);
      })
      .catch(() => setCalLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') {
      setCalStatus((prev) => ({ ...prev, connected: true }));
      window.history.replaceState({}, '', '/admin');
    }
  }, []);

  const handleConnect = async () => {
    const res = await fetch('/api/calendar/connect', { headers: authHeaders() });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const handleDisconnect = async () => {
    await fetch('/api/calendar/disconnect', { headers: authHeaders() });
    setCalStatus((prev) => ({ ...prev, connected: false }));
  };

  return (
    <div className="admin-section">
      <h2 className="admin-section-title">Inställningar</h2>
      <p className="admin-hint" style={{ marginBottom: '1.25rem' }}>
        Som personal kan du koppla din Google Kalender här. Övriga salongsinställningar hanteras av administratören.
      </p>

      <div className="admin-card">
        <h3 className="admin-card-title">📅 Google Kalender</h3>
        <p className="admin-card-desc">
          Koppla din Google Kalender för att automatiskt synka bokningar och blockera privata tider.
        </p>

        {calLoading ? (
          <p className="admin-hint">Kontrollerar kalenderanslutning...</p>
        ) : !calStatus?.configured ? (
          <div className="calendar-status-box not-configured">
            <span className="cal-status-icon">⚙️</span>
            <div>
              <strong>Google Kalender är inte aktiverat på servern</strong>
              <p>
                API:t saknar <code>GOOGLE_CLIENT_ID</code> och <code>GOOGLE_CLIENT_SECRET</code> i miljön (t.ex.
                Vercel Environment Variables). Be administratören lägga in OAuth-uppgifterna och rätt{' '}
                <code>GOOGLE_REDIRECT_URI</code> enligt <code>server/.env.example</code>.
              </p>
            </div>
          </div>
        ) : calStatus?.connected ? (
          <div className="calendar-status-box connected">
            <span className="cal-status-icon">✅</span>
            <div>
              <strong>Kalender kopplad</strong>
              <p>Din Google Calendar är ansluten. Bokningar synkas automatiskt.</p>
            </div>
            <button type="button" className="btn-sm btn-ghost" onClick={handleDisconnect}>
              Koppla från
            </button>
          </div>
        ) : (
          <div className="calendar-status-box disconnected">
            <span className="cal-status-icon">🔗</span>
            <div>
              <strong>Ej ansluten</strong>
              <p>Koppla din kalender för att få bokningar synkade.</p>
            </div>
            <button type="button" className="btn-admin-primary" onClick={handleConnect}>
              Koppla Google Kalender
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GDPR Tab ─────────────────────────────────────────────────────────────────
function GdprTab() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [anonymizeModal, setAnonymizeModal] = useState(null); // booking to anonymize
  const [anonymizeBusy, setAnonymizeBusy] = useState(false);
  const [anonymizeDone, setAnonymizeDone] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setLoading(true);
    setSearchDone(true);
    setResults(null);
    setAnonymizeDone('');
    try {
      const params = new URLSearchParams({ email: q });
      const res = await fetch(`/api/gdpr/export?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Något gick fel.');
      setResults(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appbok-export-${search.trim().replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAnonymize = async () => {
    if (!anonymizeModal) return;
    setAnonymizeBusy(true);
    try {
      const res = await fetch('/api/gdpr/anonymize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ booking_id: anonymizeModal.id, reason: 'admin_request' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte radera uppgifter.');
      toast.success('Kunduppgifter har raderats och anonymiserats.');
      setAnonymizeModal(null);
      setAnonymizeDone(anonymizeModal.id);
      // Re-search to get updated data
      if (search.trim()) {
        setSearch(search.trim());
        const params = new URLSearchParams({ email: search.trim() });
        const r = await fetch(`/api/gdpr/export?${params}`, { headers: authHeaders() });
        const d = await r.json();
        if (r.ok) setResults(d);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAnonymizeBusy(false);
    }
  };

  const consentBadge = (consent) =>
    consent ? (
      <span className="gdpr-consent-badge gdpr-consent-badge--yes">SMS ✓</span>
    ) : (
      <span className="gdpr-consent-badge gdpr-consent-badge--no">SMS —</span>
    );

  return (
    <div className="admin-section gdpr-tab-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">GDPR</h2>
      </div>

      {/* ── Kundsök ── */}
      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <p className="gdpr-search-label">Sök kund</p>
        <form onSubmit={handleSearch} className="gdpr-search-form">
          <input
            className="admin-input"
            style={{ flex: 2, fontFamily: 'var(--font-sans)', fontSize: '0.95rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="E-post, telefonnummer eller namn..."
          />
          <button type="submit" className="btn-admin-primary" disabled={loading || !search.trim()}>
            {loading ? 'Söker...' : 'Sök'}
          </button>
        </form>
      </div>

      {/* ── Sökresultat ── */}
      {searchDone && !loading && results && (
        <>
          <div className="gdpr-results-header">
            <p className="gdpr-results-summary">
              {results.bookings?.length > 0
                ? `${results.bookings.length} bokning(ar) för ${results.customer?.name || search}`
                : 'Inga bokningar hittades.'}
            </p>
            {results.bookings?.length > 0 && (
              <button className="btn-gdpr-export" onClick={handleExport}>
                <Download size={15} strokeWidth={2} aria-hidden />
                Exportera
              </button>
            )}
          </div>

          {results.bookings?.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Tid</th>
                    <th>Tjänst</th>
                    <th>Stylist</th>
                    <th>Status</th>
                    <th>Samtycke</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.bookings.map((b) => (
                    <tr key={b.id || `${b.date}-${b.time}`} className="gdpr-result-row">
                      <td>{b.date || '—'}</td>
                      <td>{b.time ? b.time.slice(0, 5) : '—'}</td>
                      <td>{b.service || '—'}</td>
                      <td>{b.stylist || 'Valfri'}</td>
                      <td>
                        <span className={`status-badge status-${b.status}`}>
                          {b.status === 'confirmed' ? 'Bekräftad' : b.status === 'rebooked' ? 'Ombokad' : b.status === 'cancelled' ? 'Avbokad' : b.status === 'completed' ? 'Genomförd' : b.status}
                        </span>
                      </td>
                      <td>{consentBadge(b.marketing_consent)}</td>
                      <td className="gdpr-actions-cell">
                        {b.status !== 'cancelled' && anonymizeDone !== (b.id || `${b.date}-${b.time}`) && (
                          <button
                            className="gdpr-delete-btn"
                            onClick={() => setAnonymizeModal({ id: b.id || `${b.date}-${b.time}`, date: b.date, time: b.time, service: b.service })}
                          >
                            Radera uppg.
                          </button>
                        )}
                        {anonymizeDone === (b.id || `${b.date}-${b.time}`) && (
                          <span className="gdpr-anonymized-label">Raderat</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── DPA-kort ── */}
      <div className="gdpr-dpa-section">
        <h3 className="gdpr-section-heading">Databehandlingsavtal (DPA)</h3>
        <div className="gdpr-dpa-card">
          <div className="gdpr-dpa-doc-icon" aria-hidden>📄</div>
          <div className="gdpr-dpa-content">
            <p className="gdpr-dpa-title">Databehandlingsavtal — Appbok AB</p>
            <p className="gdpr-dpa-body">
              Salonger som behandlar personuppgifter via Appbok ska ha ett signerat DPA med Appbok AB.
            </p>
            <a
              href="mailto:hej@appbok.se?subject=Förfrågan%20om%20DPA"
              className="btn-gdpr-export"
              style={{ display: 'inline-flex', marginTop: '0.75rem', textDecoration: 'none' }}
            >
              <Download size={15} strokeWidth={2} aria-hidden />
              Begär DPA via e-post
            </a>
          </div>
        </div>
      </div>

      {/* ── Register (Artikel 30) ── */}
      <div className="gdpr-dpa-section">
        <h3 className="gdpr-section-heading">Register över behandling (Artikel 30)</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Behandling</th>
                <th>Ändamål</th>
                <th>Rättslig grund</th>
                <th>Lagringstid</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bokningsuppgifter</td>
                <td>Avtalsförpliktelse — bekräftelse, påminnelse, betalning</td>
                <td>Kontraktsrättslig</td>
                <td>24 månader</td>
              </tr>
              <tr>
                <td>E-postmeddelanden</td>
                <td>Kommunikation med kund</td>
                <td>Berättigat intresse</td>
                <td>12 månader</td>
              </tr>
              <tr>
                <td>Betalningsuppgifter</td>
                <td>Redovisning och bokföring</td>
                <td>Rättslig förpliktelse</td>
                <td>7 år</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Anonymiseringsmodal ── */}
      {anonymizeModal && (
        <div className="modal-overlay" onClick={() => !anonymizeBusy && setAnonymizeModal(null)}>
          <div className="modal-box gdpr-anonymize-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Radera kunduppgifter</h3>
            <p className="modal-body-text">
              Detta kommer att anonymisera <strong>alla bokningar</strong> för denna kunds e-postadress.
              Namn, e-post och telefonnummer ersätts med generiska placeholder-värden.
              Anteckningar och samtycken tas bort.
            </p>
            <p className="modal-booking-detail">
              Berörd bokning: {anonymizeModal.date} kl {anonymizeModal.time} — {anonymizeModal.service}
            </p>
            <p className="modal-warning">Åtgärden kan inte ångras.</p>
            <div className="modal-actions">
              <button
                className="btn-admin-primary"
                onClick={handleAnonymize}
                disabled={anonymizeBusy}
              >
                {anonymizeBusy ? 'Raderar...' : 'Ja, radera'}
              </button>
              <button
                className="btn-sm btn-ghost"
                onClick={() => setAnonymizeModal(null)}
                disabled={anonymizeBusy}
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Billing Tab (platform owner) ─────────────────────────────────────────────
function BillingTab({ user }) {
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetch('/api/superadmin/salons', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setSalons(Array.isArray(data) ? data : data.salons || []); setLoading(false); })
      .catch(() => { setError('Kunde inte hämta salonger.'); setLoading(false); });
  }, []);

  const PLANS = [
    { value: 'starter',   label: 'Starter',   desc: 'Grundläggande funktioner' },
    { value: 'pro',       label: 'Pro',       desc: 'Avancerade funktioner'    },
    { value: 'enterprise',label: 'Enterprise', desc: 'Obegränsat'              },
  ];

  const STATUSES = [
    { value: 'active',   label: 'Active',   color: '#22c55e' },
    { value: 'trialing',  label: 'Trialing', color: '#f59e0b' },
    { value: 'past_due',  label: 'Past Due', color: '#ef4444' },
    { value: 'canceled',  label: 'Canceled', color: '#6b7280' },
  ];

  async function savePlan(salonId, plan) {
    setUpdating(salonId);
    try {
      const res = await fetch(`/api/superadmin/salons/${salonId}/billing`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error();
      setSalons(prev => prev.map(s => s.id === salonId ? { ...s, plan } : s));
    } catch {
      alert('Kunde inte spara.');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h1>Fakturering</h1>
      </div>
      {loading ? (
        <div className="admin-loading">Laddar...</div>
      ) : error ? (
        <p style={{ color: '#ef4444' }}>{error}</p>
      ) : (
        <div className="admin-card">
          <p className="admin-hint" style={{ marginBottom: '1.5rem' }}>
            Hantera abonnemang och faktureringsstatus för alla salonger.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Salong</th>
                  <th>Plan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salons.map(salon => (
                  <tr key={salon.id}>
                    <td style={{ fontWeight: 500 }}>{salon.name}</td>
                    <td>
                      <select
                        className="admin-select"
                        value={salon.plan || 'starter'}
                        disabled={updating === salon.id}
                        onChange={e => savePlan(salon.id, e.target.value)}
                      >
                        {PLANS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        color: STATUSES.find(st => st.value === salon.status)?.color || '#6b7280',
                        fontSize: '0.85rem', fontWeight: 500,
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: STATUSES.find(st => st.value === salon.status)?.color || '#6b7280',
                          display: 'inline-block',
                        }} />
                        {STATUSES.find(st => st.value === salon.status)?.label || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
