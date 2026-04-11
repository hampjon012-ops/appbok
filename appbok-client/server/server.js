import Stripe from 'stripe';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Route imports
import authRoutes from './routes/auth.js';
import servicesRoutes from './routes/services.js';
import staffRoutes from './routes/staff.js';
import bookingsRoutes from './routes/bookings.js';
import statsRoutes from './routes/stats.js';
import calendarRoutes from './routes/calendar.js';
import salonsRoutes from './routes/salons.js';
import superadminRoutes from './routes/superadmin.js';
import { scrapeBokadirekt, prepareForImport } from './lib/bokadirektScraper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

/** Publik bas-URL för Stripe m.m. (Vercel sätter VERCEL_URL utan protokoll.) */
export function publicAppOrigin() {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* ignore */
    }
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:5173';
}

function corsOrigin(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      callback(null, true);
      return;
    }
    if (hostname.endsWith('.localhost')) {
      callback(null, true);
      return;
    }
    if (hostname.endsWith('.vercel.app')) {
      callback(null, true);
      return;
    }
    /** Multi-tenant: www, admin, salongs-subdomäner — samma API som www.appbok.se */
    if (hostname === 'appbok.se' || hostname.endsWith('.appbok.se')) {
      callback(null, true);
      return;
    }
    if (process.env.PUBLIC_APP_URL) {
      const allowed = new URL(process.env.PUBLIC_APP_URL).hostname;
      if (hostname === allowed) {
        callback(null, true);
        return;
      }
    }
  } catch {
    callback(null, false);
    return;
  }
  callback(null, false);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/salons', salonsRoutes);
app.use('/api/superadmin', superadminRoutes);

// ── Bokadirekt scraper ──────────────────────────────────────────────────────
app.get('/api/scrape/bokadirekt', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Ange en bokadirekt.se-URL som ?url=…' });
  }

  try {
    const data = await scrapeBokadirekt(url);
    const services = prepareForImport(data);
    res.json({ ...data, services });
  } catch (err) {
    console.error('[scrape/bokadirekt]', err.message);
    res.status(422).json({ error: err.message || 'Kunde inte hämta tjänster från Bokadirekt.' });
  }
});

// ── Stripe Checkout (kept for backward compat) ──────────────────────────────
app.post('/api/create-checkout-session', async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey || stripeKey.includes('PLACEHOLDER')) {
    return res.status(503).json({
      error: 'Stripe ej konfigurerat. Lägg till STRIPE_SECRET_KEY i server/.env (lokalt) eller i Vercel Environment Variables.',
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' });

  const {
    serviceName,
    priceAmount,
    currency = 'sek',
    salonName,
    stylistName,
    date,
    time,
    customerName,
    customerEmail,
  } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: serviceName,
              description: `${salonName} — ${stylistName} · ${date} kl ${time}`,
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      metadata: { customerName, customerEmail, stylistName, date, time, serviceName },
      success_url: `${publicAppOrigin()}/tack?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicAppOrigin()}/#boka-nu`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const supabaseOk = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('PLACEHOLDER');
  const stripeOk = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER');
  res.json({
    status: 'ok',
    port: PORT,
    supabase: supabaseOk ? '✅' : '⚠️  Platshållare',
    stripe: stripeOk ? '✅' : '⚠️  Platshållare',
  });
});

export { app };

// ── Start (lokalt / Node — inte på Vercel där api/index.js används) ───────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🟢 API-server körs på http://localhost:${PORT}`);
    const supabaseOk = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('PLACEHOLDER');
    const stripeOk = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER');
    console.log(`📦 Supabase: ${supabaseOk ? '✅ Konfigurerat' : '⚠️  Platshållare – fyll i server/.env'}`);
    console.log(`💳 Stripe:   ${stripeOk ? '✅ Konfigurerat' : '⚠️  Platshållare – fyll i server/.env'}`);
    const saN = process.env.SUPERADMIN_EMAILS
      ? process.env.SUPERADMIN_EMAILS.split(/[,;]+/).filter((s) => s.trim()).length
      : 0;
    console.log(`👑 Superadmin via .env: ${saN > 0 ? `✅ ${saN} e-postadress(er) (SUPERADMIN_EMAILS)` : '— (valfritt)'}`);
    console.log(`\n📡 Routes:`);
    console.log(`   POST /api/auth/register`);
    console.log(`   POST /api/auth/login`);
    console.log(`   GET  /api/auth/me`);
    console.log(`   GET  /api/services`);
    console.log(`   GET  /api/staff`);
    console.log(`   GET  /api/bookings`);
    console.log(`   GET  /api/stats/overview`);
    console.log(`   GET  /api/stats/monthly`);
    console.log(`   GET  /api/calendar/status`);
    console.log(`   GET  /api/calendar/connect`);
    console.log(`   GET  /api/calendar/busy`);
    console.log(`   POST /api/create-checkout-session`);
    console.log(`   GET  /api/superadmin/salons (superadmin)\n`);
  });
}

// ── TEMP MIGRATION ROUTE ────────────────────────────────────────────────
app.post('/api/admin/migrate-trial-ends', async (req, res) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return res.status(500).json({ error: 'No service role key' });
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      key,
      { db: { schema: 'public' } }
    );
    const { error } = await supabaseAdmin.rpc('exec', {
      query: 'ALTER TABLE salons ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;'
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[migrate-trial-ends]', err);
    res.status(500).json({ error: err.message });
  }
});
