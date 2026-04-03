import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SuperadminSidebar from '../components/SuperadminSidebar.jsx';
import SuperadminTab from './SuperadminTab.jsx';
import SuperadminSettingsTab from '../components/SuperadminSettingsTab.jsx';
import SalonAdminSettingsTab from '../components/SalonAdminSettingsTab.jsx';

// ── Auth helper ──────────────────────────────────────────────────────────────
function getAuth() {
  const token = localStorage.getItem('sb_token');
  const user = JSON.parse(localStorage.getItem('sb_user') || 'null');
  const salon = JSON.parse(localStorage.getItem('sb_salon') || 'null');
  return { token, user, salon };
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
  };
}

function fmtKr(öre) {
  const n = typeof öre === 'number' && !Number.isNaN(öre) ? öre : 0;
  return `${(n / 100).toLocaleString('sv-SE')} kr`;
}

// ── Admin Layout ─────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const { token, user, salon } = getAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const [activeTab, setActiveTab] = useState(() => (isSuperAdmin ? 'superadmin' : 'dashboard'));

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    document.title = `Admin — ${salon?.name || 'SalonBook'}`;
  }, [token, navigate, salon]);

  const handleLogout = () => {
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
    localStorage.removeItem('sb_salon');
    navigate('/login');
  };

  const tabs = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { id: 'dashboard',  label: 'Dashboard',    icon: '📊', roles: ['superadmin'] },
        { id: 'superadmin',  label: 'Salonger',     icon: '👑', roles: ['superadmin'] },
        { id: 'billing',     label: 'Fakturering',  icon: '💳', roles: ['superadmin'] },
        { id: 'settings',    label: 'Inställningar', icon: '⚙️', roles: ['superadmin'] },
      ];
    }
    return [
      { id: 'dashboard', label: '📊 Dashboard', icon: '📊', roles: ['admin'] },
      { id: 'bookings',  label: '📅 Bokningar', icon: '📅', roles: ['admin', 'staff'] },
      { id: 'staff',     label: '👥 Personal',  icon: '👥', roles: ['admin'] },
      { id: 'services',  label: '💇 Tjänster',  icon: '💇', roles: ['admin'] },
      { id: 'settings',  label: '⚙️ Inställningar', icon: '⚙️', roles: ['admin', 'staff'] },
    ].filter((t) => t.roles.includes(user?.role || 'admin'));
  }, [isSuperAdmin, user?.role]);

  const saTabs = ['dashboard', 'superadmin', 'billing', 'settings'];

  useEffect(() => {
    if (isSuperAdmin) {
      setActiveTab((cur) => (saTabs.includes(cur) ? cur : 'dashboard'));
      return;
    }
    setActiveTab((cur) => (tabs.some((t) => t.id === cur) ? cur : tabs[0]?.id || 'dashboard'));
  }, [isSuperAdmin, user?.role, tabs]);

  if (!token) return null;

  return (
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
          <div className="admin-sidebar-header">
            <h2>{salon?.name || 'Min Salong'}</h2>
            <span className="admin-badge">{user?.role === 'staff' ? 'Personal' : 'Admin'}</span>
          </div>
          <nav className="admin-nav">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`admin-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="admin-nav-icon">{tab.icon}</span>
                <span>{tab.label.split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <div className="admin-user-info">
              <span className="admin-user-name">{user?.name}</span>
              <span className="admin-user-email">{user?.email}</span>
            </div>
            <button className="admin-logout-btn" onClick={handleLogout}>Logga ut</button>
          </div>
        </aside>
      )}

      {/* Main */}
      <main className="admin-main">
        {activeTab === 'dashboard'   && <DashboardTab />}
        {activeTab === 'bookings'   && <BookingsTab />}
        {activeTab === 'staff'      && <StaffTab />}
        {activeTab === 'services'  && <ServicesTab />}
        {activeTab === 'settings' && (
          isSuperAdmin ? (
            <SuperadminSettingsTab user={user} />
          ) : user?.role === 'admin' ? (
            <SalonAdminSettingsTab />
          ) : (
            <StaffSettingsTab />
          )
        )}
        {activeTab === 'superadmin' && <SuperadminTab />}
        {activeTab === 'billing'    && <BillingTab user={user} />}
      </main>
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────
function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [topStylists, setTopStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

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

  if (loading) return <div className="admin-loading">Laddar...</div>;
  if (statsError) return <div className="admin-empty">{statsError}</div>;
  if (!stats) return <div className="admin-empty">Kunde inte hämta statistik.</div>;

  return (
    <div className="admin-section">
      <h2 className="admin-section-title">Dashboard</h2>

      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-icon">📅</span>
          <div className="stat-info">
            <span className="stat-value">{stats.todayBookings}</span>
            <span className="stat-label">Bokningar idag</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div className="stat-info">
            <span className="stat-value">{stats.monthBookings}</span>
            <span className="stat-label">Denna månad</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">💰</span>
          <div className="stat-info">
            <span className="stat-value">{fmtKr(stats.monthRevenue)}</span>
            <span className="stat-label">Omsättning (månad)</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div className="stat-info">
            <span className="stat-value">{stats.staffCount}</span>
            <span className="stat-label">Aktiv personal</span>
          </div>
        </div>
      </div>

      {stats.upcomingBookings?.length > 0 && (
        <div className="admin-card">
          <h3>Kommande bokningar</h3>
          <div className="booking-list">
            {stats.upcomingBookings.map(b => (
              <div key={b.id} className="booking-row">
                <div className="booking-row-left">
                  <span className="booking-date">{b.booking_date} kl {b.booking_time?.slice(0,5)}</span>
                  <span className="booking-customer">{b.customer_name}</span>
                </div>
                <div className="booking-row-right">
                  <span className="booking-service">{b.services?.name}</span>
                  <span className="booking-stylist">{b.stylist?.name || 'Valfri'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────────── */}
      <div className="charts-grid">
        <div className="admin-card chart-card">
          <h3>Omsättning (Senaste 12 mån)</h3>
          <div style={{ width: '100%', height: 250, marginTop: '20px' }}>
            {monthlyStats.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={monthlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#888" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `${v / 100} kr`} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    formatter={(val) => fmtKr(val)}
                  />
                  <Bar dataKey="revenue" fill="#A89483" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="admin-empty" style={{ paddingTop: '80px' }}>Inte tillräckligt med data ännu.</p>
            )}
          </div>
        </div>

        <div className="admin-card chart-card">
          <h3>Toppstylister (Månad)</h3>
          <div style={{ width: '100%', height: 250, marginTop: '20px' }}>
            {topStylists.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={topStylists} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#888" fontSize={12} tickFormatter={(v) => `${v / 100} kr`} />
                  <YAxis dataKey="name" type="category" stroke="#888" fontSize={12} width={80} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    formatter={(val) => fmtKr(val)}
                  />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="admin-empty" style={{ paddingTop: '80px' }}>Laddar eller saknar data.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bookings Tab ────────────────────────────────────────────────────────────
// ─── New Booking Modal (multi-step) ───────────────────────────────────────────
function NewBookingModal({ onClose, onCreated }) {
  const salonId = JSON.parse(localStorage.getItem('sb_salon') || '{}')?.id || '';
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

// ─── BookingsTab ────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showNewBooking, setShowNewBooking] = useState(false);

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

  const handleCancel = async (id) => {
    if (!confirm('Vill du avboka denna bokning?')) return;
    await fetch(`/api/bookings/${id}/cancel`, { method: 'PATCH', headers: authHeaders() });
    loadBookings(search, dateFilter);
  };

  const handleCreated = () => {
    setShowNewBooking(false);
    loadBookings(search, dateFilter);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Bokningar</h2>
        <button className="btn-admin-primary" onClick={() => setShowNewBooking(true)}>+ Ny bokning</button>
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
          <table className="admin-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Tid</th>
                <th>Kund</th>
                <th>Tjänst</th>
                <th>Stylist</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className={b.status === 'cancelled' ? 'row-cancelled' : ''}>
                  <td>{b.booking_date}</td>
                  <td>{b.booking_time?.slice(0,5)}</td>
                  <td>
                    <div>{b.customer_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.customer_email || b.customer_phone || ''}</div>
                  </td>
                  <td>{b.services?.name || '—'}</td>
                  <td>{b.stylist?.name || 'Valfri'}</td>
                  <td>
                    <span className={`status-badge status-${b.status}`}>
                      {b.status === 'confirmed' ? 'Bekräftad' : b.status === 'cancelled' ? 'Avbokad' : b.status === 'completed' ? 'Genomförd' : b.status}
                    </span>
                  </td>
                  <td>
                    {b.status === 'confirmed' && (
                      <button className="btn-sm btn-danger" onClick={() => handleCancel(b.id)}>Avboka</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewBooking && (
        <NewBookingModal
          onClose={() => setShowNewBooking(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

// ─── Staff Tab ───────────────────────────────────────────────────────────────
function StaffTab() {
  const [staff, setStaff] = useState([]);
  const [calendarStatus, setCalendarStatus] = useState({});
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const salonId = JSON.parse(localStorage.getItem('sb_salon') || '{}')?.id || '';

  const loadStaff = useCallback(() => {
    setLoading(true);
    fetch(`/api/staff?salon_id=${salonId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        const filtered = Array.isArray(d) ? d.filter(s => s.id !== 'any') : [];
        setStaff(filtered);
        setLoading(false);
        // Check calendar status for each staff member
        filtered.forEach(s => {
          fetch(`/api/calendar/busy?stylist_id=${s.id}&date=${new Date().toISOString().slice(0,10)}`)
            .then(r => r.json())
            .then(data => {
              setCalendarStatus(prev => ({ ...prev, [s.id]: data.calendarConnected || false }));
            })
            .catch(() => {});
        });
      })
      .catch(() => setLoading(false));
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

      <div className="staff-grid-admin">
        {staff.map(s => (
          <div key={s.id} className="staff-card-admin">
            <div className="staff-card-left">
              {s.photo_url
                ? <img src={s.photo_url} alt={s.name} className="staff-avatar-admin" />
                : <div className="staff-avatar-admin staff-avatar-placeholder-admin">
                    <span>{s.name?.charAt(0)}</span>
                  </div>
              }
              <div>
                <h4>{s.name}</h4>
                <p>{s.title || 'Stylist'}</p>
                <span className={`calendar-badge ${calendarStatus[s.id] ? 'connected' : 'disconnected'}`}>
                  {calendarStatus[s.id] ? '📅 Kalender kopplad' : '⚠️ Kalender ej kopplad'}
                </span>
              </div>
            </div>
            <button className="btn-sm btn-danger" onClick={() => handleRemove(s.id)}>Ta bort</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Services Tab ────────────────────────────────────────────────────────────
function ServicesTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirmingDeleteCat, setConfirmingDeleteCat] = useState(null);
  const [addingToCategory, setAddingToCategory] = useState(null);
  const [addForm, setAddForm] = useState({ name: '', price_label: '', price_amount: 0, duration: '', duration_minutes: 60 });
  const [addingCategory, setAddingCategory] = useState(false);
  const [addCatForm, setAddCatForm] = useState({ name: '', description: '' });
  const salonId = JSON.parse(localStorage.getItem('sb_salon') || '{}')?.id || '';

  const loadServices = useCallback(() => {
    setLoading(true);
    fetch(`/api/services?salon_id=${salonId}`)
      .then(r => r.json())
      .then(d => { setCategories(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [salonId]);

  useEffect(() => { loadServices(); }, [loadServices]);

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

  if (loading) return <div className="admin-loading">Laddar tjänster...</div>;

  return (
    <div className="admin-section">
      <h2 className="admin-section-title">Tjänster</h2>

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
                    <div className="service-row-left">
                      <span className="service-row-name">{svc.name}</span>
                      <span className="service-row-duration">{svc.duration}</span>
                    </div>
                    <div className="service-row-right">
                      <span className="service-row-price">{svc.price_label}</span>
                      <button className="btn-sm" onClick={() => handleEdit(svc)}>Ändra</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(svc.id)}>×</button>
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
                className="btn-admin-secondary" 
                style={{ width: '100%', marginTop: '12px', padding: '12px', borderStyle: 'dashed' }}
                onClick={() => {
                  setAddingToCategory(cat.id);
                  setAddForm({ name: '', price_label: '', price_amount: 0, duration: '', duration_minutes: 60 });
                }}
              >
                + Lägg till ny tjänst under {cat.name}
              </button>
            )}

          </div>
        </div>
      ))}

      {addingCategory ? (
        <div className="admin-card" style={{ border: '2px dashed #A89483' }}>
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
          style={{ width: '100%', padding: '16px', borderStyle: 'dashed', borderColor: '#d4c7bd' }}
          onClick={() => setAddingCategory(true)}
        >
          + Lägg till ny Huvudkategori
        </button>
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
              <strong>Google Calendar ej konfigurerat</strong>
              <p>Administratören behöver konfigurera Google OAuth på servern.</p>
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
