import { Router } from 'express';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase.js';
import { signToken, requireAuth, withEffectiveRole } from '../lib/auth.js';
import { sendWelcomeEmail } from '../lib/email.js';
import { scrapeBokadirekt } from '../lib/bokadirektScraper.js';

const router = Router();

// ── POST /api/auth/register — Skapa admin-konto ─────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name, salonName, salonSlug, bokadirektUrl, services } = req.body;

  if (!email || !password || !name || !salonName) {
    return res.status(400).json({ error: 'Alla fält krävs (email, password, name, salonName).' });
  }

  try {
    let { data: salon, error: salonErr } = await supabase
      .from('salons')
      .insert({
        name: salonName,
        slug: (salonSlug || salonName).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        bokadirekt_url: bokadirektUrl || null,
        status: 'demo',
      })
      .select()
      .single();

    if (salonErr) {
      if (salonErr.code === '23505') return res.status(409).json({ error: 'Salongnamnet eller subdomänen är redan upptagen.' });
      
      // Fallback hantering om bokadirekt_url eller status saknas i gamla instanser:
      const m = String(salonErr?.message || salonErr?.details || '');
      const missingStatus = salonErr.code === '42703' || m.includes('does not exist') || /column.*salons|salons.*column/i.test(m);
      if (missingStatus) {
        // Försök igen utan de nya kolumnerna
        const { data: retrySalon, error: retryErr } = await supabase
          .from('salons')
          .insert({
            name: salonName,
            slug: (salonSlug || salonName).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          })
          .select()
          .single();
        if (retryErr) {
          if (retryErr.code === '23505') return res.status(409).json({ error: 'Salongnamnet eller subdomänen är redan upptagen.' });
          throw retryErr;
        }
        salon = retrySalon;
      } else {
        throw salonErr;
      }
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

    // 2.5: Skapa tjänster om de skickades med
    if (services && Array.isArray(services) && services.length > 0) {
      const validServices = services.filter(s => s.name && s.price_amount >= 0 && s.duration_minutes > 0);
      if (validServices.length > 0) {
        // Skapa en standardkategori
        const { data: cat } = await supabase
          .from('categories')
          .insert({ salon_id: salon.id, name: 'Våra Tjänster', sort_order: 1 })
          .select('id')
          .single();

        if (cat) {
          // Förbered tjänstobjekten
          const svcRows = validServices.map((s, index) => ({
            salon_id: salon.id,
            category_id: cat.id,
            name: s.name,
            price_amount: s.price_amount,
            price_label:
              s.price_label ||
              `${Math.round(Number(s.price_amount) / 100)} kr`,
            duration_minutes: s.duration_minutes,
            duration: s.duration || `${s.duration_minutes} min`,
            sort_order: index + 1,
            active: true
          }));

          await supabase.from('services').insert(svcRows);
        }
      }
    }

    // 2.6: Auto-importera från Bokadirekt om URL angavs
    if (bokadirektUrl && typeof bokadirektUrl === 'string' && bokadirektUrl.includes('bokadirekt.se')) {
      (async () => {
        try {
          const result = await scrapeBokadirekt(bokadirektUrl);
          const { categories } = result;
          if (!categories || categories.length === 0) return;

          const { data: cats, error: catsErr } = await supabase
            .from('categories')
            .select('id, name')
            .eq('salon_id', salon.id);
          if (catsErr) throw catsErr;

          const catMap = {};
          if (cats) {
            cats.forEach((c) => {
              catMap[c.name.toLowerCase()] = c.id;
            });
          }

          for (const cat of categories) {
            let catId = catMap[cat.name.toLowerCase()];
            if (!catId) {
              const { data: newCat, error: newCatErr } = await supabase
                .from('categories')
                .insert({ salon_id: salon.id, name: cat.name, sort_order: 999 })
                .select('id')
                .single();
              if (newCatErr) throw newCatErr;
              if (newCat) catId = newCat.id;
            }
            if (!catId) continue;

            for (const svc of cat.services) {
              if (!svc.name || svc.price_amount === 0) continue;
              await supabase.from('services').insert({
                salon_id: salon.id,
                category_id: catId,
                name: svc.name,
                price_amount: svc.price_amount,
                price_label:
                  svc.price_label || `${(svc.price_amount / 100).toLocaleString('sv-SE')} kr`,
                duration_minutes: svc.duration_minutes || 60,
                duration: svc.duration || `${svc.duration_minutes || 60} min`,
                sort_order: 999,
                active: true,
              });
            }
          }
        } catch (err) {
          console.warn('[register] Bokadirekt import failed:', err.message);
        }
      })();
    }

    // 3. Returnera JWT
    const token = signToken(user);
    const demoUrl = `https://${salon.slug}.appbok.se`;

    // 4. Skicka välkomstmail (asynkront, blockera inte registration)
    sendWelcomeEmail({
      to: email.toLowerCase(),
      salonName: salon.name,
      adminUrl: demoUrl.replace('.appbok.se', '.appbok.se/admin'),
      demoUrl,
    }).catch(err => console.warn('[register] welcome email failed:', err.message));

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      salon: { id: salon.id, name: salon.name, slug: salon.slug },
      demoUrl,
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
