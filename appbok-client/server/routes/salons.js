import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { ensureSalonThemeAccent } from '../lib/ensureSalonThemeAccent.js';

const router = Router();

// GET /api/salons/public?salon_id=... | ?slug=... — Publik data för bokningssidan (ingen inloggning)
router.get('/public', async (req, res) => {
  const { salon_id, slug } = req.query;
  if (!salon_id && !slug) {
    return res.status(400).json({ error: 'Ange salon_id eller slug.' });
  }

  const selectCols = 'id, name, slug, tagline, logo_url, theme, contact, map_url, instagram';

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

    ensureSalonThemeAccent(data);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(data);
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

    ensureSalonThemeAccent(data);
    res.json(data);
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

export default router;
