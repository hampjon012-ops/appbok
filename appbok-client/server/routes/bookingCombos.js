import { Router } from 'express';
import supabase from '../lib/supabase.js';

const router = Router();

/** Fördefinierade kombinationer — matchas mot salongens tjänstnamn (första träff per del). */
const COMBO_SPECS = [
  { label: 'Klippning + Färg', patterns: [/(klipp|klippning)/i, /(färg|sling|toning|blek|dip\s*dye)/i] },
  { label: 'Klippning + Fön', patterns: [/(klipp|klippning)/i, /fön/i] },
  { label: 'Barnklippning + Fön', patterns: [/barn/i, /fön/i] },
];

function buildCombos(flatServices) {
  const list = flatServices.filter((s) => s.active !== false);
  const out = [];
  for (const spec of COMBO_SPECS) {
    const pool = [...list];
    const ids = [];
    for (const re of spec.patterns) {
      const idx = pool.findIndex((s) => re.test(s.name || ''));
      if (idx === -1) {
        ids.length = 0;
        break;
      }
      const [picked] = pool.splice(idx, 1);
      ids.push(picked.id);
    }
    if (ids.length === spec.patterns.length && new Set(ids).size === ids.length) {
      out.push({ label: spec.label, serviceIds: ids });
    }
  }
  return out;
}

// GET /api/booking-combos?salon_id= — Populära kombinationer för boknings-UI
router.get('/', async (req, res) => {
  const { salon_id, slug } = req.query;
  if (!salon_id && !slug) {
    return res.status(400).json({ error: 'Ange salon_id eller slug.' });
  }
  try {
    let targetSalonId = salon_id;
    if (!targetSalonId && slug) {
      const { data: salon } = await supabase.from('salons').select('id').eq('slug', slug).single();
      if (!salon) return res.status(404).json({ error: 'Salong ej hittad.' });
      targetSalonId = salon.id;
    }

    const { data: rows, error } = await supabase
      .from('services')
      .select('id, name, active')
      .eq('salon_id', targetSalonId)
      .order('sort_order');

    if (error) throw error;
    const combinations = buildCombos(rows || []);
    res.json({ combinations });
  } catch (err) {
    console.error('booking-combos:', err);
    res.status(500).json({ error: 'Kunde inte hämta kombinationer.' });
  }
});

export default router;
