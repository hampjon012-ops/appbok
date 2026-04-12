import { Router } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, requireAdmin } from '../lib/auth.js';

const router = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('PLACEHOLDER')) return null;
  return new Stripe(key, { apiVersion: '2024-04-10' });
}

function apiOrigin(req) {
  const explicit = process.env.API_PUBLIC_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* ignore */
    }
  }
  // Local dev: force localhost to match Stripe Connect redirect allowlist.
  if (!process.env.VERCEL && !process.env.NODE_ENV?.includes('production')) {
    return 'http://localhost:3001';
  }
  return `${req.protocol}://${req.get('host')}`;
}

function webOrigin() {
  const explicit = process.env.APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* ignore */
    }
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
}

function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// GET /api/stripe/connect — start Stripe Connect OAuth
router.get('/connect', requireAuth, requireAdmin, (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe ej konfigurerat.' });

  const clientId = process.env.STRIPE_CLIENT_ID?.trim();
  if (!clientId) {
    return res.status(503).json({ error: 'STRIPE_CLIENT_ID saknas i server/.env.' });
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: `${apiOrigin(req)}/api/stripe/callback`,
    state: String(req.user.salonId || ''),
  });

  const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  return res.json({ url });
});

// GET /api/stripe/callback — Stripe OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state: salonId, error: oauthError } = req.query;
  const adminUrl = `${webOrigin()}/admin`;

  if (oauthError) {
    return res.redirect(`${adminUrl}?stripe_error=${encodeURIComponent(String(oauthError))}`);
  }
  if (!code || !salonId) {
    return res.redirect(`${adminUrl}?stripe_error=missing_params`);
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.redirect(`${adminUrl}?stripe_error=not_configured`);
  }

  try {
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code: String(code),
    });

    // OAuth response field varies by account type/setup.
    const stripeAccountId = response.stripe_user_id || response.stripe_account_id || null;
    if (!stripeAccountId) {
      throw new Error('Inget Stripe-konto returnerades från OAuth.');
    }

    const supabase = getSupabaseAdmin();
    const { error: dbErr } = await supabase
      .from('salons')
      .update({ stripe_account_id: stripeAccountId })
      .eq('id', String(salonId));

    if (dbErr) throw dbErr;

    return res.redirect(`${adminUrl}?stripe_connected=1`);
  } catch (err) {
    console.error('[stripe/callback]', err);
    return res.redirect(`${adminUrl}?stripe_error=${encodeURIComponent(err.message || 'oauth_failed')}`);
  }
});

// GET /api/stripe/status — is Stripe connected for this salon?
router.get('/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('salons')
      .select('stripe_account_id')
      .eq('id', req.user.salonId)
      .single();

    if (error) throw error;

    return res.json({
      connected: Boolean(data?.stripe_account_id),
      accountId: data?.stripe_account_id || null,
    });
  } catch (err) {
    console.error('[stripe/status]', err);
    return res.status(500).json({ error: err.message || 'Kunde inte läsa Stripe-status.' });
  }
});

export default router;
