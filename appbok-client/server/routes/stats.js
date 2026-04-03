import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';

const router = Router();

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
  const today = stockholmYmd();
  const monthStart = stockholmMonthStart();

  if (!salonId) {
    return res.json({
      todayBookings: 0,
      monthBookings: 0,
      monthRevenue: 0,
      staffCount: 0,
      upcomingBookings: [],
    });
  }

  try {
    // Bokningar idag
    const { count: todayCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .eq('booking_date', today)
      .eq('status', 'confirmed');

    // Bokningar denna månad
    const { count: monthCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .gte('booking_date', monthStart)
      .in('status', ['confirmed', 'completed']);

    // Total intäkt denna månad (bekräftade + genomförda): betalt belopp eller tjänstepris
    const { data: monthRevenue, error: monthRevErr } = await supabase
      .from('bookings')
      .select('amount_paid, services(price_amount)')
      .eq('salon_id', salonId)
      .gte('booking_date', monthStart)
      .in('status', ['confirmed', 'completed']);

    if (monthRevErr) console.error('Stats overview monthRevenue:', monthRevErr.message);

    const totalRevenue = (monthRevenue || []).reduce((sum, b) => sum + effectiveRevenue(b), 0);

    // Kommande bokningar (nästa 7 dagar)
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const { data: upcoming } = await supabase
      .from('bookings')
      .select(`
        id, customer_name, booking_date, booking_time, status,
        services(name),
        stylist:users!bookings_stylist_id_fkey(name)
      `)
      .eq('salon_id', salonId)
      .gte('booking_date', today)
      .lte('booking_date', weekEnd.toISOString().split('T')[0])
      .eq('status', 'confirmed')
      .order('booking_date')
      .order('booking_time')
      .limit(10);

    // Antal personal
    const { count: staffCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .eq('role', 'staff')
      .eq('active', true);

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

  try {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = yearAgo.toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });

    const { data, error } = await supabase
      .from('bookings')
      .select('booking_date, amount_paid, services(price_amount)')
      .eq('salon_id', salonId)
      .gte('booking_date', yearAgoStr)
      .in('status', ['confirmed', 'completed']);

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
  const monthStart = stockholmMonthStart();

  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        amount_paid,
        services(price_amount),
        stylist:users!bookings_stylist_id_fkey(id, name)
      `)
      .eq('salon_id', salonId)
      .gte('booking_date', monthStart)
      .in('status', ['confirmed', 'completed']);

    if (error) throw error;

    const stylists = {};
    (bookings || []).forEach(b => {
      if (!b.stylist) return;
      const sid = b.stylist.id;
      if (!stylists[sid]) {
        stylists[sid] = {
          name: b.stylist.name,
          bookings: 0,
          revenue: 0,
        };
      }
      stylists[sid].bookings += 1;
      stylists[sid].revenue += effectiveRevenue(b);
    });

    // Sort by revenue descending
    const sorted = Object.values(stylists).sort((a, b) => b.revenue - a.revenue);
    res.json(sorted);
  } catch (err) {
    console.error('Stats top-stylists error:', err);
    res.status(500).json({ error: 'Kunde inte hämta styliststatistik.' });
  }
});

export default router;
