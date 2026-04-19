import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { adminDashboardOrigin } from '../lib/publicAppOrigin.js';

const router = Router();

/**
 * GET /api/verify?token=...
 * Markerar salongens e-post som verifierad och redirectar till admin-dashboard.
 */
router.get('/verify', async (req, res) => {
  const raw = req.query.token;
  const token = typeof raw === 'string' ? raw.trim() : '';
  const adminOrigin = adminDashboardOrigin();

  if (!token) {
    return res.redirect(302, `${adminOrigin}/admin/dashboard?verify_error=missing`);
  }

  try {
    const { data: salon, error: findErr } = await supabase
      .from('salons')
      .select('id')
      .eq('verification_token', token)
      .maybeSingle();

    if (findErr) {
      console.error('[verify] lookup:', findErr);
      return res.redirect(302, `${adminOrigin}/admin/dashboard?verify_error=invalid`);
    }
    if (!salon?.id) {
      return res.redirect(302, `${adminOrigin}/admin/dashboard?verify_error=invalid`);
    }

    const { error: updErr } = await supabase
      .from('salons')
      .update({ email_verified: true, verification_token: null })
      .eq('id', salon.id);

    if (updErr) {
      console.error('[verify] update:', updErr);
      return res.redirect(302, `${adminOrigin}/admin/dashboard?verify_error=failed`);
    }

    return res.redirect(302, `${adminOrigin}/admin/dashboard?verified=true`);
  } catch (err) {
    console.error('[verify]', err);
    return res.redirect(302, `${adminOrigin}/admin/dashboard?verify_error=failed`);
  }
});

export default router;
