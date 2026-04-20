import { Router } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabase from '../lib/supabase.js';
import { requireAuth, requireAdmin, requireScheduleEditor, signToken } from '../lib/auth.js';
import bcrypt from 'bcryptjs';
import { sendInviteEmail } from '../lib/email.js';
import { sendBlockedDaySMS, isSmsConfigured } from '../lib/sms.js';
import { buildRebookPublicUrl } from '../lib/rebookUrl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const router = Router();

// ── GET /api/staff?salon_id=... — Publik: lista stylister ───────────────────
router.get('/', async (req, res) => {
  const { salon_id, slug } = req.query;

  try {
    let salonId = typeof salon_id === 'string' ? salon_id.trim() : salon_id;
    if (!salonId && !slug) {
      return res.status(400).json({ error: 'Ange salon_id eller slug.' });
    }
    if (!salonId && slug) {
      const { data: salon } = await supabase.from('salons').select('id').eq('slug', slug).single();
      if (!salon) return res.status(404).json({ error: 'Salong ej hittad.' });
      salonId = salon.id;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, name, title, photo_url')
      .eq('salon_id', salonId)
      .in('role', ['staff', 'admin'])
      .eq('active', true)
      .order('created_at');

    if (error) throw error;

    // Add a "Valfri stylist" option
    const stylists = [
      ...(data || []),
      { id: 'any', name: 'Valfri stylist', title: 'Bästa tillgängliga tid', photo_url: '' },
    ];

    res.json(stylists);
  } catch (err) {
    console.error('Staff list error:', err);
    res.status(500).json({ error: 'Kunde inte hämta personal.' });
  }
});

// ── GET /api/staff/list — Admin: hela personalen; staff: bara sig själv (schema) ─
router.get('/list', requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    if (role === 'staff') {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, title, photo_url, active, work_schedule')
        .eq('id', req.user.id)
        .eq('salon_id', req.user.salonId)
        .in('role', ['staff', 'admin'])
        .maybeSingle();
      if (error) throw error;
      return res.json(data ? [data] : []);
    }
    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ error: 'Åtkomst nekad.' });
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, title, photo_url, active, work_schedule')
      .eq('salon_id', req.user.salonId)
      .in('role', ['staff', 'admin'])
      .order('name');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Staff list:', err);
    res.status(500).json({ error: 'Kunde inte hämta personal.' });
  }
});

// ── POST /api/staff/invite — Admin: skapa inbjudningslänk ───────────────────
router.post('/invite', requireAuth, requireAdmin, async (req, res) => {
  const { email } = req.body;

  try {
    const token = randomBytes(32).toString('hex');

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        salon_id: req.user.salonId,
        email: email || null,
        token,
        role: 'staff',
      })
      .select()
      .single();

    if (error) throw error;

    const baseUrl = (() => {
      if (process.env.PUBLIC_APP_URL) {
        try {
          return new URL(process.env.PUBLIC_APP_URL).origin;
        } catch {
          /* fall through */
        }
      }
      if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
      return (
        process.env.APP_URL?.replace(/\/$/, '') ||
        req.headers.origin ||
        'http://localhost:5173'
      );
    })();
    const inviteUrl = `${baseUrl}/invite/${token}`;

    // Skicka inbjudningsmail om email angavs
    let emailSent = false;
    if (email) {
      const { data: salon } = await supabase
        .from('salons')
        .select('name')
        .eq('id', req.user.salonId)
        .single();

      const result = await sendInviteEmail({
        to: email,
        salonName: salon?.name || 'Appbok',
        inviteUrl,
      });
      emailSent = result.success;
    }

    res.status(201).json({
      invitation: data,
      inviteUrl,
      emailSent,
      message: email
        ? emailSent
          ? `Inbjudningsmail skickat till ${email}.`
          : `Inbjudan skapad för ${email}. Kunde inte skicka mail – dela länken manuellt.`
        : 'Öppen inbjudningslänk skapad. Dela den med din personal.',
    });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Kunde inte skapa inbjudan.' });
  }
});

// ── GET /api/staff/invite/:token — Publik: validera token och hämta salong ───
router.get('/invite/:token', async (req, res) => {
  try {
    const { data: inv, error } = await supabase
      .from('invitations')
      .select('salons(name)')
      .eq('token', req.params.token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !inv) {
      return res.status(404).json({ error: 'Inbjudan är ogiltig eller har gått ut.' });
    }

    res.json({ valid: true, salonName: inv.salons.name });
  } catch (err) {
    console.error('Invite validation error:', err);
    res.status(500).json({ error: 'Systemfel vid validering av inbjudan.' });
  }
});

// ── POST /api/staff/invite/:token/register — Publik: Registrera staff ────────
router.post('/invite/:token/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Alla fält krävs (name, email, password).' });
  }

  try {
    // 1. Validate token
    const { data: inv, error: invErr } = await supabase
      .from('invitations')
      .select('id, salon_id')
      .eq('token', req.params.token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (invErr || !inv) {
      return res.status(400).json({ error: 'Ogiltig inbjudningslänk.' });
    }

    // 2. Hash password and insert user
    const passwordHash = await bcrypt.hash(password, 10);
    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        salon_id: inv.salon_id,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name,
        role: 'staff',
        title: 'Stylist',
      })
      .select('*, salons!inner(id, name, slug)')
      .single();

    if (userErr) {
      if (userErr.code === '23505') return res.status(409).json({ error: 'E-postadressen används redan.' });
      throw userErr;
    }

    // 3. Mark invitation as used
    await supabase.from('invitations').update({ used: true }).eq('id', inv.id);

    // 4. Return token and user data
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      salon: user.salons,
    });
  } catch (err) {
    console.error('Staff registration error:', err);
    res.status(500).json({ error: 'Kunde inte registrera kontot.' });
  }
});

// ── GET /api/staff/:id/schedule — Admin eller egen staff: schema + blockeringar
router.get('/:id/schedule', requireAuth, requireScheduleEditor, async (req, res) => {
  try {
    const { data: row, error } = await supabase
      .from('users')
      .select('id, salon_id, role, work_schedule')
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .in('role', ['staff', 'admin'])
      .maybeSingle();

    if (error) throw error;
    if (!row) return res.status(404).json({ error: 'Personal hittades inte.' });

    const { data: blocks } = await supabase
      .from('stylist_blocked_days')
      .select('*')
      .eq('user_id', req.params.id)
      .order('start_date', { ascending: true });

    res.json({ work_schedule: row.work_schedule, blocked_days: blocks || [] });
  } catch (err) {
    console.error('GET staff schedule:', err);
    res.status(500).json({ error: 'Kunde inte hämta schema.' });
  }
});

// ── PUT /api/staff/:id/schedule — Admin eller egen staff: spara arbetstider + lunch
router.put('/:id/schedule', requireAuth, requireScheduleEditor, async (req, res) => {
  const { mode, days, lunch } = req.body;
  try {
    const { data: row, error: findErr } = await supabase
      .from('users')
      .select('id, salon_id, role')
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .in('role', ['staff', 'admin'])
      .maybeSingle();

    if (findErr) throw findErr;
    if (!row) return res.status(404).json({ error: 'Personal hittades inte.' });

    const work_schedule =
      mode === 'custom' && Array.isArray(days) && days.length === 7
        ? { mode: 'custom', days, lunch: lunch && typeof lunch === 'object' ? lunch : { enabled: false, days: [] } }
        : { mode: 'salon', days: [], lunch: lunch && typeof lunch === 'object' ? lunch : { enabled: false, days: [] } };

    const { error: upErr } = await supabase
      .from('users')
      .update({ work_schedule })
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId);

    if (upErr) throw upErr;
    res.json({ ok: true, work_schedule });
  } catch (err) {
    console.error('PUT staff schedule:', err);
    res.status(500).json({ error: 'Kunde inte spara schema.' });
  }
});

// ── POST /api/staff/:id/blocked-days — Admin eller egen staff: blockeringar ─
router.post('/:id/blocked-days', requireAuth, requireScheduleEditor, async (req, res) => {
  const { action } = req.body || {};
  try {
    const { data: row, error: findErr } = await supabase
      .from('users')
      .select('id, salon_id, role')
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .in('role', ['staff', 'admin'])
      .maybeSingle();

    if (findErr) throw findErr;
    if (!row) return res.status(404).json({ error: 'Personal hittades inte.' });

    if (action === 'remove') {
      const blockId = req.body?.id;
      if (!blockId) return res.status(400).json({ error: 'id krävs.' });
      const { error: delErr } = await supabase
        .from('stylist_blocked_days')
        .delete()
        .eq('id', blockId)
        .eq('user_id', req.params.id)
        .eq('salon_id', req.user.salonId);
      if (delErr) throw delErr;
      return res.json({ ok: true });
    }

    if (action === 'add') {
      const { start_date, end_date, block_type, time_mode, time_from, time_to } = req.body;
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date och end_date krävs.' });
      }
      const bt = ['sick', 'vacation', 'other'].includes(block_type) ? block_type : 'other';
      const tm = time_mode === 'range' ? 'range' : 'full_day';
      const insert = {
        user_id: req.params.id,
        salon_id: req.user.salonId,
        start_date: String(start_date).slice(0, 10),
        end_date: String(end_date).slice(0, 10),
        block_type: bt,
        time_mode: tm,
        time_from: tm === 'range' && time_from ? time_from : null,
        time_to: tm === 'range' && time_to ? time_to : null,
      };
      const { data: created, error: insErr } = await supabase
        .from('stylist_blocked_days')
        .insert(insert)
        .select()
        .single();
      if (insErr) throw insErr;
      return res.status(201).json(created);
    }

    return res.status(400).json({ error: 'Ogiltig action (add eller remove).' });
  } catch (err) {
    console.error('POST blocked-days:', err);
    res.status(500).json({ error: 'Kunde inte uppdatera blockeringar.' });
  }
});

// ── POST /api/staff/:id/notify-blocked-day — Skicka SMS till kunder vid blockering ─
router.post('/:id/notify-blocked-day', requireAuth, requireScheduleEditor, async (req, res) => {
  const { date, block_type } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date krävs (ÅÅÅÅ-MM-DD).' });

  try {
    const { data: stylist, error: styErr } = await supabase
      .from('users')
      .select('id, name, salon_id')
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .in('role', ['staff', 'admin'])
      .maybeSingle();
    if (styErr) throw styErr;
    if (!stylist) return res.status(404).json({ error: 'Personal hittades inte.' });

    const { data: salonRow } = await supabase
      .from('salons')
      .select('name, slug')
      .eq('id', stylist.salon_id)
      .maybeSingle();
    const salonName = salonRow?.name || 'vår salong';
    const salonSlug = salonRow?.slug || '';
    const stylistName = stylist.name || 'din stylist';

    const twilioOk = isSmsConfigured();

    // Bekräftade/ombokade bokningar som inte redan markerats vid tidigare block-notis
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, booking_date, booking_time, customer_name, customer_phone')
      .eq('stylist_id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .eq('booking_date', String(date).slice(0, 10))
      .in('status', ['confirmed', 'rebooked'])
      .eq('blocked_affects_booking', false);
    if (bErr) throw bErr;

    if (!bookings?.length) {
      return res.json({
        sent: 0,
        total: 0,
        twilio_configured: twilioOk,
        message: 'Inga kunder behöver informeras (inga bokningar den dagen).',
      });
    }

    if (!twilioOk) {
      console.warn('[notify-blocked-day] TWILIO_* saknas eller är placeholder — inga SMS skickas.');
      return res.json({
        sent: 0,
        total: bookings.length,
        twilio_configured: false,
        hint: 'SMS är inte konfigurerat. Sätt TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN och TWILIO_SENDER_ID i server/.env (och på Vercel).',
        results: bookings.map((b) => ({
          id: b.id,
          customer: b.customer_name,
          sent: false,
          reason: 'twilio_not_configured',
        })),
      });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const results = await Promise.all(
      bookings.map(async (b) => {
        const phone = String(b.customer_phone || '').trim();
        if (!phone) {
          console.warn(`[notify-blocked-day] bokning ${b.id} saknar telefon — hoppar över SMS`);
          return {
            id: b.id,
            customer: b.customer_name,
            sent: false,
            reason: 'no_phone',
          };
        }

        const token = randomUUID();
        const rebookUrl = buildRebookPublicUrl(salonSlug, token, b.booking_date, req.params.id);
        const { error: upErr } = await supabase
          .from('bookings')
          .update({
            rebook_token: token,
            rebook_expires_at: expiresAt,
            blocked_affects_booking: true,
          })
          .eq('id', b.id);
        if (upErr) {
          console.error('[notify-blocked-day] token save:', upErr);
          return {
            id: b.id,
            customer: b.customer_name,
            sent: false,
            reason: 'db_error',
            detail: upErr.message,
          };
        }

        const sid = await sendBlockedDaySMS({
          to: phone,
          customerName: b.customer_name,
          salonName,
          date: b.booking_date,
          time: String(b.booking_time).slice(0, 5),
          stylistName,
          block_type: block_type || 'other',
          rebookUrl,
        });
        if (!sid) {
          return { id: b.id, customer: b.customer_name, sent: false, reason: 'sms_send_failed' };
        }
        return { id: b.id, customer: b.customer_name, sent: true, reason: null };
      }),
    );

    const sentCount = results.filter((r) => r.sent).length;
    console.log(`[notify-blocked-day] ${sentCount}/${results.length} SMS skickade för stylist ${req.params.id} datum ${date}`);
    res.json({
      sent: sentCount,
      total: results.length,
      twilio_configured: true,
      results,
    });
  } catch (err) {
    const detail = err?.message || String(err);
    console.error('POST notify-blocked-day:', err);
    let hint;
    if (/blocked_affects_booking|rebook_token|rebook_expires|column .* does not exist/i.test(detail)) {
      hint =
        'Databasen saknar kolumner. Kör migration 014 och 015 (appbok-client/server/migrations/) mot din Postgres och starta om API.';
    }
    res.status(500).json({
      error: 'Kunde inte skicka meddelanden.',
      detail,
      hint,
    });
  }
});

// ── DELETE /api/staff/:id — Admin: ta bort personal ─────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ active: false })
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .in('role', ['staff', 'admin']);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Staff delete error:', err);
    res.status(500).json({ error: 'Kunde inte ta bort personal.' });
  }
});

export default router;
