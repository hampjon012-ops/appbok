import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';

const router = Router();

let _hasIsPopular = null;

async function hasIsPopularColumn() {
  if (_hasIsPopular !== null) return _hasIsPopular;
  const { error } = await supabase
    .from('services')
    .select('is_popular')
    .limit(1);
  _hasIsPopular = !error;
  return _hasIsPopular;
}

function jwtSalonIdFromRequest(req) {
  const u = req.user;
  if (!u) return null;
  return u.salonId ?? u.salon_id ?? null;
}

/**
 * Hämtar tjänstens salon_id och verifierar behörighet.
 * - Superadmin: impersonate-header måste matcha tjänsten, annars tillåts uppdatering av tjänstens salong.
 * - Admin: JWT salonId måste matcha tjänstens salong (samma som i databasen).
 */
async function resolveSalonIdForServiceMutation(req, serviceId) {
  const { data: row, error: selErr } = await supabase
    .from('services')
    .select('salon_id')
    .eq('id', serviceId)
    .maybeSingle();

  if (selErr) {
    console.error('resolveSalonIdForServiceMutation:', selErr);
    throw selErr;
  }

  if (!row?.salon_id) return null;

  const svcSalon = String(row.salon_id);
  const role = req.user?.role;

  if (role === 'superadmin') {
    const imp = req.headers['x-impersonate-salon-id'];
    if (imp) {
      return String(imp) === svcSalon ? svcSalon : null;
    }
    return svcSalon;
  }

  if (role === 'admin') {
    const jwtSalon = jwtSalonIdFromRequest(req);
    if (!jwtSalon) return null;
    return String(jwtSalon) === svcSalon ? svcSalon : null;
  }

  return null;
}

// ── GET /api/services?salon_id=... — Publik: lista alla tjänster per salong ──
router.get('/', async (req, res) => {
  const { salon_id, slug } = req.query;

  if (!salon_id && !slug) {
    return res.status(400).json({ error: 'Ange salon_id eller slug.' });
  }

  try {
    const pop = await hasIsPopularColumn();
    const svcFields = pop
      ? 'id, name, price_label, price_amount, duration, duration_minutes, active, sort_order, is_popular'
      : 'id, name, price_label, price_amount, duration, duration_minutes, active, sort_order';

    let targetSalonId = salon_id;
    if (!targetSalonId && slug) {
      const { data: salon } = await supabase.from('salons').select('id').eq('slug', slug).single();
      if (!salon) return res.status(404).json({ error: 'Salong ej hittad.' });
      targetSalonId = salon.id;
    }

    let query = supabase
      .from('categories')
      .select(`id, name, description, sort_order, services(${svcFields})`)
      .eq('services.active', true)
      .eq('salon_id', targetSalonId)
      .order('sort_order');

    const { data, error } = await query;
    if (error) throw error;

    const sorted = data?.map(cat => ({
      ...cat,
      services: (cat.services || []).sort((a, b) => a.sort_order - b.sort_order),
    }));

    res.json(sorted || []);
  } catch (err) {
    console.error('Services list error:', err);
    res.status(500).json({ error: 'Kunde inte hämta tjänster.' });
  }
});

// ── POST /api/services — Admin: skapa ny tjänst ─────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, category_id, price_label, price_amount, duration, duration_minutes, is_popular } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({ error: 'Namn och kategori krävs.' });
  }

  try {
    let targetSalonId = jwtSalonIdFromRequest(req);
    if (req.user.role === 'superadmin') {
      const imp = req.headers['x-impersonate-salon-id'];
      if (imp) {
        targetSalonId = imp;
      } else {
        const { data: cat } = await supabase
          .from('categories')
          .select('salon_id')
          .eq('id', category_id)
          .maybeSingle();
        if (cat?.salon_id) targetSalonId = cat.salon_id;
      }
    }
    if (!targetSalonId) {
      return res.status(400).json({ error: 'Kunde inte avgöra salong för tjänsten.' });
    }

    const pop = await hasIsPopularColumn();
    const row = {
      salon_id: targetSalonId,
      category_id,
      name,
      price_label: price_label || '',
      price_amount: price_amount || 0,
      duration: duration || '',
      duration_minutes: duration_minutes || 60,
    };
    if (pop) row.is_popular = Boolean(is_popular);

    const { data, error } = await supabase
      .from('services')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Service create error:', err);
    res.status(500).json({ error: 'Kunde inte skapa tjänst.' });
  }
});

// ── PUT /api/services/:id — Admin: uppdatera tjänst ─────────────────────────
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, price_label, price_amount, duration, duration_minutes, active, category_id, sort_order, is_popular } =
    req.body;

  try {
    const pop = await hasIsPopularColumn();
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price_label !== undefined) updates.price_label = price_label;
    if (price_amount !== undefined) updates.price_amount = price_amount;
    if (duration !== undefined) updates.duration = duration;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (active !== undefined) updates.active = active;
    if (category_id !== undefined) updates.category_id = category_id;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_popular !== undefined && pop) updates.is_popular = Boolean(is_popular);

    if (Object.keys(updates).length === 0) {
      if (is_popular !== undefined) {
        const salonIdFilter = await resolveSalonIdForServiceMutation(req, req.params.id);
        if (!salonIdFilter) {
          return res.status(403).json({
            error:
              req.user?.role === 'admin'
                ? 'Din inloggning matchar inte denna tjänst (fel salong i token). Logga ut och in igen.'
                : 'Otillräcklig behörighet att uppdatera tjänsten.',
          });
        }
        const { data: row, error: selErr } = await supabase
          .from('services')
          .select('*')
          .eq('id', req.params.id)
          .eq('salon_id', salonIdFilter)
          .maybeSingle();
        if (selErr) throw selErr;
        if (!row) return res.status(404).json({ error: 'Tjänst ej hittad.' });
        return res.json(row);
      }
      return res.status(400).json({ error: 'Inga fält att uppdatera.' });
    }

    const salonIdFilter = await resolveSalonIdForServiceMutation(req, req.params.id);
    if (!salonIdFilter) {
      return res.status(403).json({
        error:
          req.user?.role === 'admin'
            ? 'Din inloggning matchar inte denna tjänst (fel salong i token). Logga ut och in igen.'
            : 'Otillräcklig behörighet att uppdatera tjänsten.',
      });
    }

    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', req.params.id)
      .eq('salon_id', salonIdFilter)
      .select()
      .single();

    if (error) {
      const text = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
      const missingCol =
        error.code === '42703' ||
        (/column/i.test(text) && /does not exist|not exist|unknown/i.test(text));
      if (missingCol && updates.is_popular !== undefined) {
        _hasIsPopular = false;
        delete updates.is_popular;
        if (Object.keys(updates).length === 0) {
          return res.json({ id: req.params.id, _note: 'is_popular column missing, no other changes' });
        }
        const retry = await supabase
          .from('services')
          .update(updates)
          .eq('id', req.params.id)
          .eq('salon_id', salonIdFilter)
          .select()
          .single();
        if (retry.error) throw retry.error;
        return res.json(retry.data);
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Tjänst ej hittad.' });

    res.json(data);
  } catch (err) {
    const code = err?.code;
    const msg = err?.message || String(err);
    console.error('Service update error:', { code, message: msg, details: err?.details, hint: err?.hint });

    if (code === 'PGRST116') {
      return res.status(404).json({ error: 'Tjänst hittades inte för denna salong.' });
    }

    const safeMsg =
      msg && msg.length > 0 && msg.length < 500
        ? msg
        : 'Kunde inte uppdatera tjänst (okänt fel). Kolla serverloggar.';
    res.status(500).json({ error: safeMsg });
  }
});

// ── DELETE /api/services/:id — Admin: ta bort tjänst ─────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const salonIdFilter = await resolveSalonIdForServiceMutation(req, req.params.id);
    if (!salonIdFilter) {
      return res.status(403).json({
        error:
          req.user?.role === 'admin'
            ? 'Din inloggning matchar inte denna tjänst. Logga ut och in igen.'
            : 'Otillräcklig behörighet.',
      });
    }

    // 1. Frigör eventuella aktiva bokningar fästa vid denna tjänst (ersätter ON DELETE SET NULL)
    await supabase.from('bookings').update({ service_id: null }).eq('service_id', req.params.id);

    // 2. Ta bort tjänsten
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .eq('salon_id', salonIdFilter);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Service delete error:', err);
    res.status(500).json({ error: 'Kunde inte ta bort tjänst.' });
  }
});

// ── POST /api/categories — Admin: skapa kategori ────────────────────────────
router.post('/categories', requireAuth, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Namn krävs.' });

  try {
    const { data, error } = await supabase
      .from('categories')
      .insert({ salon_id: req.user.salonId, name, description: description || '' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Category create error:', err);
    res.status(500).json({ error: 'Kunde inte skapa kategori.' });
  }
});

// ── DELETE /api/categories/:id — Admin: ta bort kategori ──────────────────────
router.delete('/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // 1. Hämta alla tjänster i kategorin för manuell sanering (löser gamla DB-constraints)
    const { data: svcs } = await supabase
      .from('services')
      .select('id')
      .eq('category_id', req.params.id);
    
    if (svcs && svcs.length > 0) {
      const svcIds = svcs.map(s => s.id);
      
      // 2. Frigör eventuella aktiva bokningar fästa vid dessa tjänster (ersätter ON DELETE SET NULL)
      await supabase.from('bookings').update({ service_id: null }).in('service_id', svcIds);
      
      // 3. Ta bort tjänsterna
      const { error: svcDelErr } = await supabase.from('services').delete().in('id', svcIds);
      if (svcDelErr) throw svcDelErr;
    }

    // 4. Ta sedan bort kategorin
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Category delete error:', err);
    res.status(500).json({ error: 'Kunde inte ta bort kategori.' });
  }
});

export default router;
