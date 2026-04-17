import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { ensureSalonThemeAccent } from '../lib/ensureSalonThemeAccent.js';
import { maybeExpireTrialSalonIfNeeded } from '../lib/expireTrialSalon.js';

const router = Router();

// GET /api/salons/public?salon_id=... | ?slug=... — Publik data för bokningssidan (ingen inloggning)
router.get('/public', async (req, res) => {
  const { salon_id, slug } = req.query;
  if (!salon_id && !slug) {
    return res.status(400).json({ error: 'Ange salon_id eller slug.' });
  }

  const selectCols = 'id, name, slug, tagline, logo_url, theme, contact, map_url, instagram, status, plan, trial_ends_at, allow_pay_on_site, stripe_account_id';

  try {
    let data;
    let error;

    if (salon_id) {
      const r = await supabase.from('salons').select(selectCols).eq('id', salon_id).single();
      data = r.data;
      error = r.error;
    } else {
      const slugNorm = String(slug).trim();
      let r = await supabase.from('salons').select(selectCols).eq('slug', slugNorm).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) {
        r = await supabase.from('salons').select(selectCols).eq('slug', slugNorm.toLowerCase()).maybeSingle();
      }
      if (r.error) throw r.error;
      if (!r.data) {
        const sub = slugNorm.toLowerCase();
        r = await supabase.from('salons').select(selectCols).eq('subdomain', sub).maybeSingle();
      }
      if (r.error) throw r.error;
      data = r.data;
    }

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Salong hittades inte.' });

    const dataAfterExpire = await maybeExpireTrialSalonIfNeeded(data);
    ensureSalonThemeAccent(dataAfterExpire);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(dataAfterExpire);
  } catch (err) {
    console.error('Salon public get error:', err);
    res.status(500).json({ error: 'Kunde inte hämta salong.' });
  }
});

// GET /api/salons — Hämta salong
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('salons')
      .select('*')
      .eq('id', req.user.salonId)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Salong hittades inte.' });

    const dataAfterExpire = await maybeExpireTrialSalonIfNeeded(data);
    ensureSalonThemeAccent(dataAfterExpire);
    res.json(dataAfterExpire);
  } catch (err) {
    console.error('Salon get error:', err);
    res.status(500).json({ error: 'Kunde inte hämta salong.' });
  }
});

// PUT /api/salons — Uppdatera salong (använder befintliga kolumner: name, contact JSONB, theme JSONB, logo_url)
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  const {
    name,
    address,
    phone,
    email,
    opening_hours,
    theme_background,
    theme_primary,
    theme_text,
    theme_secondary,
    theme_background_image_url,
    logo_url,
    tagline,
    map_url,
    instagram,
    allow_pay_on_site,
    contact: contactMerge,
  } = req.body;

  try {
    const { data: current, error: fetchErr } = await supabase
      .from('salons')
      .select('contact, theme, logo_url, name, tagline, map_url, instagram')
      .eq('id', req.user.salonId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!current) return res.status(404).json({ error: 'Salong hittades inte.' });

    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (tagline !== undefined) updates.tagline = (tagline || '').trim();
    if (map_url !== undefined) updates.map_url = (map_url || '').trim();
    if (instagram !== undefined) updates.instagram = (instagram || '').trim();

    const contactPatch =
      address !== undefined ||
      phone !== undefined ||
      email !== undefined ||
      opening_hours !== undefined ||
      (contactMerge && typeof contactMerge === 'object');

    if (contactPatch) {
      const contact = { ...(current.contact && typeof current.contact === 'object' ? current.contact : {}) };
      if (address !== undefined) contact.address = (address || '').trim();
      if (phone !== undefined) contact.phone = (phone || '').trim();
      if (email !== undefined) contact.email = (email || '').trim();
      if (opening_hours !== undefined) {
        const raw = (opening_hours || '').trim();
        contact.opening_hours = raw;
        const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length) contact.hours = lines;
      }
      if (contactMerge && typeof contactMerge === 'object') {
        for (const [k, v] of Object.entries(contactMerge)) {
          if (v === undefined) continue;
          if (typeof v === 'string') contact[k] = v.trim();
          else contact[k] = v;
        }
      }
      updates.contact = contact;
    }

    const themePatch =
      theme_background !== undefined ||
      theme_primary !== undefined ||
      theme_text !== undefined ||
      theme_secondary !== undefined ||
      theme_background_image_url !== undefined;

    if (themePatch) {
      const theme = { ...(current.theme && typeof current.theme === 'object' ? current.theme : {}) };
      if (theme_background !== undefined) theme.backgroundColor = theme_background;
      if (theme_primary !== undefined) theme.primaryAccent = theme_primary;
      if (theme_text !== undefined) theme.textColor = theme_text;
      if (theme_secondary !== undefined) theme.secondaryColor = theme_secondary;
      if (theme_background_image_url !== undefined) {
        theme.backgroundImageUrl = (theme_background_image_url || '').trim();
      }
      updates.theme = theme;
    }

    if (logo_url !== undefined) updates.logo_url = logo_url;

    if (allow_pay_on_site !== undefined) updates.allow_pay_on_site = Boolean(allow_pay_on_site);

    if (Object.keys(updates).length === 0) {
      const { data: full, error: fullErr } = await supabase
        .from('salons')
        .select('*')
        .eq('id', req.user.salonId)
        .single();
      if (fullErr) throw fullErr;
      ensureSalonThemeAccent(full);
      return res.json(full);
    }

    const { data, error } = await supabase
      .from('salons')
      .update(updates)
      .eq('id', req.user.salonId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Salong hittades inte.' });

    ensureSalonThemeAccent(data);
    res.json(data);
  } catch (err) {
    console.error('Salon update error:', err);
    const msg = err?.message || err?.details || 'Kunde inte uppdatera salong.';
    res.status(500).json({ error: msg });
  }
});

// POST /api/salons/current/go-live — Gå live (kräver Stripe)
router.post('/current/go-live', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('salons')
      .select('id, status, trial_ends_at, stripe_account_id, contact, name, slug')
      .eq('id', req.user.salonId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!row) return res.status(404).json({ error: 'Salong hittades inte.' });

    const current = await maybeExpireTrialSalonIfNeeded(row);

    if (current.status === 'live') {
      return res.status(400).json({ error: 'Salongen är redan live.' });
    }

    const stripeConnected = Boolean(
      current.stripe_account_id || (current.contact && typeof current.contact === 'object' && current.contact.stripe_connected),
    );

    if (!stripeConnected) {
      return res.status(400).json({ error: 'Koppla Stripe först innan du kan gå live.' });
    }

    const { data, error } = await supabase
      .from('salons')
      .update({ status: 'live' })
      .eq('id', req.user.salonId)
      .select()
      .single();

    if (error) throw error;

    // Skicka go-live bekräftelsemail asynkront (non-blocking)
    const liveUrl = `https://${current.slug || ''}.appbok.se/`.replace('https://.appbok.se/', 'https://appbok.se/');
    import('../lib/email.js')
      .then(({ sendGoLiveEmail }) => {
        const adminEmail = req.user?.email;
        if (adminEmail) {
          sendGoLiveEmail({ to: adminEmail, salonName: current.name || 'Din salong', liveUrl })
            .catch((e) => console.warn('[go-live] Email failed:', e.message));
        }
      })
      .catch((e) => console.warn('[go-live] Could not import email module:', e.message));

    ensureSalonThemeAccent(data);
    res.json(data);
  } catch (err) {
    console.error('[go-live] Full error:', err);
    const msg = err?.error?.message || err?.message || err?.details || String(err);
    res.status(500).json({ error: `Kunde inte gå live: ${msg}` });
  }
});

// POST /api/salons/current/trial — Starta 14 dagars testperiod
router.post('/current/trial', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('salons')
      .select('id, status, trial_ends_at')
      .eq('id', req.user.salonId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!row) return res.status(404).json({ error: 'Salong hittades inte.' });

    const current = await maybeExpireTrialSalonIfNeeded(row);

    if (current.status === 'trial') {
      return res.status(400).json({ error: 'Trial-period är redan aktiv.' });
    }
    if (current.status === 'live') {
      return res.status(400).json({ error: 'Salongen är redan live.' });
    }
    if (current.status === 'expired') {
      return res.status(400).json({
        error:
          'Testperioden är avslutad. Koppla Stripe och gå live för att ta emot bokningar igen.',
      });
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const { data, error } = await supabase
      .from('salons')
      .update({ status: 'trial', trial_ends_at: trialEndsAt.toISOString() })
      .eq('id', req.user.salonId)
      .select()
      .single();

    if (error) throw error;
    ensureSalonThemeAccent(data);
    res.json(data);
  } catch (err) {
    console.error('[trial] start error:', err);
    const msg = err?.error?.message || err?.message || err?.details || String(err);
    res.status(500).json({ error: `Kunde inte starta trial-period: ${msg}` });
  }
});

export default router;
