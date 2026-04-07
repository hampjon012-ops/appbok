import { Router } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabase from '../lib/supabase.js';
import { requireAuth, requireAdmin, signToken } from '../lib/auth.js';
import bcrypt from 'bcryptjs';
import { sendInviteEmail } from '../lib/email.js';

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
      .eq('role', 'staff')
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

// ── POST /api/staff/invite — Admin: skapa inbjudningslänk ───────────────────
router.post('/invite', requireAuth, requireAdmin, async (req, res) => {
  const { email } = req.body;

  try {
    const token = crypto.randomBytes(32).toString('hex');

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

// ── DELETE /api/staff/:id — Admin: ta bort personal ─────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ active: false })
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .eq('role', 'staff');

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Staff delete error:', err);
    res.status(500).json({ error: 'Kunde inte ta bort personal.' });
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

export default router;
