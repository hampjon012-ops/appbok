import { randomUUID } from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase.js';
import { signToken, requireAuth, withEffectiveRole } from '../lib/auth.js';
import { sendWelcomeEmail, sendWelcomeVerificationEmail } from '../lib/email.js';
import { adminDashboardOrigin, publicAppOrigin } from '../lib/publicAppOrigin.js';
import { scrapeBokadirekt } from '../lib/bokadirektScraper.js';

const router = Router();

const ONBOARDING_THEMES = {
  'hair-nordic-studio': {
    name: 'Nordic Studio',
    backgroundColor: '#ffffff',
    primaryAccent: '#000000',
    secondaryColor: '#f3f4f6',
    textColor: '#111827',
    backgroundImageUrl: '/images/onboarding/hair-nordic-studio.jpg',
  },
  'hair-soft-blonde': {
    name: 'Soft Blonde',
    backgroundColor: '#fffaf3',
    primaryAccent: '#9a6a3f',
    secondaryColor: '#f2e7d8',
    textColor: '#2f241b',
    backgroundImageUrl: '/images/onboarding/hair-soft-blonde.jpg',
  },
  'hair-noir-salon': {
    name: 'Noir Salon',
    backgroundColor: '#0f0f10',
    primaryAccent: '#f4f4f5',
    secondaryColor: '#1a1a1c',
    textColor: '#f8fafc',
    backgroundImageUrl: '/images/onboarding/hair-noir-salon.jpg',
  },
  'hair-barber-steel': {
    name: 'Barber Steel',
    backgroundColor: '#11100f',
    primaryAccent: '#9a5f38',
    secondaryColor: '#201c18',
    textColor: '#f7f2eb',
    backgroundImageUrl: '/images/onboarding/hair-barber-steel.jpg',
  },
  'hair-warm-walnut': {
    name: 'Warm Walnut',
    backgroundColor: '#fbf4ea',
    primaryAccent: '#7c4a2d',
    secondaryColor: '#ead9c8',
    textColor: '#2d2218',
    backgroundImageUrl: '/images/onboarding/hair-warm-walnut.jpg',
  },
  nordic: {
    name: 'Nordic Studio',
    backgroundColor: '#ffffff',
    primaryAccent: '#000000',
    secondaryColor: '#f3f4f6',
    textColor: '#111827',
    backgroundImageUrl: '/images/onboarding/hair-nordic-studio.jpg',
  },
  earthy: {
    name: 'Earthy Canvas',
    backgroundColor: '#fdfbf7',
    primaryAccent: '#78350f',
    secondaryColor: '#e7e5e4',
    textColor: '#292524',
    backgroundImageUrl: '/images/yoga1.jpg',
  },
};

const ONBOARDING_INDUSTRIES = {
  hair: {
    label: 'Frisör & Skönhet',
    defaultTheme: 'hair-warm-walnut',
    defaultBackground: '/images/onboarding/hair-warm-walnut.jpg',
  },
  barber: {
    label: 'Barberare',
    defaultTheme: 'hair-barber-steel',
    defaultBackground: '/images/onboarding/hair-barber-steel.jpg',
  },
  tattoo: {
    label: 'Tatuerare',
    defaultTheme: 'hair-noir-salon',
    defaultBackground: '/images/onboarding/hair-noir-salon.jpg',
  },
  sport: {
    label: 'PT & Sport',
    defaultTheme: 'hair-warm-walnut',
    defaultBackground: '/images/onboarding/hair-warm-walnut.jpg',
  },
  custom: {
    label: 'Annat / Anpassa själv',
    defaultTheme: 'hair-warm-walnut',
    defaultBackground: '/images/onboarding/hair-warm-walnut.jpg',
  },
};

/** Normaliserar tjänster från onboarding (klient kan skicka tom duration eller strängar). */
function normalizeRegisterServices(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const s of raw) {
    const name = String(s?.name ?? '').trim();
    if (!name) continue;
    const price = Math.round(Number(s?.price_amount));
    if (!Number.isFinite(price) || price < 0) continue;
    let dm = parseInt(String(s?.duration_minutes ?? '').trim(), 10);
    if (!Number.isFinite(dm) || dm <= 0) dm = 60;
    const row = {
      name,
      price_amount: price,
      duration_minutes: dm,
    };
    if (s?.price_label && String(s.price_label).trim()) {
      row.price_label = String(s.price_label).trim();
    }
    const durStr = s?.duration && String(s.duration).trim();
    if (durStr) row.duration = durStr;
    out.push(row);
  }
  return out;
}

/**
 * Importerar tjänster från Bokadirekt vid registrering.
 * Måste await:as i samma HTTP-request — annars avbryts arbetet på serverless när svaret skickats.
 * @returns {{ ok: boolean; imported: number; message?: string }}
 */
async function importBokadirektServicesForNewSalon(salon, bokadirektUrl) {
  if (!bokadirektUrl || typeof bokadirektUrl !== 'string' || !bokadirektUrl.includes('bokadirekt.se')) {
    return { ok: true, imported: 0 };
  }
  try {
    const result = await scrapeBokadirekt(bokadirektUrl.trim());
    const { categories } = result;
    if (!categories || categories.length === 0) {
      return { ok: true, imported: 0, message: 'Inga kategorier hittades på länken.' };
    }

    const { data: cats, error: catsErr } = await supabase
      .from('categories')
      .select('id, name')
      .eq('salon_id', salon.id);
    if (catsErr) throw catsErr;

    const catMap = {};
    if (cats) {
      cats.forEach((c) => {
        catMap[String(c.name || '').toLowerCase()] = c.id;
      });
    }

    let imported = 0;
    for (const cat of categories) {
      const catNameKey = String(cat.name || '').toLowerCase();
      let catId = catMap[catNameKey];
      if (!catId) {
        const { data: newCat, error: newCatErr } = await supabase
          .from('categories')
          .insert({ salon_id: salon.id, name: cat.name, sort_order: 999 })
          .select('id')
          .single();
        if (newCatErr) {
          console.error('[register] Bokadirekt category insert:', newCatErr.message || newCatErr);
          continue;
        }
        if (newCat?.id) {
          catId = newCat.id;
          catMap[catNameKey] = catId;
        }
      }
      if (!catId) continue;

      const svcs = cat.services || [];
      for (const svc of svcs) {
        if (!svc?.name || String(svc.name).trim() === '') continue;
        const pa = Number(svc.price_amount);
        const pl = svc.price_label ? String(svc.price_label).trim() : '';
        // Samma idé som bokadirektScraper: intervall kan vara 0 öre men med price_label
        if (!pl && (!Number.isFinite(pa) || pa <= 0)) continue;

        const { error: insErr } = await supabase.from('services').insert({
          salon_id: salon.id,
          category_id: catId,
          name: String(svc.name).trim(),
          price_amount: Number.isFinite(pa) && pa >= 0 ? Math.round(pa) : 0,
          price_label:
            pl || (pa > 0 ? `${(pa / 100).toLocaleString('sv-SE')} kr` : ''),
          duration_minutes: svc.duration_minutes || 60,
          duration: svc.duration || `${svc.duration_minutes || 60} min`,
          sort_order: 999,
          active: true,
        });
        if (insErr) {
          console.error('[register] Bokadirekt service insert:', insErr.message || insErr);
        } else {
          imported += 1;
        }
      }
    }

    return { ok: true, imported };
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('[register] Bokadirekt import failed:', msg);
    return { ok: false, imported: 0, message: msg };
  }
}

// ── POST /api/auth/register — Skapa admin-konto ─────────────────────────────
router.post('/register', async (req, res) => {
  const {
    email,
    password,
    name,
    salonName,
    salonSlug,
    bokadirektUrl,
    services,
    businessType = 'hair',
    themePreset = '',
    backgroundImageUrl = '',
    backgroundPreset = '',
  } = req.body;

  if (!email || !password || !name || !salonName) {
    return res.status(400).json({ error: 'Alla fält krävs (email, password, name, salonName).' });
  }

  try {
    const industry = ONBOARDING_INDUSTRIES[businessType] || ONBOARDING_INDUSTRIES.hair;
    const selectedThemeKey = ONBOARDING_THEMES[themePreset] ? themePreset : industry.defaultTheme;
    const selectedTheme = ONBOARDING_THEMES[selectedThemeKey] || ONBOARDING_THEMES.nordic;
    const rawBackground = String(backgroundImageUrl || backgroundPreset || '').trim();
    const selectedBackground =
      rawBackground.startsWith('/images/')
        ? rawBackground
        : selectedTheme.backgroundImageUrl || industry.defaultBackground;
    const theme = {
      backgroundColor: selectedTheme.backgroundColor,
      primaryAccent: selectedTheme.primaryAccent,
      secondaryColor: selectedTheme.secondaryColor,
      textColor: selectedTheme.textColor,
      backgroundImageUrl: selectedBackground,
      businessType: businessType in ONBOARDING_INDUSTRIES ? businessType : 'hair',
      themePreset: selectedThemeKey,
      backgroundPreset: selectedBackground,
    };
    const contact = {
      email: email.trim(),
      hours: ['Mån-Fre 09-18'],
      opening_hours: 'Mån-Fre 09-18',
      business_type: theme.businessType,
      business_label: industry.label,
      onboarding_theme: selectedTheme.name,
      background_preset: selectedBackground,
    };

    const salonSlugNormalized = (salonSlug || salonName).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const baseSalonInsert = {
      name: salonName,
      slug: salonSlugNormalized,
      theme,
      contact,
    };
    const fullSalonInsert = {
      ...baseSalonInsert,
      bokadirekt_url: bokadirektUrl || null,
      status: 'demo',
    };

    let { data: salon, error: salonErr } = await supabase
      .from('salons')
      .insert(fullSalonInsert)
      .select()
      .single();

    if (salonErr) {
      if (salonErr.code === '23505') return res.status(409).json({ error: 'Salongnamnet eller subdomänen är redan upptagen.' });
      
      // Fallback hantering om bokadirekt_url/status saknas i gamla instanser.
      // Behall theme/contact sa onboardingens valda uttryck inte tappas.
      const m = String(salonErr?.message || salonErr?.details || '');
      const missingStatus = salonErr.code === '42703' || m.includes('does not exist') || /column.*salons|salons.*column/i.test(m);
      if (missingStatus) {
        const retryVariants = [
          baseSalonInsert,
          { name: salonName, slug: salonSlugNormalized, theme },
          { name: salonName, slug: salonSlugNormalized },
        ];
        let retrySalon = null;
        let retryErr = null;
        for (const retryInsert of retryVariants) {
          const retry = await supabase
            .from('salons')
            .insert(retryInsert)
            .select()
            .single();
          retrySalon = retry.data;
          retryErr = retry.error;
          if (!retryErr) break;
          if (retryErr.code === '23505') break;
        }
        if (retryErr) {
          if (retryErr.code === '23505') return res.status(409).json({ error: 'Salongnamnet eller subdomänen är redan upptagen.' });
          throw retryErr;
        }
        salon = retrySalon;
        if (!salon?.theme) {
          // Sista chans pa DB:er dar insert fallback saknade theme men kolumnen finns.
          try {
            const { data: patchedSalon } = await supabase
              .from('salons')
              .update({ theme, contact })
              .eq('id', salon.id)
              .select()
              .single();
            if (patchedSalon) salon = patchedSalon;
          } catch {
            /* older schemas may not have JSON columns */
          }
        }
      } else {
        throw salonErr;
      }
    }

    if (salon?.id && (!salon.theme || !salon.contact)) {
      try {
        const patch = {};
        if (!salon.theme) patch.theme = theme;
        if (!salon.contact) patch.contact = contact;
        if (Object.keys(patch).length) {
          const { data: patchedSalon } = await supabase
            .from('salons')
            .update(patch)
            .eq('id', salon.id)
            .select()
            .single();
          if (patchedSalon) salon = patchedSalon;
        }
      } catch {
        /* ignore legacy schema patch failure */
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
    const validServices = normalizeRegisterServices(services);
    if (validServices.length > 0) {
      const { data: cat, error: catInsErr } = await supabase
        .from('categories')
        .insert({ salon_id: salon.id, name: 'Våra Tjänster', sort_order: 1 })
        .select('id')
        .single();

      if (catInsErr) {
        console.error('[register] categories insert failed:', catInsErr.message || catInsErr);
      } else if (cat?.id) {
        const svcRows = validServices.map((s, index) => ({
          salon_id: salon.id,
          category_id: cat.id,
          name: s.name,
          price_amount: s.price_amount,
          price_label:
            s.price_label || `${Math.round(Number(s.price_amount) / 100)} kr`,
          duration_minutes: s.duration_minutes,
          duration: s.duration || `${s.duration_minutes} min`,
          sort_order: index + 1,
          active: true,
        }));

        const { error: svcInsErr } = await supabase.from('services').insert(svcRows);
        if (svcInsErr) {
          console.error('[register] services insert failed:', svcInsErr.message || svcInsErr);
        }
      }
    }

    // 2.6: Bokadirekt — kör klart i samma request (serverless stoppar annars bakgrundsjobbet)
    let bokadirektImport = null;
    if (bokadirektUrl && typeof bokadirektUrl === 'string' && bokadirektUrl.includes('bokadirekt.se')) {
      bokadirektImport = await importBokadirektServicesForNewSalon(salon, bokadirektUrl);
    }

    // 2.7: Verifieringstoken + välkomstmejl med bekräftelselänk
    const verificationToken = randomUUID();
    const { error: verifyTokErr } = await supabase
      .from('salons')
      .update({ verification_token: verificationToken, email_verified: false })
      .eq('id', salon.id);

    if (verifyTokErr) {
      console.warn('[register] verification_token/email_verified:', verifyTokErr.message || verifyTokErr);
    }

    const demoUrl = `https://${salon.slug}.appbok.se`;
    const adminUrlForEmail = `${adminDashboardOrigin()}/admin/dashboard`;
    const verifyUrl = `${publicAppOrigin()}/api/verify?token=${encodeURIComponent(verificationToken)}`;

    // 3. Returnera JWT
    const token = signToken(user);

    // 4. Välkomstmejl — måste await:as på Vercel serverless; annars avslutas funktionen när svaret skickats
    try {
      if (!verifyTokErr) {
        const r = await sendWelcomeVerificationEmail({
          to: email.toLowerCase(),
          name,
          token: verificationToken,
          baseUrl: publicAppOrigin(),
          salonSlug: salon.slug,
        });
        if (!r?.success) {
          console.warn('[register] welcome email not sent:', r?.error || 'unknown');
        }
      } else {
        const r = await sendWelcomeEmail({
          to: email.toLowerCase(),
          salonName: salon.name,
          adminUrl: demoUrl.replace('.appbok.se', '.appbok.se/admin'),
          demoUrl,
        });
        if (!r?.success) {
          console.warn('[register] legacy welcome email not sent:', r?.error || 'unknown');
        }
      }
    } catch (err) {
      console.warn('[register] welcome email failed:', err?.message || err);
    }

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      salon: {
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        theme: salon.theme || theme,
        contact: salon.contact || contact,
        ...(verifyTokErr ? {} : { email_verified: false }),
      },
      demoUrl,
      ...(bokadirektImport && {
        bokadirekt_import: {
          ok: bokadirektImport.ok,
          imported: bokadirektImport.imported,
          ...(bokadirektImport.message && { message: bokadirektImport.message }),
        },
      }),
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
      .select('*, salons(id, name, slug, email_verified)')
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
