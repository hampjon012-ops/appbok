import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { loadSalonMaybeExpire } from '../lib/expireTrialSalon.js';
import {
  computeSlotsForStylist,
  computeSlotsForAnyStylist,
  dayConfigForWeekday,
  weekdayMonSun,
  salonWeekFromContact,
  effectiveWorkWeek,
} from '../lib/stylistAvailability.js';

const router = Router();

function dayOpenFromSchedule(workSchedule, dateStr, salonSchedule) {
  const wd = weekdayMonSun(dateStr);
  const week = effectiveWorkWeek(workSchedule, salonSchedule);
  const row = dayConfigForWeekday(week, wd);
  return Boolean(row?.enabled);
}


/**
 * GET /api/booking-availability?salon_id=&stylist_id=&date=YYYY-MM-DD
 * Returnerar tillgängliga starttider (HH:00) efter schema, lunch, block, Google, befintliga bokningar.
 */
router.get('/', async (req, res) => {
  const { salon_id, stylist_id, date } = req.query;
  if (!salon_id || !stylist_id || !date) {
    return res.status(400).json({ error: 'salon_id, stylist_id och date krävs.' });
  }
  const dateStr = String(date).slice(0, 10);

  try {
    const salon = await loadSalonMaybeExpire(salon_id);
    if (!salon) {
      return res.status(404).json({ error: 'Salong hittades inte.', slots: [], dateClosed: true });
    }
    if (salon.status === 'deleted') {
      return res.status(403).json({
        error: 'Denna salong är inte längre aktiv.',
        slots: [],
        dateClosed: true,
      });
    }
    if (salon.status === 'expired') {
      return res.status(403).json({
        error: 'Denna salongs testperiod är avslutad.',
        slots: [],
        dateClosed: true,
      });
    }

    // Salongens öppettider → används för stylists med mode='salon'
    const salonSchedule = salonWeekFromContact(salon.contact);

    if (stylist_id === 'any') {
      const { data: staff, error } = await supabase
        .from('users')
        .select('id, work_schedule')
        .eq('salon_id', salon_id)
        .eq('role', 'staff')
        .eq('active', true);
      if (error) throw error;
      if (!staff?.length) {
        return res.json({ slots: [], dateClosed: true });
      }
      const slots = await computeSlotsForAnyStylist({
        salonId: salon_id,
        dateStr,
        staffList: staff,
        salonSchedule,
      });
      return res.json({ slots, dateClosed: slots.length === 0 });
    }

    const { data: u, error: uErr } = await supabase
      .from('users')
      .select('id, salon_id, work_schedule')
      .eq('id', stylist_id)
      .eq('salon_id', salon_id)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!u) {
      return res.status(404).json({ error: 'Stylist hittades inte.' });
    }

    const slots = await computeSlotsForStylist({
      salonId: salon_id,
      stylistId: stylist_id,
      dateStr,
      workSchedule: u.work_schedule,
      salonSchedule,
    });
    return res.json({ slots, dateClosed: slots.length === 0 });
  } catch (err) {
    console.error('booking-availability:', err);
    res.status(500).json({ error: 'Kunde inte beräkna tillgängliga tider.' });
  }
});

/**
 * GET /api/booking-availability/closed-dates?salon_id=&stylist_id=&from=YYYY-MM-DD&days=21
 * Vilka datum i intervallet som saknar minst en bokningsbar timme (för datum-lista i UI).
 */
router.get('/closed-dates', async (req, res) => {
  const { salon_id, stylist_id, from, days } = req.query;
  if (!salon_id || !stylist_id || !from) {
    return res.status(400).json({ error: 'salon_id, stylist_id och from krävs.' });
  }
  const n = Math.min(parseInt(String(days || '21'), 10) || 21, 90);
  const start = new Date(`${String(from).slice(0, 10)}T12:00:00`);

  try {
    const salon = await loadSalonMaybeExpire(salon_id);
    if (!salon) {
      return res.status(404).json({ error: 'Salong hittades inte.', closedDates: [] });
    }
    if (salon.status === 'deleted') {
      return res.status(403).json({
        error: 'Denna salong är inte längre aktiv.',
        closedDates: [],
      });
    }
    if (salon.status === 'expired') {
      return res.status(403).json({
        error: 'Denna salongs testperiod är avslutad.',
        closedDates: [],
      });
    }

    // Salongens öppettider → används för stylists med mode='salon'
    const salonSchedule = salonWeekFromContact(salon.contact);

    const closed = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);

      if (stylist_id === 'any') {
        const { data: staff } = await supabase
          .from('users')
          .select('id, work_schedule')
          .eq('salon_id', salon_id)
          .eq('role', 'staff')
          .eq('active', true);
        if (!staff?.length) {
          closed.push(dateStr);
          continue;
        }
        const slots = await computeSlotsForAnyStylist({
          salonId: salon_id,
          dateStr,
          staffList: staff,
          salonSchedule,
        });
        if (slots.length === 0) closed.push(dateStr);
        continue;
      }

      const { data: u } = await supabase
        .from('users')
        .select('work_schedule')
        .eq('id', stylist_id)
        .eq('salon_id', salon_id)
        .maybeSingle();
      if (!u) {
        closed.push(dateStr);
        continue;
      }
      // Snabb väg: stängd veckodag utan att köra full beräkning
      if (!dayOpenFromSchedule(u.work_schedule, dateStr, salonSchedule)) {
        closed.push(dateStr);
        continue;
      }
      const slots = await computeSlotsForStylist({
        salonId: salon_id,
        stylistId: stylist_id,
        dateStr,
        workSchedule: u.work_schedule,
        salonSchedule,
      });
      if (slots.length === 0) closed.push(dateStr);
    }
    return res.json({ closedDates: closed });
  } catch (err) {
    console.error('closed-dates:', err);
    res.status(500).json({ error: 'Kunde inte beräkna stängda datum.' });
  }
});

export default router;
