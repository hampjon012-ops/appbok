import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getAdminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('[cron/expire-trials] CRON_SECRET not set — rejecting request');
    return res.status(500).json({ error: 'Cron secret not configured.' });
  }
  const provided = req.headers['x-cron-secret'];
  if (provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

async function expireTrialsBatch(supabase) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('salons')
    .update({ status: 'expired' })
    .eq('status', 'trial')
    .lt('trial_ends_at', nowIso)
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}

const handler = async (req, res) => {
  try {
    const count = await expireTrialsBatch(getAdminClient());
    res.json({ expired: count });
  } catch (err) {
    console.error('[cron/expire-trials]', err);
    res.status(500).json({ error: 'Cron failed.' });
  }
};

router.get('/', requireCronSecret, handler);
router.post('/', requireCronSecret, handler);

export default router;
