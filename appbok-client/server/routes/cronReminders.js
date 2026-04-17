import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { sendReminderSMS } from '../lib/sms.js';

const router = Router();

function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Verify the CRON_SECRET header to protect against unauthorized invocations. */
function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('[cron/reminders] CRON_SECRET not set — rejecting request');
    return res.status(500).json({ error: 'Cron secret not configured.' });
  }
  const provided = req.headers['x-cron-secret'];
  if (provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

/**
 * GET /api/cron/reminders
 *
 * Vercel Cron Job — runs once per hour.
 * Finds all confirmed bookings starting in ~24 hours that haven't received
 * an SMS reminder yet, sends a reminder, and marks them as sent.
 */
router.get('/', requireCronSecret, async (req, res) => {
  const supabase = getAdminClient();

  // Calculate the date window: bookings starting tomorrow (24h from now ± 30min)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const targetDateStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD
  const windowStart = new Date(tomorrow);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(tomorrow);
  windowEnd.setHours(23, 59, 59, 999);

  try {
    // Fetch bookings in the ~24h window that haven't been reminded
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, customer_phone, customer_name, booking_date, booking_time, salon_id, reminder_sent')
      .in('status', ['confirmed', 'rebooked'])
      .eq('reminder_sent', false)
      .gte('booking_date', targetDateStr)
      .lte('booking_date', targetDateStr);

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      return res.json({ message: 'No reminders to send.', sent: 0 });
    }

    // Fetch salon names for each unique salon
    const salonIds = [...new Set(bookings.map(b => b.salon_id))];
    const { data: salons } = await supabase
      .from('salons')
      .select('id, name')
      .in('id', salonIds);

    const salonMap = {};
    for (const s of salons || []) {
      salonMap[s.id] = s.name;
    }

    // Process each booking
    let sent = 0;
    let failed = 0;

    for (const booking of bookings) {
      if (!booking.customer_phone) continue;

      const phone = booking.customer_phone.trim();
      const salonName = salonMap[booking.salon_id] || 'Vår salong';

      const result = await sendReminderSMS({
        to: phone,
        salonName,
        time: booking.booking_time,
      });

      if (result) {
        // Mark reminder as sent
        await supabase
          .from('bookings')
          .update({ reminder_sent: true })
          .eq('id', booking.id);
        sent++;
      } else {
        failed++;
      }
    }

    console.log(`[cron/reminders] Sent ${sent} reminders, ${failed} failed`);
    res.json({ message: 'Reminder job complete.', sent, failed });
  } catch (err) {
    console.error('[cron/reminders] Error:', err);
    res.status(500).json({ error: 'Reminder job failed.' });
  }
});

export default router;
