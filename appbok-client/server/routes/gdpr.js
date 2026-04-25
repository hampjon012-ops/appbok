import { Router } from 'express';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import supabase from '../lib/supabase.js';

const router = Router();

// ── GET /api/gdpr/export ──────────────────────────────────────────────────────
// Customer data export (GDPR Article 15).
router.get('/export', requireAuth, async (req, res) => {
  const { email, booking_id: bookingId } = req.query;

  if (!email && !bookingId) {
    return res.status(400).json({ error: 'Ange email eller booking_id som query-param.' });
  }

  let customerEmail = email;

  // Look up by booking ID first
  if (bookingId && !customerEmail) {
    const { data: bk } = await supabase
      .from('bookings')
      .select('customer_email, customer_phone, customer_name, salon_id')
      .eq('id', bookingId)
      .maybeSingle();
    if (bk?.customer_email) customerEmail = bk.customer_email;
  }

  if (!customerEmail) {
    return res.json({ customer: null, bookings: [], exported_at: new Date().toISOString() });
  }

  // Find all bookings for this customer (across all salons they may have visited)
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_date,
      booking_time,
      status,
      marketing_consent,
      consent_sms_at,
      services:service_id(name),
      stylist:users!bookings_stylist_id_fkey(name)
    `)
    .eq('customer_email', customerEmail)
    .order('booking_date', { ascending: false });

  const customerName = bookings?.[0]?.customer_name || '';
  const phone = bookings?.[0]?.customer_phone || '';

  res.json({
    customer: { name: customerName, email: customerEmail, phone },
    bookings: (bookings || []).map((b) => ({
      date: b.booking_date,
      time: b.booking_time,
      service: b.services?.name || '—',
      stylist: b.stylist?.name || 'Valfri',
      status: b.status,
      marketing_consent: b.marketing_consent,
      consent_sms_at: b.consent_sms_at,
    })),
    exported_at: new Date().toISOString(),
  });
});

// ── POST /api/gdpr/anonymize ────────────────────────────────────────────────
// Anonymize a customer's personal data (GDPR Article 17).
router.post('/anonymize', requireAuth, requireAdmin, async (req, res) => {
  const { booking_id: bookingId, reason = 'customer_request' } = req.body || {};

  if (!bookingId) {
    return res.status(400).json({ error: 'booking_id saknas.' });
  }

  // Look up the booking to get salon_id and customer identifiers
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, salon_id, customer_email, customer_name')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return res.status(404).json({ error: 'Bokningen hittades inte.' });
  }

  if (!booking.customer_email) {
    return res.status(422).json({ error: 'Bokningen har inget e-post och kan inte anonymiseras.' });
  }

  const hash = booking.customer_email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 12);
  const anonymousEmail = `deleted_${hash}@anonymized.appbok`;
  const anonymousName = '[Raderad]';

  // Anonymize all bookings sharing the same customer_email
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      customer_name: anonymousName,
      customer_email: anonymousEmail,
      customer_phone: null,
      notes: null,
      marketing_consent: false,
    })
    .eq('customer_email', booking.customer_email);

  if (updateError) {
    console.error('[gdpr/anonymize]', updateError);
    return res.status(500).json({ error: 'Kunde inte anonymisera kunduppgifter.' });
  }

  // Log to audit table
  const { error: auditError } = await supabase
    .from('gdpr_anonymizations')
    .insert({
      salon_id: booking.salon_id,
      booking_id: booking.id,
      reason,
    });

  if (auditError) {
    console.error('[gdpr/anonymize] audit log failed:', auditError);
  }

  res.json({ ok: true, message: 'Kunduppgifter har anonymiserats.' });
});

export default router;
