import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';

const router = Router();

/** Intern system-salong (superadmin-JWT); ingen riktig driftdata — aggregera över övriga salonger. */
const SYSTEM_SALON_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

/** Superadmin utan impersonation: översikt ska visa hela plattformen, inte system-salongen. */
function isPlatformSuperadminStats(req) {
  return req.user?.role === 'superadmin' && !req.headers['x-impersonate-salon-id'];
}

/** Dagens datum och månadens första dag i svensk kalender (matchar booking_date i UI). */
function stockholmYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });
}
function stockholmMonthStart() {
  const ymd = stockholmYmd();
  return `${ymd.slice(0, 7)}-01`;
}

/** Intäkt i öre: faktiskt betalt belopp, annars tjänstens listpris (bekräftade bokningar utan sparat belopp). */
function effectiveRevenue(row) {
  const paid = Number(row.amount_paid) || 0;
  if (paid > 0) return paid;
  let s = row.services;
  if (Array.isArray(s)) s = s[0];
  if (!s || typeof s !== 'object') return 0;
  const pa = s.price_amount;
  const n = typeof pa === 'number' ? pa : Number(pa);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ── GET /api/stats/overview — Admin: översikts-statistik ─────────────────────
router.get('/overview', requireAuth, requireAdmin, async (req, res) => {
  const salonId = req.user.salonId;
  const platform = isPlatformSuperadminStats(req);
  const today = stockholmYmd();
  const monthStart = stockholmMonthStart();

  if (!platform && !salonId) {
    return res.json({
      todayBookings: 0,
      monthBookings: 0,
      monthRevenue: 0,
      staffCount: 0,
      upcomingBookings: [],
    });
  }

  try {
    const bookingsSalonFilter = (q) =>
      platform ? q.neq('salon_id', SYSTEM_SALON_ID) : q.eq('salon_id', salonId);
    const usersSalonFilter = (q) =>
      platform ? q.neq('salon_id', SYSTEM_SALON_ID) : q.eq('salon_id', salonId);

    // Bokningar idag
    const { count: todayCount } = await bookingsSalonFilter(
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('booking_date', today)
        .in('status', ['confirmed', 'rebooked']),
    );

    // Bokningar denna månad
    const { count: monthCount } = await bookingsSalonFilter(
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('booking_date', monthStart)
        .in('status', ['confirmed', 'rebooked', 'completed']),
    );

    // Total intäkt denna månad (bekräftade + genomförda): betalt belopp eller tjänstepris
    const { data: monthRevenue, error: monthRevErr } = await bookingsSalonFilter(
      supabase
        .from('bookings')
        .select('amount_paid, services(price_amount)')
        .gte('booking_date', monthStart)
        .in('status', ['confirmed', 'rebooked', 'completed']),
    );

    if (monthRevErr) console.error('Stats overview monthRevenue:', monthRevErr.message);

    const totalRevenue = (monthRevenue || []).reduce((sum, b) => sum + effectiveRevenue(b), 0);

    // Kommande bokningar (nästa 7 dagar)
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const upcomingSelect = platform
      ? `
        id, customer_name, booking_date, booking_time, status,
        services(name),
        stylist:users!bookings_stylist_id_fkey(name),
        salons(name)
      `
      : `
        id, customer_name, booking_date, booking_time, status,
        services(name),
        stylist:users!bookings_stylist_id_fkey(name)
      `;
    const { data: upcoming } = await bookingsSalonFilter(
      supabase
        .from('bookings')
        .select(upcomingSelect)
        .gte('booking_date', today)
        .lte('booking_date', weekEnd.toISOString().split('T')[0])
        .in('status', ['confirmed', 'rebooked'])
        .order('booking_date')
        .order('booking_time')
        .limit(10),
    );

    // Antal personal
    const { count: staffCount } = await usersSalonFilter(
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'staff').eq('active', true),
    );

    res.json({
      todayBookings: todayCount || 0,
      monthBookings: monthCount || 0,
      monthRevenue: totalRevenue,
      staffCount: staffCount || 0,
      upcomingBookings: upcoming || [],
    });
  } catch (err) {
    console.error('Stats overview error:', err);
    res.status(500).json({ error: 'Kunde inte hämta statistik.' });
  }
});

// ── GET /api/stats/monthly — Admin: månadsvis omsättning ────────────────────
router.get('/monthly', requireAuth, requireAdmin, async (req, res) => {
  const salonId = req.user.salonId;
  const platform = isPlatformSuperadminStats(req);

  try {
    if (!platform && !salonId) {
      return res.json([]);
    }

    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = yearAgo.toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });

    let monthlyQuery = supabase
      .from('bookings')
      .select('booking_date, amount_paid, services(price_amount)')
      .gte('booking_date', yearAgoStr)
      .in('status', ['confirmed', 'rebooked', 'completed']);
    monthlyQuery = platform
      ? monthlyQuery.neq('salon_id', SYSTEM_SALON_ID)
      : monthlyQuery.eq('salon_id', salonId);

    const { data, error } = await monthlyQuery;

    if (error) throw error;

    // Gruppera per månad
    const months = {};
    (data || []).forEach(b => {
      const month = b.booking_date.slice(0, 7); // "2026-03"
      if (!months[month]) months[month] = { month, bookings: 0, revenue: 0 };
      months[month].bookings += 1;
      months[month].revenue += effectiveRevenue(b);
    });

    res.json(Object.values(months).sort((a, b) => a.month.localeCompare(b.month)));
  } catch (err) {
    console.error('Stats monthly error:', err);
    res.status(500).json({ error: 'Kunde inte hämta månadsstatistik.' });
  }
});

// ── GET /api/stats/top-stylists — Admin: Toppstylister denna månad ───────────
router.get('/top-stylists', requireAuth, requireAdmin, async (req, res) => {
  const salonId = req.user.salonId;
  const platform = isPlatformSuperadminStats(req);
  const monthStart = stockholmMonthStart();

  try {
    if (!platform && !salonId) {
      return res.json([]);
    }

    const topSelect = platform
      ? `
        amount_paid,
        services(price_amount),
        stylist:users!bookings_stylist_id_fkey(id, name),
        salons(name)
      `
      : `
        amount_paid,
        services(price_amount),
        stylist:users!bookings_stylist_id_fkey(id, name)
      `;

    let topQuery = supabase
      .from('bookings')
      .select(topSelect)
      .gte('booking_date', monthStart)
      .in('status', ['confirmed', 'rebooked', 'completed']);
    topQuery = platform
      ? topQuery.neq('salon_id', SYSTEM_SALON_ID)
      : topQuery.eq('salon_id', salonId);

    const { data: bookings, error } = await topQuery;

    if (error) throw error;

    const stylists = {};
    (bookings || []).forEach(b => {
      if (!b.stylist) return;
      const sid = b.stylist.id;
      const salonName = b.salons?.name;
      const label =
        platform && salonName ? `${b.stylist.name} · ${salonName}` : b.stylist.name;
      if (!stylists[sid]) {
        stylists[sid] = {
          name: label,
          bookings: 0,
          revenue: 0,
        };
      }
      stylists[sid].bookings += 1;
      stylists[sid].revenue += effectiveRevenue(b);
    });

    // Sort by revenue descending (plattform: begränsa till topp 10 för diagrammet)
    let sorted = Object.values(stylists).sort((a, b) => b.revenue - a.revenue);
    if (platform) sorted = sorted.slice(0, 10);
    res.json(sorted);
  } catch (err) {
    console.error('Stats top-stylists error:', err);
    res.status(500).json({ error: 'Kunde inte hämta styliststatistik.' });
  }
});

export default router;
