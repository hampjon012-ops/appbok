import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';

const router = Router();

// ── GET /api/services?salon_id=... — Publik: lista alla tjänster per salong ──
router.get('/', async (req, res) => {
  const { salon_id, slug } = req.query;

  try {
    let query = supabase
      .from('categories')
      .select(`
        id, name, description, sort_order,
        services(id, name, price_label, price_amount, duration, duration_minutes, active, sort_order)
      `)
      .eq('services.active', true)
      .order('sort_order');

    if (salon_id) query = query.eq('salon_id', salon_id);
    else if (slug) {
      const { data: salon } = await supabase.from('salons').select('id').eq('slug', slug).single();
      if (!salon) return res.status(404).json({ error: 'Salong ej hittad.' });
      query = query.eq('salon_id', salon.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Sort services within each category
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
  const { name, category_id, price_label, price_amount, duration, duration_minutes } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({ error: 'Namn och kategori krävs.' });
  }

  try {
    const { data, error } = await supabase
      .from('services')
      .insert({
        salon_id: req.user.salonId,
        category_id,
        name,
        price_label: price_label || '',
        price_amount: price_amount || 0,
        duration: duration || '',
        duration_minutes: duration_minutes || 60,
      })
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
  const { name, price_label, price_amount, duration, duration_minutes, active, category_id, sort_order } = req.body;

  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price_label !== undefined) updates.price_label = price_label;
    if (price_amount !== undefined) updates.price_amount = price_amount;
    if (duration !== undefined) updates.duration = duration;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (active !== undefined) updates.active = active;
    if (category_id !== undefined) updates.category_id = category_id;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Tjänst ej hittad.' });

    res.json(data);
  } catch (err) {
    console.error('Service update error:', err);
    res.status(500).json({ error: 'Kunde inte uppdatera tjänst.' });
  }
});

// ── DELETE /api/services/:id — Admin: ta bort tjänst ─────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // 1. Frigör eventuella aktiva bokningar fästa vid denna tjänst (ersätter ON DELETE SET NULL)
    await supabase.from('bookings').update({ service_id: null }).eq('service_id', req.params.id);

    // 2. Ta bort tjänsten
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .eq('salon_id', req.user.salonId);

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
