import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase.js';
import { DEFAULT_BOOKING_ACCENT_HEX } from '../lib/defaultBookingAccent.js';
import { DEFAULT_PLATFORM_SALON_THEME } from '../lib/defaultSalonTheme.js';
import { ensureSalonThemeAccent } from '../lib/ensureSalonThemeAccent.js';
import { requireAuth, requireSuperAdmin } from '../lib/auth.js';

const router = Router();
const SYSTEM_SALON_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

router.use(requireAuth, requireSuperAdmin);

const THEME_PRESETS = {
  lux: {
    backgroundColor: '#1A1A1A',
    primaryAccent: DEFAULT_BOOKING_ACCENT_HEX,
    secondaryColor: '#2A2A2A',
    textColor: '#FFFFFF',
    backgroundImageUrl: '',
  },
  modern: {
    backgroundColor: '#FFF9F9',
    primaryAccent: '#E8B4B8',
    secondaryColor: '#F5E6E8',
    textColor: '#1A1A1A',
    backgroundImageUrl: '',
  },
  natur: {
    backgroundColor: '#F5F5F0',
    primaryAccent: '#7D9471',
    secondaryColor: '#E8E8E0',
    textColor: '#1A1A1A',
    backgroundImageUrl: '',
  },
  /** Mörkt — djupblå/silver */
  dark: {
    backgroundColor: '#0D1117',
    primaryAccent: '#58A6FF',
    secondaryColor: '#161B22',
    textColor: '#E6EDF3',
    backgroundImageUrl: '',
  },
  /** Sand — varm beige */
  sand: {
    backgroundColor: '#FAF6F1',
    primaryAccent: '#C4A77D',
    secondaryColor: '#EDE4D8',
    textColor: '#2C2416',
    backgroundImageUrl: '',
  },
  /** Ocean — teal */
  ocean: {
    backgroundColor: '#E8F4F5',
    primaryAccent: '#0D9488',
    secondaryColor: '#CCFBF1',
    textColor: '#134E4A',
    backgroundImageUrl: '',
  },
  /** Rosé — mjuk rosa */
  rose: {
    backgroundColor: '#FDF2F8',
    primaryAccent: '#DB2777',
    secondaryColor: '#FCE7F3',
    textColor: '#831843',
    backgroundImageUrl: '',
  },
  /** Midnatt — lila accent */
  midnight: {
    backgroundColor: '#1E1B4B',
    primaryAccent: '#A78BFA',
    secondaryColor: '#312E81',
    textColor: '#F5F3FF',
    backgroundImageUrl: '',
  },
  /** Standardmall — plattformsstandard (samma som mobil-preview / DB-fallback) */
  colorisma: {
    ...DEFAULT_PLATFORM_SALON_THEME,
    backgroundImageUrl: '',
  },
};

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'demo';
}

function isColumnMissingError(err) {
  const m = String(err?.message || err?.details || '');
  return (
    err?.code === '42703' ||
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    /column.*salons|salons.*column/i.test(m)
  );
}

/** När plan/subdomain/status saknas i DB — visa standardvärden i API */
function enrichSalonRow(row) {
  if (!row) return row;
  return {
    ...row,
    subdomain: row.subdomain ?? row.slug ?? '',
    plan: row.plan ?? 'trial',
    status: row.status ?? 'active',
  };
}

async function salonEditable(id) {
  const { data, error } = await supabase.from('salons').select('*').eq('id', id).single();
  if (error || !data) return null;
  if (data.plan === 'internal' || data.id === SYSTEM_SALON_ID) return null;
  return enrichSalonRow(data);
}

function isNonSalonRow(s) {
  if (!s || s.id === SYSTEM_SALON_ID) return null;
  return s.plan === 'internal' || s.status === 'internal' ? null : s;
}

// GET /api/superadmin/salons
router.get('/salons', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('salons')
      .select('id, name, slug, subdomain, plan, status, created_at')
      .order('created_at', { ascending: false });

    if (error && isColumnMissingError(error)) {
      const { data: rows, error: e2 } = await supabase
        .from('salons')
        .select('id, name, slug, created_at')
        .order('created_at', { ascending: false });
      if (e2) throw e2;
      const filtered = (rows || []).filter((r) => r.id !== SYSTEM_SALON_ID);
      return res.json(filtered.map(enrichSalonRow));
    }

    if (error) throw error;
    const list = (data || []).map(isNonSalonRow).filter(Boolean);
    res.json(list.map(enrichSalonRow));
  } catch (err) {
    console.error('superadmin list salons:', err);
    res.status(500).json({ error: 'Kunde inte hämta salonger.' });
  }
});

// GET /api/superadmin/salons/:id
router.get('/salons/:id', async (req, res) => {
  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });
    ensureSalonThemeAccent(salon);
    res.json(salon);
  } catch (err) {
    console.error('superadmin get salon:', err);
    res.status(500).json({ error: 'Kunde inte hämta salong.' });
  }
});

// POST /api/superadmin/salons — demo
router.post('/salons', async (req, res) => {
  const {
    name,
    subdomain: subIn,
    email,
    phone = '',
    address = '',
    themePreset = 'colorisma',
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Namn och e-post krävs.' });
  }

  const subdomain = slugify(subIn || name);
  const preset = THEME_PRESETS[themePreset] || THEME_PRESETS.colorisma;
  const theme = { ...preset };
  const trimmedName = name.trim();

  const demoServices = [
    { name: 'Klippning', price_label: '350 kr', price_amount: 35000, duration: '45 min', duration_minutes: 45 },
    { name: 'Färg', price_label: '800 kr', price_amount: 80000, duration: '120 min', duration_minutes: 120 },
    { name: 'Styling', price_label: '500 kr', price_amount: 50000, duration: '60 min', duration_minutes: 60 },
    { name: 'Slingor', price_label: '950 kr', price_amount: 95000, duration: '90 min', duration_minutes: 90 },
  ];

  const tempPassword = `Demo${crypto.randomBytes(3).toString('hex')}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  try {
    const { data: dupSlug } = await supabase.from('salons').select('id').eq('slug', subdomain).maybeSingle();
    if (dupSlug) {
      return res.status(409).json({ error: 'Slug är redan tagen. Välj ett annat namn.' });
    }

    const welcome = `Välkommen till ${trimmedName}!`;
    const contactSeed = {
      address: String(address || '').trim(),
      phone: String(phone || '').trim(),
      email: email.trim(),
      hours: ['Mån–Fre 09–18'],
      opening_hours: 'Mån–Fre 09–18',
      instagram_handle: '#',
      about: '',
    };

    const insertBase = {
      name: trimmedName,
      slug: subdomain,
      tagline: welcome,
      logo_url: '',
      theme,
      contact: contactSeed,
      map_url: '#',
      instagram: [],
    };
    // Endast kolumner som alltid finns — plan/subdomain/status läggs till via migration 004
    let { data: salon, error: sErr } = await supabase.from('salons').insert(insertBase).select().single();

    if (sErr && isColumnMissingError(sErr)) {
      const { map_url: _m, instagram: _i, ...rest } = insertBase;
      const retry = await supabase.from('salons').insert(rest).select().single();
      salon = retry.data;
      sErr = retry.error;
    }

    if (sErr) throw sErr;

    const { data: cat, error: cErr } = await supabase
      .from('categories')
      .insert({
        salon_id: salon.id,
        name: 'Tjänster',
        description: 'Demo-tjänster',
        sort_order: 1,
      })
      .select()
      .single();

    if (cErr) throw cErr;

    for (let i = 0; i < demoServices.length; i++) {
      const s = demoServices[i];
      const { error: se } = await supabase.from('services').insert({
        salon_id: salon.id,
        category_id: cat.id,
        name: s.name,
        price_label: s.price_label,
        price_amount: s.price_amount,
        duration: s.duration,
        duration_minutes: s.duration_minutes,
        sort_order: i,
      });
      if (se) throw se;
    }

    const { error: u1 } = await supabase.from('users').insert({
      salon_id: salon.id,
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      name: name.split(' ')[0] || 'Admin',
      role: 'admin',
      title: 'Ägare',
    });
    if (u1) throw u1;

    const { error: u2 } = await supabase.from('users').insert({
      salon_id: salon.id,
      email: `maja.${subdomain}@demo.appbok.local`,
      password_hash: await bcrypt.hash('StaffDemo!', 10),
      name: 'Maja',
      role: 'staff',
      title: 'Frisör',
    });
    if (u2) throw u2;

    ensureSalonThemeAccent(salon);
    res.status(201).json({
      salon: enrichSalonRow(salon),
      subdomain,
      tempPassword,
      demoUrl: `https://${subdomain}.appbok.se`,
    });
  } catch (err) {
    console.error('superadmin create demo:', err);
    res.status(500).json({ error: err.message || 'Kunde inte skapa demo.' });
  }
});

// PUT /api/superadmin/salons/:id/theme
router.put('/salons/:id/theme', async (req, res) => {
  const { logo_url, accent, background, text, secondary, background_image_url } = req.body;

  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const t = typeof salon.theme === 'object' && salon.theme !== null ? salon.theme : {};
    const merged = {
      ...t,
      ...(background != null && { backgroundColor: background }),
      ...(accent != null && { primaryAccent: accent }),
      ...(secondary != null && { secondaryColor: secondary }),
      ...(text != null && { textColor: text }),
      ...(background_image_url !== undefined && { backgroundImageUrl: background_image_url }),
    };

    const { data, error } = await supabase
      .from('salons')
      .update({
        logo_url: logo_url !== undefined ? logo_url : salon.logo_url,
        theme: merged,
      })
      .eq('id', salon.id)
      .select()
      .single();

    if (error) throw error;
    ensureSalonThemeAccent(data);
    res.json(data);
  } catch (err) {
    console.error('superadmin theme:', err);
    res.status(500).json({ error: 'Kunde inte spara tema.' });
  }
});

// GET /api/superadmin/salons/:id/services
router.get('/salons/:id/services', async (req, res) => {
  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const { data, error } = await supabase
      .from('services')
      .select('id, name, price_label, price_amount, duration, duration_minutes, category_id, sort_order, is_popular')
      .eq('salon_id', salon.id)
      .order('sort_order');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('superadmin services list:', err);
    res.status(500).json({ error: 'Kunde inte hämta tjänster.' });
  }
});

// POST /api/superadmin/salons/:id/services
router.post('/salons/:id/services', async (req, res) => {
  const { name, price_amount, duration, duration_minutes, price_label, category_id, is_popular } = req.body;

  if (!name) return res.status(400).json({ error: 'Namn krävs.' });

  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    let catId = category_id;
    if (!catId) {
      const { data: first } = await supabase
        .from('categories')
        .select('id')
        .eq('salon_id', salon.id)
        .order('sort_order')
        .limit(1)
        .maybeSingle();
      if (!first) {
        const { data: nc, error: ne } = await supabase
          .from('categories')
          .insert({ salon_id: salon.id, name: 'Tjänster', description: '', sort_order: 1 })
          .select()
          .single();
        if (ne) throw ne;
        catId = nc.id;
      } else catId = first.id;
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        salon_id: salon.id,
        category_id: catId,
        name: name.trim(),
        price_label: price_label || `${(price_amount || 0) / 100} kr`,
        price_amount: price_amount ?? 0,
        duration: duration || '',
        duration_minutes: duration_minutes ?? 60,
        is_popular: Boolean(is_popular),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('superadmin service create:', err);
    res.status(500).json({ error: 'Kunde inte skapa tjänst.' });
  }
});

// PUT /api/superadmin/salons/:id/services/:serviceId
router.put('/salons/:id/services/:serviceId', async (req, res) => {
  const { name, price_amount, duration, duration_minutes, price_label, is_popular } = req.body;

  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price_amount !== undefined) updates.price_amount = price_amount;
    if (duration !== undefined) updates.duration = duration;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (price_label !== undefined) updates.price_label = price_label;
    if (is_popular !== undefined) updates.is_popular = Boolean(is_popular);

    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', req.params.serviceId)
      .eq('salon_id', salon.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Tjänst hittades inte.' });
    res.json(data);
  } catch (err) {
    console.error('superadmin service update:', err);
    res.status(500).json({ error: 'Kunde inte uppdatera tjänst.' });
  }
});

// DELETE /api/superadmin/salons/:id/services/:serviceId
router.delete('/salons/:id/services/:serviceId', async (req, res) => {
  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    await supabase.from('bookings').update({ service_id: null }).eq('service_id', req.params.serviceId);

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.serviceId)
      .eq('salon_id', salon.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('superadmin service delete:', err);
    res.status(500).json({ error: 'Kunde inte ta bort tjänst.' });
  }
});

// POST /api/superadmin/salons/:id/import-services
// Body: { services: [{ name, price_amount, duration, duration_minutes, price_label, category_name? }] }
router.post('/salons/:id/import-services', async (req, res) => {
  const { services } = req.body;

  if (!Array.isArray(services) || services.length === 0) {
    return res.status(400).json({ error: 'Inga tjänster att importera.' });
  }

  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    // Bygg kategori-map: namn → id (skapa vid behov)
    const categoryCache = {};

    async function getOrCreateCategory(name) {
      const key = String(name || 'Tjänster').trim();
      if (categoryCache[key]) return categoryCache[key];

      const trimmed = key || 'Tjänster';

      // Försök hitta befintlig
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('salon_id', salon.id)
        .ilike('name', trimmed)
        .maybeSingle();

      if (existing) {
        categoryCache[key] = existing.id;
        return existing.id;
      }

      // Skapa ny
      const { data: created, error } = await supabase
        .from('categories')
        .insert({ salon_id: salon.id, name: trimmed, description: '', sort_order: 999 })
        .select()
        .single();

      if (error) throw error;
      categoryCache[key] = created.id;
      return created.id;
    }

    // Importera varje tjänst
    const created = [];
    for (const svc of services) {
      if (!svc.name || !svc.name.trim()) continue;

      const catName = svc.category_name || 'Tjänster';
      const catId = await getOrCreateCategory(catName);

      const defaultPriceLabel = svc.price_amount
        ? `${(svc.price_amount / 100).toLocaleString('sv-SE')} kr`
        : svc.price_label || '';
      const defaultDuration = svc.duration_minutes ? `${svc.duration_minutes} min` : svc.duration || '';

      const { data, error } = await supabase
        .from('services')
        .insert({
          salon_id: salon.id,
          category_id: catId,
          name: String(svc.name).trim(),
          price_amount: svc.price_amount ?? 0,
          price_label: svc.price_label || defaultPriceLabel,
          duration: svc.duration || defaultDuration,
          duration_minutes: svc.duration_minutes || 60,
          sort_order: 999,
          active: true,
        })
        .select()
        .single();

      if (error) {
        console.warn('Import service error:', error.message);
        continue;
      }
      created.push(data);
    }

    res.status(201).json({ imported: created.length, services: created });
  } catch (err) {
    console.error('superadmin import-services:', err);
    res.status(500).json({ error: 'Kunde inte importera tjänster.' });
  }
});

// GET /api/superadmin/salons/:id/staff
router.get('/salons/:id/staff', async (req, res) => {
  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, title, active')
      .eq('salon_id', salon.id)
      .in('role', ['admin', 'staff'])
      .order('created_at');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('superadmin staff list:', err);
    res.status(500).json({ error: 'Kunde inte hämta personal.' });
  }
});

// POST /api/superadmin/salons/:id/staff
router.post('/salons/:id/staff', async (req, res) => {
  const { name, email, role } = req.body;

  if (!name || !email || !['admin', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'Namn, e-post och roll (admin/staff) krävs.' });
  }

  const tempPassword = `Tmp${crypto.randomBytes(3).toString('hex')}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const { data, error } = await supabase
      .from('users')
      .insert({
        salon_id: salon.id,
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        name: name.trim(),
        role,
        title: role === 'admin' ? 'Administratör' : 'Personal',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'E-post finns redan för denna salong.' });
      throw error;
    }

    res.status(201).json({ ...data, tempPassword });
  } catch (err) {
    console.error('superadmin staff create:', err);
    res.status(500).json({ error: 'Kunde inte skapa personal.' });
  }
});

// PUT /api/superadmin/salons/:id/staff/:userId
router.put('/salons/:id/staff/:userId', async (req, res) => {
  const { name, email, role } = req.body;

  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (role !== undefined && ['admin', 'staff'].includes(role)) updates.role = role;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.userId)
      .eq('salon_id', salon.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Användare hittades inte.' });
    res.json(data);
  } catch (err) {
    console.error('superadmin staff update:', err);
    res.status(500).json({ error: 'Kunde inte uppdatera personal.' });
  }
});

// DELETE /api/superadmin/salons/:id/staff/:userId
router.delete('/salons/:id/staff/:userId', async (req, res) => {
  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.userId)
      .eq('salon_id', salon.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('superadmin staff delete:', err);
    res.status(500).json({ error: 'Kunde inte ta bort personal.' });
  }
});

// PUT /api/superadmin/salons/:id/details — tagline, map_url, instagram (feed), contact (merge), subdomain
router.put('/salons/:id/details', async (req, res) => {
  const { tagline, map_url, instagram, name, subdomain } = req.body;
  const contactPatch = req.body.contact;

  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const prevContact =
      typeof salon.contact === 'object' && salon.contact !== null && !Array.isArray(salon.contact)
        ? salon.contact
        : {};
    const mergedContact =
      contactPatch && typeof contactPatch === 'object'
        ? { ...prevContact, ...contactPatch }
        : prevContact;

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (subdomain !== undefined) {
      const cleanSub = String(subdomain).trim();
      updates.slug = cleanSub;
    }
    if (tagline !== undefined) updates.tagline = tagline;
    if (map_url !== undefined) updates.map_url = map_url;
    if (instagram !== undefined) updates.instagram = instagram;
    if (contactPatch && typeof contactPatch === 'object') updates.contact = mergedContact;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Inget att uppdatera.' });
    }

    const { data, error } = await supabase.from('salons').update(updates).eq('id', salon.id).select().single();

    if (error && isColumnMissingError(error)) {
      const fallback = { ...salon, ...updates, contact: mergedContact };
      ensureSalonThemeAccent(fallback);
      return res.json(enrichSalonRow(fallback));
    }

    if (error) throw error;
    ensureSalonThemeAccent(data);
    res.json(enrichSalonRow(data));
  } catch (err) {
    console.error('superadmin salon details:', err);
    res.status(500).json({ error: 'Kunde inte spara.' });
  }
});

// PUT /api/superadmin/salons/:id/billing — plan + status
router.put('/salons/:id/billing', async (req, res) => {
  const { plan, status } = req.body;
  const validPlans = ['demo', 'trial', 'grund', 'pro', 'inactive'];
  const validStatuses = ['active', 'inactive', 'suspended'];

  try {
    const salon = await salonEditable(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salong hittades inte.' });

    const updates = {};
    if (plan !== undefined && validPlans.includes(plan)) updates.plan = plan;
    if (status !== undefined && validStatuses.includes(status)) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Ange plan och/eller status.' });
    }

    const { data, error } = await supabase
      .from('salons')
      .update(updates)
      .eq('id', salon.id)
      .select()
      .single();

    if (error && isColumnMissingError(error)) {
      const billingFallback = {
        ...salon,
        plan: updates.plan ?? salon.plan ?? 'trial',
        status: updates.status ?? salon.status ?? 'active',
        billingNote: 'Värden visas här; kör migration 004 för att spara plan/status i databasen.',
      };
      ensureSalonThemeAccent(billingFallback);
      return res.json(enrichSalonRow(billingFallback));
    }

    if (error) throw error;

    ensureSalonThemeAccent(data);
    res.json(enrichSalonRow(data));
  } catch (err) {
    console.error('superadmin billing:', err);
    res.status(500).json({ error: 'Kunde inte spara billing.' });
  }
});

export default router;
