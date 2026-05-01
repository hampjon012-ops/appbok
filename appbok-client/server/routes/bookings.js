import { Router } from 'express';
import Stripe from 'stripe';
import supabase from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { createCalendarEvent, deleteCalendarEvent } from '../lib/google.js';
import { publicAppOrigin } from '../lib/publicAppOrigin.js';
import { sendBookingConfirmationEmail, sendCancellationEmail, sendCancellationNotificationEmail, sendStylistNotificationEmail } from '../lib/email.js';
import { sendBookingSMS, sendCancellationSMS, sendRebookConfirmationSMS } from '../lib/sms.js';
import { computeSlotsForStylist, salonWeekFromContact } from '../lib/stylistAvailability.js';
import { loadSalonMaybeExpire } from '../lib/expireTrialSalon.js';
import { salonAcceptsPublicBookings, SALON_PREVIEW_FORBIDDEN_MESSAGE } from '../lib/salonPublicBookingGate.js';

const router = Router();

// ── GET /api/bookings — Lista bokningar ──────────────────────────────────────
// Admin ser alla, staff ser bara sina
router.get('/', requireAuth, async (req, res) => {
  const { status, date_from, date_to, stylist_id, search } = req.query;

  try {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        services(name, price_label, price_amount, duration, duration_minutes),
        stylist:users!bookings_stylist_id_fkey(id, name, title, photo_url)
      `)
      .eq('salon_id', req.user.salonId)
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: true });

    // Staff ser bara sina egna bokningar; superadmin som impersonerar stylist också
    if (req.user.role === 'staff') {
      query = query.eq('stylist_id', req.user.id);
    } else if (req.user.role === 'superadmin' && req.user.impersonateStaffId) {
      query = query.eq('stylist_id', req.user.impersonateStaffId);
    }

    // Filtrera på stylist (admin)
    if (stylist_id && req.user.role === 'admin') {
      query = query.eq('stylist_id', stylist_id);
    }

    // Filtrera på status
    if (status) query = query.eq('status', status);

    // Datumintervall
    if (date_from) query = query.gte('booking_date', date_from);
    if (date_to) query = query.lte('booking_date', date_to);

    // Fritextsökning på kund
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `customer_name.ilike.${term},customer_email.ilike.${term},customer_phone.ilike.${term}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Bookings list error:', err);
    res.status(500).json({ error: 'Kunde inte hämta bokningar.' });
  }
});

// ── GET /api/bookings/available — Public: booked times for a stylist on a date
router.get('/available', async (req, res) => {
  const { stylist_id, date } = req.query;
  if (!stylist_id || !date) {
    return res.status(400).json({ error: 'stylist_id och date krävs.' });
  }

  try {
    let query = supabase
      .from('bookings')
      .select('booking_time')
      .eq('booking_date', date)
      .in('status', ['confirmed', 'rebooked']);

    // If a specific stylist, filter by them
    if (stylist_id !== 'any') {
      query = query.eq('stylist_id', stylist_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const booked = (data || []).map(b => b.booking_time);
    res.json({ booked });
  } catch (err) {
    console.error('Availability check error:', err);
    res.json({ booked: [] });
  }
});

// ── GET /api/bookings/rebook/lookup — Publik: bokning + salong för ombokningssida ─
router.get('/rebook/lookup', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token krävs.' });
  }

  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(
        'id, salon_id, service_id, stylist_id, customer_name, booking_date, booking_time, duration_minutes, status, rebook_expires_at',
      )
      .eq('rebook_token', token.trim())
      .maybeSingle();

    if (error) throw error;
    if (!booking) {
      return res.status(404).json({ error: 'Länken är ogiltig eller har gått ut.' });
    }
    if (!booking.rebook_expires_at || new Date(booking.rebook_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Länken har gått ut. Kontakta salongen.' });
    }
    if (!['confirmed', 'rebooked'].includes(booking.status)) {
      return res.status(409).json({ error: 'Bokningen kan inte ombokas.' });
    }

    const [{ data: salon }, { data: svc }, { data: st }] = await Promise.all([
      supabase.from('salons').select('name, slug').eq('id', booking.salon_id).maybeSingle(),
      booking.service_id
        ? supabase.from('services').select('name').eq('id', booking.service_id).maybeSingle()
        : Promise.resolve({ data: null }),
      booking.stylist_id
        ? supabase.from('users').select('id, name').eq('id', booking.stylist_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    res.json({
      booking: {
        id: booking.id,
        salon_id: booking.salon_id,
        service_id: booking.service_id,
        stylist_id: booking.stylist_id,
        customer_name: booking.customer_name,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        duration_minutes: booking.duration_minutes,
      },
      salon: salon || {},
      service: svc || {},
      stylist: st || {},
    });
  } catch (err) {
    console.error('rebook/lookup:', err);
    res.status(500).json({ error: 'Kunde inte hämta bokningen.' });
  }
});

// ── POST /api/bookings/rebook — Publik: omboka med token ─────────────────────
router.post('/rebook', async (req, res) => {
  const { token, new_stylist_id, new_date, new_time } = req.body || {};
  if (!token || !new_stylist_id || !new_date || !new_time) {
    return res.status(400).json({ error: 'token, new_stylist_id, new_date och new_time krävs.' });
  }

  const dateStr = String(new_date).slice(0, 10);
  const timeRaw = String(new_time);
  const timeStr = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : timeRaw;
  const timeDb = timeStr.length === 5 ? `${timeStr}:00` : timeRaw;

  try {
    const { data: booking, error: findErr } = await supabase
      .from('bookings')
      .select(
        'id, salon_id, service_id, stylist_id, customer_name, customer_phone, booking_date, booking_time, duration_minutes, status, google_event_id, rebook_token, rebook_expires_at',
      )
      .eq('rebook_token', String(token).trim())
      .maybeSingle();

    if (findErr) throw findErr;
    if (!booking) {
      return res.status(404).json({ error: 'Ogiltig länk.' });
    }
    if (!booking.rebook_expires_at || new Date(booking.rebook_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Länken har gått ut.' });
    }

    const salonRow = await loadSalonMaybeExpire(booking.salon_id);
    if (salonRow?.status === 'deleted') {
      return res.status(403).json({
        error: 'Denna salong är inte längre aktiv. Ombokning är inte möjlig.',
      });
    }
    if (salonRow?.status === 'expired') {
      return res.status(403).json({
        error: 'Denna salongs testperiod är avslutad. Ombokning är inte möjlig.',
      });
    }
    if (!salonAcceptsPublicBookings(salonRow?.status)) {
      return res.status(403).json({
        error: SALON_PREVIEW_FORBIDDEN_MESSAGE,
        code: 'SALON_PREVIEW',
      });
    }

    const { data: newStylist, error: stErr } = await supabase
      .from('users')
      .select('id, salon_id, name, work_schedule')
      .eq('id', new_stylist_id)
      .eq('salon_id', booking.salon_id)
      .eq('role', 'staff')
      .maybeSingle();
    if (stErr) throw stErr;
    if (!newStylist) {
      return res.status(400).json({ error: 'Stylist hittades inte i salongen.' });
    }

    const salonSchedule = salonWeekFromContact(salonRow?.contact);
    const slots = await computeSlotsForStylist({
      salonId: booking.salon_id,
      stylistId: new_stylist_id,
      dateStr,
      workSchedule: newStylist.work_schedule,
      salonSchedule,
    });
    const slotOk = slots.some((s) => String(s).slice(0, 5) === timeStr);
    if (!slotOk) {
      return res.status(400).json({ error: 'Tiden är inte tillgänglig.' });
    }

    const { data: clash } = await supabase
      .from('bookings')
      .select('id')
      .eq('stylist_id', new_stylist_id)
      .eq('booking_date', dateStr)
      .eq('booking_time', timeDb)
      .in('status', ['confirmed', 'rebooked'])
      .neq('id', booking.id)
      .maybeSingle();
    if (clash) {
      return res.status(409).json({ error: 'Tiden är redan bokad.' });
    }

    const oldStylistId = booking.stylist_id;
    const oldEventId = booking.google_event_id;

    if (oldEventId && oldStylistId) {
      try {
        const { data: oldTok } = await supabase
          .from('calendar_tokens')
          .select('*')
          .eq('user_id', oldStylistId)
          .maybeSingle();
        if (oldTok) await deleteCalendarEvent(oldTok, oldEventId);
      } catch (calErr) {
        console.warn('[rebook] delete old calendar event:', calErr?.message);
      }
    }

    const { data: updated, error: upErr } = await supabase
      .from('bookings')
      .update({
        stylist_id: new_stylist_id,
        booking_date: dateStr,
        booking_time: timeDb,
        status: 'rebooked',
        rebook_token: null,
        rebook_expires_at: null,
        google_event_id: null,
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (upErr) throw upErr;

    if (new_stylist_id && new_stylist_id !== 'any') {
      try {
        const { data: tokens } = await supabase
          .from('calendar_tokens')
          .select('*')
          .eq('user_id', new_stylist_id)
          .maybeSingle();
        if (tokens) {
          const event = await createCalendarEvent(tokens, {
            summary: `${booking.customer_name} — ${booking.id.slice(0, 8)}`,
            description: `Ombokning via Appbok\nKund: ${booking.customer_name}`,
            date: dateStr,
            time: timeDb,
            durationMinutes: booking.duration_minutes || 60,
          });
          if (event?.id) {
            await supabase.from('bookings').update({ google_event_id: event.id }).eq('id', booking.id);
          }
        }
      } catch (calErr) {
        console.warn('[rebook] calendar create:', calErr?.message);
      }
    }

    let salonName = 'Salongen';
    try {
      const { data: salon } = await supabase.from('salons').select('name').eq('id', booking.salon_id).single();
      if (salon?.name) salonName = salon.name;
    } catch {
      /* ignore */
    }

    if (booking.customer_phone && String(booking.customer_phone).trim()) {
      try {
        await sendRebookConfirmationSMS({
          to: booking.customer_phone,
          customerName: booking.customer_name,
          salonName,
          date: dateStr,
          time: timeStr,
        });
      } catch (smsErr) {
        console.warn('[rebook] SMS:', smsErr?.message);
      }
    }

    res.json({ ok: true, booking: updated });
  } catch (err) {
    console.error('POST /rebook:', err);
    res.status(500).json({ error: 'Kunde inte omboka.' });
  }
});

async function loadValidatedServicesForSalon(salonId, serviceIds) {
  if (!serviceIds.length) return { ok: false, error: 'Inga tjänster angivna.' };
  const { data, error } = await supabase
    .from('services')
    .select('id, name, price_amount, duration_minutes, price_label, duration')
    .eq('salon_id', salonId)
    .in('id', serviceIds);

  if (error) throw error;
  if (!data || data.length !== serviceIds.length) {
    return { ok: false, error: 'En eller flera tjänster finns inte för denna salong.' };
  }
  const byId = new Map(data.map((r) => [r.id, r]));
  const ordered = serviceIds.map((id) => byId.get(id)).filter(Boolean);
  if (ordered.length !== serviceIds.length) {
    return { ok: false, error: 'Ogiltig tjänstlista.' };
  }
  return { ok: true, rows: ordered };
}

function snapshotBookingServices(rows) {
  return rows.map((r) => ({
    service_id: r.id,
    name: r.name,
    price_amount: r.price_amount,
    duration_minutes: r.duration_minutes ?? 60,
    price_label: r.price_label || '',
    duration: r.duration || '',
  }));
}

// ── POST /api/bookings — Skapa bokning ──────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    salon_id,
    service_id: serviceIdBody,
    stylist_id,
    customer_name,
    customer_email,
    customer_phone,
    booking_date,
    booking_time,
    duration_minutes: durationBody,
    amount_paid: amountBody,
    stripe_session_id,
    stripe_payment_intent_id,
    notes: notesRaw,
    services: servicesPayload,
  } = req.body;

  const notes =
    typeof notesRaw === 'string' && notesRaw.trim()
      ? notesRaw.trim().slice(0, 500)
      : null;

  if (!salon_id || !customer_name || !booking_date || !booking_time) {
    return res.status(400).json({ error: 'Obligatoriska fält saknas.' });
  }

  try {
    const salon = await loadSalonMaybeExpire(salon_id);
    if (!salon) {
      return res.status(404).json({ error: 'Salong hittades inte.' });
    }
    if (salon.status === 'deleted') {
      return res.status(403).json({
        error: 'Denna salong är inte längre aktiv. Bokning är inte möjlig.',
      });
    }
    if (salon.status === 'expired') {
      return res.status(403).json({
        error: 'Denna salongs testperiod är avslutad. Bokning är inte möjlig.',
      });
    }
    if (!salonAcceptsPublicBookings(salon.status)) {
      return res.status(403).json({
        error: SALON_PREVIEW_FORBIDDEN_MESSAGE,
        code: 'SALON_PREVIEW',
      });
    }

    let service_id;
    let duration_minutes;
    let amount_paid;
    let booking_services = null;

    if (Array.isArray(servicesPayload) && servicesPayload.length > 0) {
      const ids = servicesPayload.map((s) => s?.id || s?.service_id).filter(Boolean);
      if (ids.length !== servicesPayload.length || ids.length === 0) {
        return res.status(400).json({ error: 'Ogiltig tjänstlista.' });
      }
      const validated = await loadValidatedServicesForSalon(salon_id, ids);
      if (!validated.ok) return res.status(400).json({ error: validated.error });
      booking_services = snapshotBookingServices(validated.rows);
      service_id = validated.rows[0].id;
      const sumDur = validated.rows.reduce((sum, r) => sum + (Number(r.duration_minutes) || 60), 0);
      const sumPrice = validated.rows.reduce((sum, r) => sum + (Number(r.price_amount) || 0), 0);
      duration_minutes =
        typeof durationBody === 'number' && durationBody > 0 ? durationBody : sumDur;
      amount_paid = typeof amountBody === 'number' && amountBody >= 0 ? amountBody : sumPrice;
    } else if (serviceIdBody) {
      const validated = await loadValidatedServicesForSalon(salon_id, [serviceIdBody]);
      if (!validated.ok) return res.status(400).json({ error: validated.error });
      booking_services = snapshotBookingServices(validated.rows);
      service_id = validated.rows[0].id;
      const row = validated.rows[0];
      duration_minutes =
        typeof durationBody === 'number' && durationBody > 0
          ? durationBody
          : Number(row.duration_minutes) || 60;
      amount_paid =
        typeof amountBody === 'number' && amountBody >= 0
          ? amountBody
          : Number(row.price_amount) || 0;
    } else {
      return res.status(400).json({ error: 'Välj minst en tjänst.' });
    }

    // Kontrollera dubbelbokning
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('stylist_id', stylist_id)
      .eq('booking_date', booking_date)
      .eq('booking_time', booking_time)
      .in('status', ['confirmed', 'rebooked'])
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Tiden är redan bokad.' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        salon_id,
        service_id,
        stylist_id: stylist_id === 'any' ? null : stylist_id,
        customer_name,
        customer_email: customer_email || '',
        customer_phone: customer_phone || '',
        booking_date,
        booking_time,
        duration_minutes: duration_minutes || 60,
        amount_paid: amount_paid || 0,
        stripe_session_id: stripe_session_id || null,
        stripe_payment_intent_id: stripe_payment_intent_id || null,
        notes,
        booking_services,
        status: 'confirmed',
      })
      .select()
      .single();

    if (error) throw error;

    // Create Google Calendar event for the stylist
    if (data && stylist_id && stylist_id !== 'any') {
      try {
        const { data: tokens } = await supabase
          .from('calendar_tokens')
          .select('*')
          .eq('user_id', stylist_id)
          .single();

        if (tokens) {
          const serviceLine =
            booking_services?.length > 0
              ? `\nTjänster: ${booking_services.map((x) => x.name).join(', ')}`
              : '';
          const event = await createCalendarEvent(tokens, {
            summary: `${customer_name} — ${data.id.slice(0, 8)}`,
            description: `Bokning via Appbok\nKund: ${customer_name}\nTelefon: ${customer_phone || '-'}\nE-post: ${customer_email || '-'}${
              serviceLine
            }${notes ? `\nMeddelande: ${notes}` : ''}`,
            date: booking_date,
            time: booking_time,
            durationMinutes: duration_minutes || 60,
          });

          if (event?.id) {
            await supabase
              .from('bookings')
              .update({ google_event_id: event.id })
              .eq('id', data.id);
          }
        }
      } catch (calErr) {
        console.warn('Google Calendar event create failed (non-blocking):', calErr.message);
      }
    }

    // ── Skicka e-postnotifikationer ──────────────────────────────────────────
    // Fetch service, stylist and salon info for emails
    let serviceName = 'Tjänst';
    let stylistName = 'Vald stylist';
    let stylistEmail = null;
    let salonName = 'Salongen';
    let salonSlug = undefined;
    let salonBaseUrl = '';

    try {
      if (booking_services && booking_services.length > 0) {
        serviceName = booking_services.map((x) => x.name).join(' + ');
      } else if (service_id && service_id !== 'any') {
        const { data: svc } = await supabase
          .from('services')
          .select('name')
          .eq('id', service_id)
          .single();
        if (svc) serviceName = svc.name;
      }

      // Fetch stylist name and email
      if (stylist_id && stylist_id !== 'any') {
        const { data: st } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', stylist_id)
          .single();
        if (st) {
          stylistName = st.name;
          stylistEmail = st.email;
        }
      }

      // Fetch salon name + slug for booking page links
      const { data: salon } = await supabase
        .from('salons')
        .select('name, slug')
        .eq('id', salon_id)
        .single();
      if (salon) {
        salonName = salon.name;
        salonSlug = salon.slug;
        salonBaseUrl = publicAppOrigin();
      }

      // Format price string from amount_paid
      const priceStr = amount_paid > 0
        ? `${Number(amount_paid).toLocaleString('sv-SE')} kr`
        : undefined;

      // Send confirmation email to customer
      if (customer_email) {
        await sendBookingConfirmationEmail({
          to: customer_email,
          customerName: customer_name,
          serviceName,
          stylistName,
          date: booking_date,
          time: booking_time,
          salonName,
          price: priceStr,
          bookingId: data.id,
          salonSlug,
          baseUrl: salonBaseUrl,
        });
      }

      // Send notification to stylist
      if (stylistEmail) {
        await sendStylistNotificationEmail({
          to: stylistEmail,
          stylistName,
          customerName: customer_name,
          serviceName,
          date: booking_date,
          time: booking_time,
          customerPhone: customer_phone || '-',
          salonName,
        });
      }
    } catch (emailErr) {
      // Email errors are non-blocking — booking should still succeed
      console.warn('[bookings] Email notification failed (non-blocking):', emailErr.message);
    }

    // ── Skicka SMS-bekräftelse ────────────────────────────────────────────────
    // Viktigt: await på Vercel — annars avslutas funktionen när svaret skickats och SMS hinner aldrig skickas.
    if (customer_phone && String(customer_phone).trim()) {
      try {
        await sendBookingSMS({
          to: customer_phone,
          customerName: customer_name,
          salonName,
          date: booking_date,
          time: booking_time,
          bookingId: data.id,
        });
      } catch (smsErr) {
        console.warn('[bookings] SMS notification failed (non-blocking):', smsErr?.message);
      }
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Booking create error:', err);
    res.status(500).json({ error: 'Kunde inte skapa bokning.' });
  }
});

// ── GET /api/bookings/public — Publik: hämta bokning för avbokningssida ─────────
// Ingen auth krävs — boknings-ID är UUID så det går inte att gissa/bruteforca.
router.get('/public', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_phone, customer_email, booking_date, booking_time, amount_paid, status, salon_id, stripe_payment_intent_id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Bokningen hittades inte.' });

    // Hämta tjänst + salongnamn
    let serviceName = '';
    let salonName = '';
    if (data.service_id) {
      const { data: svc } = await supabase.from('services').select('name').eq('id', data.service_id).single();
      serviceName = svc?.name || '';
    }
    if (data.salon_id) {
      const { data: s } = await supabase.from('salons').select('name').eq('id', data.salon_id).single();
      salonName = s?.name || '';
    }

    return res.json({
      ...data,
      service: { name: serviceName },
      salonName,
    });
  } catch (err) {
    console.error('[bookings/public] error:', err);
    return res.status(500).json({ error: 'Kunde inte hämta bokningen.' });
  }
});

// ── POST /api/bookings/:id/cancel — Publk avbokning via SMS-länk ────────────
router.post('/:id/cancel', async (req, res) => {
  try {
    // 1. Hämta bokningen
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*, services(name), salons(name, stripe_account_id)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!booking) return res.status(404).json({ error: 'Bokningen hittades inte.' });
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'Bokningen är redan avbokad.' });

    // 2. Säkerhetscheck: > 24 timmar kvar
    const [h, m] = (booking.booking_time || '').split(':').map(Number);
    const bookingDate = new Date(`${booking.booking_date}T00:00:00`);
    bookingDate.setHours(h || 0, m || 0, 0, 0);
    const hoursLeft = (bookingDate.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft <= 24) {
      return res.status(422).json({
        error: 'Tiden för fri avbokning online har passerat. Kontakta salongen direkt.',
      });
    }

    const salonName = booking.salons?.name || 'Salongen';
    const stripeAccountId = booking.salons?.stripe_account_id;

    // 3. Återbetala via Stripe om det finns payment_intent
    if (booking.stripe_payment_intent_id && stripeAccountId) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey && !stripeKey.includes('PLACEHOLDER')) {
          const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' });
          await stripe.refunds.create(
            { payment_intent: booking.stripe_payment_intent_id },
            { stripeAccount: stripeAccountId },
          );
          console.log('[bookings/cancel] Refund issued for payment intent:', booking.stripe_payment_intent_id);
        }
      } catch (refundErr) {
        console.error('[bookings/cancel] Refund failed (non-blocking):', refundErr?.message);
      }
    }

    // 4. Uppdatera databas
    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id);
    if (updateErr) throw updateErr;

    // 5. Radera Google Calendar-event
    if (booking.google_event_id && booking.stylist_id) {
      try {
        const { data: tokens } = await supabase
          .from('calendar_tokens')
          .select('*')
          .eq('user_id', booking.stylist_id)
          .single();
        if (tokens) await deleteCalendarEvent(tokens, booking.google_event_id);
      } catch (calErr) {
        console.warn('[bookings/cancel] Calendar delete failed (non-blocking):', calErr.message);
      }
    }

    // 6. SMS till kund
    if (booking.customer_phone) {
      sendCancellationSMS({ to: booking.customer_phone, salonName }).catch(smsErr =>
        console.warn('[bookings/cancel] Customer SMS failed:', smsErr?.message)
      );
    }

    // 7. E-post till salong (admin)
    if (booking.salon_id) {
      const { data: admins } = await supabase
        .from('users')
        .select('email')
        .eq('salon_id', booking.salon_id)
        .eq('role', 'admin')
        .maybeSingle();

      if (admins?.email) {
        sendCancellationNotificationEmail({
          to: admins.email,
          customerName: booking.customer_name,
          serviceName: booking.services?.name || 'Tjänst',
          date: booking.booking_date,
          time: booking.booking_time,
          salonName,
        }).catch(emailErr =>
          console.warn('[bookings/cancel] Salon email failed:', emailErr?.message)
        );
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[bookings/cancel] error:', err);
    return res.status(500).json({ error: 'Kunde inte avboka.' });
  }
});

// ── PATCH /api/bookings/:id/cancel — Avboka (admin, kräver auth) ─────────────
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Bokning ej hittad.' });

    // Delete Google Calendar event if exists
    if (data.google_event_id && data.stylist_id) {
      try {
        const { data: tokens } = await supabase
          .from('calendar_tokens')
          .select('*')
          .eq('user_id', data.stylist_id)
          .single();

        if (tokens) {
          await deleteCalendarEvent(tokens, data.google_event_id);
        }
      } catch (calErr) {
        console.warn('Google Calendar event delete failed (non-blocking):', calErr.message);
      }
    }

    // ── Skicka avbokningsmail till kund ──────────────────────────────────────
    if (data.customer_email) {
      try {
        // Fetch service and salon info for the email
        let serviceName = 'Tjänst';
        let salonName = 'Salongen';

        if (data.service_id) {
          const { data: svc } = await supabase
            .from('services')
            .select('name')
            .eq('id', data.service_id)
            .single();
          if (svc) serviceName = svc.name;
        }

        const { data: salon } = await supabase
          .from('salons')
          .select('name')
          .eq('id', data.salon_id)
          .single();
        if (salon) salonName = salon.name;

        await sendCancellationEmail({
          to: data.customer_email,
          customerName: data.customer_name,
          serviceName,
          date: data.booking_date,
          time: data.booking_time,
          salonName,
        });
      } catch (emailErr) {
        console.warn('[bookings] Cancellation email failed (non-blocking):', emailErr.message);
      }
    }

    res.json(data);
  } catch (err) {
    console.error('Booking cancel error:', err);
    res.status(500).json({ error: 'Kunde inte avboka.' });
  }
});

export default router;
