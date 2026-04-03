#!/usr/bin/env node
/**
 * Sätter en befintlig användare till superadmin och kopplar till system-salongen.
 *
 * Enklare utan SQL: lägg i api/.env
 *   SUPERADMIN_EMAILS=du@foretag.se
 * starta om API och logga in igen (JWT får roll superadmin).
 *
 * Detta skript uppdaterar databasen (kräver migrering 003).
 * Krav: api/.env med SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY.
 *
 * Användning:
 *   SUPERADMIN_EMAIL=du@foretag.se npm run promote:superadmin
 *   eller: npm run promote:superadmin -- du@foretag.se
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const SYSTEM_SALON_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const emailArg = process.argv[2];
const email = (process.env.SUPERADMIN_EMAIL || emailArg || '').toLowerCase().trim();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || url.includes('PLACEHOLDER')) {
  console.error('❌ Sätt SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i api/.env');
  process.exit(1);
}

if (!email || !email.includes('@')) {
  console.error('❌ Ange e-post: SUPERADMIN_EMAIL=du@... npm run promote:superadmin');
  console.error('   eller: npm run promote:superadmin -- du@...');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: salon, error: sErr } = await supabase
    .from('salons')
    .select('id')
    .eq('id', SYSTEM_SALON_ID)
    .maybeSingle();

  if (sErr) {
    console.error('❌ Supabase:', sErr.message);
    process.exit(1);
  }

  if (!salon) {
    console.error('❌ System-salong saknas. Kör api/migrations/003_superadmin.sql i Supabase först.');
    process.exit(1);
  }

  const { data: user, error: uErr } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('email', email)
    .maybeSingle();

  if (uErr) {
    console.error('❌ Supabase:', uErr.message);
    process.exit(1);
  }

  if (!user) {
    console.error(`❌ Ingen användare med e-post ${email}. Skapa konto via /login (registrera) först.`);
    process.exit(1);
  }

  const { error: upErr } = await supabase
    .from('users')
    .update({
      role: 'superadmin',
      salon_id: SYSTEM_SALON_ID,
    })
    .eq('id', user.id);

  if (upErr) {
    if (upErr.message?.includes('check') || upErr.code === '23514') {
      console.error('❌ Databasen tillåter inte rollen superadmin. Kör 003_superadmin.sql i Supabase SQL Editor.');
    } else {
      console.error('❌ Uppdatering misslyckades:', upErr.message);
    }
    process.exit(1);
  }

  console.log(`✅ ${email} är nu superadmin (kopplad till Appbok HQ).`);
  console.log('   Logga ut och in igen i admin så JWT får ny roll.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
