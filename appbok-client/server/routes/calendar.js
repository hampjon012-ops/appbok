import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import {
  isConfigured,
  getConsentUrl,
  getTokensFromCode,
  getBusySlots,
  createCalendarEvent,
  deleteCalendarEvent,
} from '../lib/google.js';

const router = Router();

/** Superadmin som tittar på en stylists vy ska se/koppla den stylists kalender, inte sin egen. */
function calendarUserId(req) {
  if (req.user?.role === 'superadmin' && req.user?.impersonateStaffId) {
    return req.user.impersonateStaffId;
  }
  return req.user.id;
}

// ── GET /api/calendar/status ─────────────────────────────────────────────────
// Check if Google Calendar is configured + if the current user has connected
router.get('/status', requireAuth, async (req, res) => {
  if (!isConfigured()) {
    return res.json({ configured: false, connected: false });
  }

  const uid = calendarUserId(req);
  const { data } = await supabase
    .from('calendar_tokens')
    .select('id, expires_at')
    .eq('user_id', uid)
    .single();

  res.json({
    configured: true,
    connected: !!data,
    expiresAt: data?.expires_at || null,
  });
});

// ── GET /api/calendar/connect ────────────────────────────────────────────────
// Redirect stylist to Google consent screen
router.get('/connect', requireAuth, (_req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Google Calendar ej konfigurerat.' });
  }
  const url = getConsentUrl(calendarUserId(_req));
  res.json({ url });
});

// ── GET /api/calendar/callback ───────────────────────────────────────────────
// Google redirects here after consent — save tokens to DB
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code || !userId) {
    return res.status(400).send('Saknar code eller userId.');
  }

  try {
    const tokens = await getTokensFromCode(code);

    // Upsert: update if exists, insert if not
    const { error } = await supabase
      .from('calendar_tokens')
      .upsert({
        user_id:       userId,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at:    new Date(tokens.expiry_date).toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Failed to save calendar tokens:', error);
      return res.status(500).send('Kunde inte spara kalenderkoppling.');
    }

    // Redirect user back to admin dashboard
    res.redirect('http://localhost:5173/admin?calendar=connected');
  } catch (err) {
    console.error('Google Calendar callback error:', err.message);
    res.status(500).send('Kunde inte slutföra Google-koppling.');
  }
});

// ── GET /api/calendar/disconnect ─────────────────────────────────────────────
// Remove stored Google tokens for current user
router.get('/disconnect', requireAuth, async (req, res) => {
  const uid = calendarUserId(req);
  await supabase
    .from('calendar_tokens')
    .delete()
    .eq('user_id', uid);

  res.json({ ok: true });
});

// ── GET /api/calendar/busy?stylist_id=...&date=YYYY-MM-DD ────────────────────
// Public: fetch busy slots for a stylist (used by booking page for availability)
router.get('/busy', async (req, res) => {
  const { stylist_id, date } = req.query;
  if (!stylist_id || !date) {
    return res.status(400).json({ error: 'stylist_id och date krävs.' });
  }

  // If stylist_id is "any", return no busy slots (any stylist)
  if (stylist_id === 'any') {
    return res.json({ busy: [] });
  }

  // Fetch tokens for the stylist
  const { data: tokens } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', stylist_id)
    .single();

  // No Google Calendar connected → no external busy slots
  if (!tokens) {
    return res.json({ busy: [], calendarConnected: false });
  }

  const busySlots = await getBusySlots(tokens, date);
  res.json({ busy: busySlots, calendarConnected: true });
});

// ── POST /api/calendar/event ─────────────────────────────────────────────────
// Create a calendar event when booking is confirmed
router.post('/event', requireAuth, async (req, res) => {
  const { stylistId, summary, description, date, time, durationMinutes } = req.body;

  if (!stylistId || stylistId === 'any') {
    return res.json({ eventId: null, message: 'Ingen specifik stylist vald.' });
  }

  const { data: tokens } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', stylistId)
    .single();

  if (!tokens) {
    return res.json({ eventId: null, message: 'Stylist har inte kopplat kalender.' });
  }

  const event = await createCalendarEvent(tokens, {
    summary,
    description,
    date,
    time,
    durationMinutes: durationMinutes || 60,
  });

  res.json({ eventId: event?.id || null });
});

// ── DELETE /api/calendar/event/:eventId ──────────────────────────────────────
router.delete('/event/:eventId', requireAuth, async (req, res) => {
  const { stylistId } = req.body;
  if (!stylistId) return res.json({ ok: false });

  const { data: tokens } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', stylistId)
    .single();

  if (!tokens) return res.json({ ok: false });

  const ok = await deleteCalendarEvent(tokens, req.params.eventId);
  res.json({ ok });
});

export default router;
