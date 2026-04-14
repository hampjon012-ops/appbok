/**
 * Stylist arbetsschema + blockeringar → tillgängliga bokningstider (timslots).
 * Veckodag: 0 = måndag … 6 = söndag.
 */

import supabase from './supabase.js';
import { getBusySlots } from './google.js';

/** Mån–fre 09–18, lör 10–15, sön stängt — när work_schedule.mode === 'salon' */
export const DEFAULT_SALON_WEEK = [
  { weekday: 0, enabled: true, from: '09:00', to: '18:00' },
  { weekday: 1, enabled: true, from: '09:00', to: '18:00' },
  { weekday: 2, enabled: true, from: '09:00', to: '18:00' },
  { weekday: 3, enabled: true, from: '09:00', to: '18:00' },
  { weekday: 4, enabled: true, from: '09:00', to: '18:00' },
  { weekday: 5, enabled: true, from: '10:00', to: '15:00' },
  { weekday: 6, enabled: false, from: '09:00', to: '18:00' },
];

export const DEFAULT_LUNCH_WEEK = [
  { weekday: 0, enabled: true, from: '12:00', to: '13:00' },
  { weekday: 1, enabled: true, from: '12:00', to: '13:00' },
  { weekday: 2, enabled: true, from: '12:00', to: '13:00' },
  { weekday: 3, enabled: true, from: '12:00', to: '13:00' },
  { weekday: 4, enabled: true, from: '12:00', to: '13:00' },
  { weekday: 5, enabled: true, from: '12:00', to: '13:00' },
  { weekday: 6, enabled: false, from: '12:00', to: '13:00' },
];

const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function slotLabel(hour) {
  return `${pad2(hour)}:00`;
}

function parseHM(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/** ISO YYYY-MM-DD → veckodag 0=mån … 6=sön */
export function weekdayMonSun(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const sun0 = d.getDay();
  return sun0 === 0 ? 6 : sun0 - 1;
}

export function dayConfigForWeekday(week, wd) {
  const w = Array.isArray(week) ? week : [];
  const row = w.find((d) => d.weekday === wd);
  return row || { weekday: wd, enabled: false, from: '09:00', to: '18:00' };
}

export function mergeWeekFromSchedule(ws) {
  if (!ws || typeof ws !== 'object') return DEFAULT_SALON_WEEK;
  if (ws.mode === 'custom' && Array.isArray(ws.days) && ws.days.length) {
    return ws.days.map((d) => ({
      weekday: typeof d.weekday === 'number' ? d.weekday : 0,
      enabled: Boolean(d.enabled),
      from: typeof d.from === 'string' ? d.from : '09:00',
      to: typeof d.to === 'string' ? d.to : '18:00',
    }));
  }
  return DEFAULT_SALON_WEEK;
}

function mergeLunchFromSchedule(ws) {
  if (!ws || typeof ws !== 'object') {
    return { enabled: true, days: DEFAULT_LUNCH_WEEK };
  }
  const lunch = ws.lunch;
  if (!lunch || typeof lunch !== 'object') {
    return { enabled: true, days: DEFAULT_LUNCH_WEEK };
  }
  const enabled = lunch.enabled !== false;
  const days = Array.isArray(lunch.days) && lunch.days.length ? lunch.days : DEFAULT_LUNCH_WEEK;
  return {
    enabled,
    days: days.map((d) => ({
      weekday: typeof d.weekday === 'number' ? d.weekday : 0,
      enabled: Boolean(d.enabled),
      from: typeof d.from === 'string' ? d.from : '12:00',
      to: typeof d.to === 'string' ? d.to : '13:00',
    })),
  };
}

/** Timmar som är bokningsbara enligt arbetsdag (heltimmar). */
export function slotsForWorkDay(dayRow, lunchRow, lunchEnabled) {
  if (!dayRow?.enabled) return [];
  const fromM = parseHM(dayRow.from);
  const toM = parseHM(dayRow.to);
  if (fromM == null || toM == null || toM <= fromM) return [];

  const lunchFromM =
    lunchEnabled && lunchRow?.enabled ? parseHM(lunchRow.from) : null;
  const lunchToM =
    lunchEnabled && lunchRow?.enabled ? parseHM(lunchRow.to) : null;

  const out = [];
  for (const h of SLOT_HOURS) {
    const startM = h * 60;
    if (startM < fromM || startM >= toM) continue;
    if (lunchFromM != null && lunchToM != null) {
      if (startM >= lunchFromM && startM < lunchToM) continue;
    }
    out.push(slotLabel(h));
  }
  return out;
}

function dateInRange(dateStr, start, end) {
  return dateStr >= start && dateStr <= end;
}

/** Filtrera bort slots som blockerats av engångsblock (för en given dag). */
export function applyDayBlocks(slots, dateStr, blocksForUser) {
  const list = (blocksForUser || []).filter((b) => dateInRange(dateStr, b.start_date, b.end_date));
  if (!list.length) return slots;
  return slots.filter((slot) => {
    for (const b of list) {
      if (b.time_mode === 'full_day') return false;
      const f = parseHM(b.time_from);
      const t = parseHM(b.time_to);
      const sm = parseHM(slot);
      if (f != null && t != null && sm != null && sm >= f && sm < t) return false;
    }
    return true;
  });
}

function slotHitsGoogleBusy(slot, dateStr, busyIntervals) {
  const [hh, mm] = slot.split(':').map(Number);
  const t = new Date(`${dateStr}T${pad2(hh)}:${pad2(mm || 0)}:00`);
  for (const b of busyIntervals || []) {
    const start = new Date(b.start);
    const end = new Date(b.end);
    if (t >= start && t < end) return true;
  }
  return false;
}

async function fetchGoogleBusyForStylist(stylistId, dateStr) {
  if (!stylistId || stylistId === 'any') return [];
  const { data: tokens } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', stylistId)
    .maybeSingle();
  if (!tokens) return [];
  return getBusySlots(tokens, dateStr);
}

async function fetchBookedTimes(salonId, stylistId, dateStr) {
  let q = supabase
    .from('bookings')
    .select('booking_time')
    .eq('salon_id', salonId)
    .eq('booking_date', dateStr)
    .eq('status', 'confirmed');
  if (stylistId && stylistId !== 'any') {
    q = q.eq('stylist_id', stylistId);
  }
  const { data } = await q;
  return new Set((data || []).map((b) => String(b.booking_time).slice(0, 5)));
}

async function fetchBlockedRowsForUser(userId, salonId) {
  const { data } = await supabase
    .from('stylist_blocked_days')
    .select('*')
    .eq('user_id', userId)
    .eq('salon_id', salonId);
  return data || [];
}

export async function computeSlotsForStylist({
  salonId,
  stylistId,
  dateStr,
  workSchedule: wsIn,
}) {
  let workSchedule = wsIn;
  if (workSchedule === undefined && stylistId && stylistId !== 'any') {
    const { data: u } = await supabase
      .from('users')
      .select('work_schedule')
      .eq('id', stylistId)
      .maybeSingle();
    workSchedule = u?.work_schedule;
  }

  const wd = weekdayMonSun(dateStr);
  const week = mergeWeekFromSchedule(workSchedule);
  const lunchPack = mergeLunchFromSchedule(workSchedule);
  const dayRow = dayConfigForWeekday(week, wd);
  const lunchRow = dayConfigForWeekday(lunchPack.days, wd);
  let slots = slotsForWorkDay(dayRow, lunchRow, lunchPack.enabled);

  const blocks = await fetchBlockedRowsForUser(stylistId, salonId);
  slots = applyDayBlocks(slots, dateStr, blocks);

  const googleBusy = await fetchGoogleBusyForStylist(stylistId, dateStr);
  slots = slots.filter((s) => !slotHitsGoogleBusy(s, dateStr, googleBusy));

  const booked = await fetchBookedTimes(salonId, stylistId, dateStr);
  slots = slots.filter((s) => !booked.has(s));

  return slots;
}

/** Union av tillgängliga slots när minst en stylist kan ta emot. */
export async function computeSlotsForAnyStylist({
  salonId,
  dateStr,
  staffList,
}) {
  const union = new Set();
  for (const st of staffList) {
    const slots = await computeSlotsForStylist({
      salonId,
      stylistId: st.id,
      dateStr,
      workSchedule: st.work_schedule,
    });
    slots.forEach((s) => union.add(s));
  }
  return [...union].sort();
}

export async function isDateFullyClosedForStylist({
  salonId,
  stylistId,
  dateStr,
  workSchedule,
}) {
  const slots = await computeSlotsForStylist({
    salonId,
    stylistId,
    dateStr,
    workSchedule,
  });
  return slots.length === 0;
}
