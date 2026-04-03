import { Router } from 'express';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase.js';
import { signToken, requireAuth, withEffectiveRole } from '../lib/auth.js';

const router = Router();

// ── POST /api/auth/register — Skapa admin-konto ─────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name, salonName, salonSlug } = req.body;

  if (!email || !password || !name || !salonName) {
    return res.status(400).json({ error: 'Alla fält krävs (email, password, name, salonName).' });
  }

  try {
    // 1. Skapa salong
    const { data: salon, error: salonErr } = await supabase
      .from('salons')
      .insert({
        name: salonName,
        slug: (salonSlug || salonName).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      })
      .select()
      .single();

    if (salonErr) {
      if (salonErr.code === '23505') return res.status(409).json({ error: 'Salongnamnet är redan taget.' });
      throw salonErr;
    }

    // 2. Skapa admin-användare
    const passwordHash = await bcrypt.hash(password, 10);
    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        salon_id: salon.id,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name,
        role: 'admin',
        title: 'Salongägare',
      })
      .select()
      .single();

    if (userErr) throw userErr;

    // 3. Returnera JWT
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      salon: { id: salon.id, name: salon.name, slug: salon.slug },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Kunde inte skapa konto.' });
  }
});

// ── POST /api/auth/login — Admin inloggning ──────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-post och lösenord krävs.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*, salons(id, name, slug)')
      .eq('email', email.toLowerCase())
      .in('role', ['admin', 'staff', 'superadmin'])
      .eq('active', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Fel e-post eller lösenord.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Fel e-post eller lösenord.' });
    }

    const effective = withEffectiveRole(user);
    const token = signToken(user);
    res.json({
      token,
      user: { id: effective.id, email: effective.email, name: effective.name, role: effective.role },
      salon: user.salons || { id: null, name: 'Appbok', slug: null },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Inloggning misslyckades.' });
  }
});

// ── GET /api/auth/me — Hämta inloggad användare ─────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, title, photo_url, salon_id, salons(id, name, slug)')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'Användare ej hittad.' });

    const effective = withEffectiveRole(user);
    res.json({
      user: {
        ...user,
        role: effective.role,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Kunde inte hämta användardata.' });
  }
});

export default router;
