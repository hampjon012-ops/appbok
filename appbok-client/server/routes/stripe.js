import { Router } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { salonAcceptsPublicBookings, SALON_PREVIEW_FORBIDDEN_MESSAGE } from '../lib/salonPublicBookingGate.js';

const router = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('PLACEHOLDER')) return null;
  return new Stripe(key, { apiVersion: '2026-01-28.clover' });
}

function getPublishableKey() {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key || key.includes('PLACEHOLDER')) return null;
  return key;
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

// GET /api/stripe/connect-dashboard — Stripe Express / connected account login link
router.get('/connect-dashboard', requireAuth, requireAdmin, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe ej konfigurerat.' });
  try {
    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from('salons')
      .select('stripe_account_id')
      .eq('id', req.user.salonId)
      .single();
    if (error) throw error;
    if (!row?.stripe_account_id) {
      return res.status(400).json({ error: 'Inget Stripe-konto är anslutet.' });
    }
    const loginLink = await stripe.accounts.createLoginLink(row.stripe_account_id);
    return res.json({ url: loginLink.url });
  } catch (err) {
    console.error('[stripe/connect-dashboard]', err);
    return res.status(500).json({ error: err.message || 'Kunde inte öppna Stripe Dashboard.' });
  }
});

// POST /api/stripe/disconnect — ta bort anslutet Stripe-konto från salongen
router.post('/disconnect', requireAuth, requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: row, error: fetchErr } = await supabase
      .from('salons')
      .select('contact')
      .eq('id', req.user.salonId)
      .single();
    if (fetchErr) throw fetchErr;
    const contact =
      row?.contact && typeof row.contact === 'object' ? { ...row.contact } : {};
    contact.stripe_connected = false;

    const { data, error } = await supabase
      .from('salons')
      .update({ stripe_account_id: null, contact })
      .eq('id', req.user.salonId)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('[stripe/disconnect]', err);
    return res.status(500).json({ error: err.message || 'Kunde inte koppla från Stripe.' });
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

// POST /api/stripe/create-payment-intent — public, used by embedded PaymentElement
router.post('/create-payment-intent', async (req, res) => {
  const stripe = getStripe();
  const publishableKey = getPublishableKey();

  if (!stripe) {
    return res.status(503).json({ error: 'Stripe ej konfigurerat.' });
  }
  if (!publishableKey) {
    return res.status(503).json({ error: 'STRIPE_PUBLISHABLE_KEY saknas i server/.env.' });
  }

  const {
    salonId,
    serviceName,
    customerName,
    customerEmail,
    stylistName,
    date,
    time,
    amount,
  } = req.body || {};

  const amountInt = Number(amount);
  if (!Number.isInteger(amountInt) || amountInt <= 0) {
    return res.status(400).json({ error: 'Ogiltigt belopp för betalning.' });
  }

  try {
    const salonIdStr = salonId ? String(salonId) : '';
    if (!salonIdStr) {
      return res.status(400).json({ error: 'salonId saknas.' });
    }

    const supabase = getSupabaseAdmin();
    const { data: salon, error: salonErr } = await supabase
      .from('salons')
      .select('stripe_account_id, status')
      .eq('id', salonIdStr)
      .maybeSingle();

    if (salonErr) throw salonErr;

    if (!salonAcceptsPublicBookings(salon?.status)) {
      return res.status(403).json({
        error: SALON_PREVIEW_FORBIDDEN_MESSAGE,
        code: 'SALON_PREVIEW',
      });
    }

    const connectedAccountId = salon?.stripe_account_id || null;
    if (!connectedAccountId) {
      return res.status(400).json({ error: 'Salongen har inte anslutit Stripe ännu.' });
    }

    const connectedAccount = await stripe.accounts.retrieve(connectedAccountId);
    if (!connectedAccount.details_submitted || !connectedAccount.charges_enabled) {
      return res.status(400).json({
        error:
          'Stripe-kontot är anslutet men inte färdigaktiverat för betalningar ännu. Slutför konto-onboarding i Stripe Dashboard för detta konto.',
        stripeAccountId: connectedAccountId,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInt,
        currency: 'sek',
        automatic_payment_methods: { enabled: true },
        receipt_email: customerEmail || undefined,
        metadata: {
          salonId: salonIdStr,
          serviceName: serviceName ? String(serviceName) : '',
          stylistName: stylistName ? String(stylistName) : '',
          date: date ? String(date) : '',
          time: time ? String(time) : '',
          customerName: customerName ? String(customerName) : '',
          customerEmail: customerEmail ? String(customerEmail) : '',
        },
      },
      { stripeAccount: connectedAccountId },
    );

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey,
      stripeAccountId: connectedAccountId,
    });
  } catch (err) {
    console.error('[stripe/create-payment-intent]', err);
    return res.status(500).json({ error: err.message || 'Kunde inte skapa PaymentIntent.' });
  }
});

// ── Subscription management (Appbok platform billing) ────────────────────────

// GET /api/stripe/subscription/status — subscription status for current salon
router.get('/subscription/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.json({ active: false, subscriptionStatus: 'none' });

    const supabase = getSupabaseAdmin();
    const { data: salon, error } = await supabase
      .from('salons')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', req.user.salonId)
      .single();

    if (error) throw error;

    if (!salon?.stripe_subscription_id) {
      return res.json({
        active: false,
        subscriptionStatus: salon?.subscription_status || 'none',
        card: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    // Fetch live data from Stripe
    const sub = await stripe.subscriptions.retrieve(salon.stripe_subscription_id, {
      expand: ['default_payment_method'],
    });

    const pm = sub.default_payment_method;
    const card = pm?.card
      ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }
      : null;

    return res.json({
      active: sub.status === 'active' || sub.status === 'trialing',
      subscriptionStatus: sub.status,
      card,
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
    });
  } catch (err) {
    console.error('[stripe/subscription/status]', err);
    return res.status(500).json({ error: err.message || 'Kunde inte hämta prenumerationsstatus.' });
  }
});

// POST /api/stripe/subscription/setup — create Stripe Checkout for new subscription
router.post('/subscription/setup', requireAuth, requireAdmin, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe ej konfigurerat.' });

  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID?.trim();
  if (!priceId) {
    return res.status(503).json({ error: 'STRIPE_SUBSCRIPTION_PRICE_ID saknas i .env.' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: salon, error: salonErr } = await supabase
      .from('salons')
      .select('id, name, stripe_customer_id')
      .eq('id', req.user.salonId)
      .single();

    if (salonErr) throw salonErr;

    // Create or reuse Stripe Customer
    let customerId = salon.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: salon.name || 'Salong',
        metadata: { salonId: salon.id, userEmail: req.user.email || '' },
      });
      customerId = customer.id;

      await supabase
        .from('salons')
        .update({ stripe_customer_id: customerId })
        .eq('id', salon.id);
    }

    const origin = webOrigin();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/admin?subscription=success`,
      cancel_url: `${origin}/admin?subscription=canceled`,
      metadata: { salonId: salon.id },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/subscription/setup]', err);
    return res.status(500).json({ error: err.message || 'Kunde inte starta prenumeration.' });
  }
});

// POST /api/stripe/subscription/cancel — cancel at period end
router.post('/subscription/cancel', requireAuth, requireAdmin, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe ej konfigurerat.' });

  try {
    const supabase = getSupabaseAdmin();
    const { data: salon, error } = await supabase
      .from('salons')
      .select('stripe_subscription_id')
      .eq('id', req.user.salonId)
      .single();

    if (error) throw error;
    if (!salon?.stripe_subscription_id) {
      return res.status(400).json({ error: 'Ingen aktiv prenumeration att avbryta.' });
    }

    await stripe.subscriptions.update(salon.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await supabase
      .from('salons')
      .update({ subscription_status: 'canceling' })
      .eq('id', req.user.salonId);

    return res.json({ success: true, cancelAtPeriodEnd: true });
  } catch (err) {
    console.error('[stripe/subscription/cancel]', err);
    return res.status(500).json({ error: err.message || 'Kunde inte avbryta prenumeration.' });
  }
});

// POST /api/stripe/subscription/portal — open Stripe Billing Portal
router.post('/subscription/portal', requireAuth, requireAdmin, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe ej konfigurerat.' });

  try {
    const supabase = getSupabaseAdmin();
    const { data: salon, error } = await supabase
      .from('salons')
      .select('stripe_customer_id')
      .eq('id', req.user.salonId)
      .single();

    if (error) throw error;
    if (!salon?.stripe_customer_id) {
      return res.status(400).json({ error: 'Inget Stripe-kundkonto kopplat.' });
    }

    const origin = webOrigin();
    const session = await stripe.billingPortal.sessions.create({
      customer: salon.stripe_customer_id,
      return_url: `${origin}/admin`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/subscription/portal]', err);
    return res.status(500).json({ error: err.message || 'Kunde inte öppna kundportalen.' });
  }
});

// ── Webhook handler (exported for use in server.js with raw body) ────────────
export async function handleStripeWebhook(req, res) {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send('Stripe ej konfigurerat.');

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Dev mode: parse body directly (no signature verification)
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.warn('[stripe/webhook] ⚠️  Ingen STRIPE_WEBHOOK_SECRET — signatur ej verifierad.');
    }
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const salonId = session.metadata?.salonId;
          if (salonId) {
            await supabase
              .from('salons')
              .update({
                stripe_subscription_id: session.subscription,
                subscription_status: 'active',
              })
              .eq('id', salonId);
            console.log(`[stripe/webhook] ✅ Subscription activated for salon ${salonId}`);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          // Update status to active (handles reactivation after failed payment)
          const { data: salons } = await supabase
            .from('salons')
            .select('id')
            .eq('stripe_subscription_id', invoice.subscription);
          if (salons?.length) {
            await supabase
              .from('salons')
              .update({ subscription_status: 'active' })
              .eq('stripe_subscription_id', invoice.subscription);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await supabase
            .from('salons')
            .update({ subscription_status: 'past_due' })
            .eq('stripe_subscription_id', invoice.subscription);
          console.warn(`[stripe/webhook] ⚠️  Payment failed for subscription ${invoice.subscription}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase
          .from('salons')
          .update({ subscription_status: 'canceled', stripe_subscription_id: null })
          .eq('stripe_subscription_id', sub.id);
        console.log(`[stripe/webhook] ❌ Subscription deleted: ${sub.id}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const newStatus = sub.cancel_at_period_end ? 'canceling' : sub.status;
        await supabase
          .from('salons')
          .update({ subscription_status: newStatus })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      default:
        // Unhandled event type
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    // Return 200 anyway to prevent Stripe from retrying
  }

  return res.json({ received: true });
}

export default router;
