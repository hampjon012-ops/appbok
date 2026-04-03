#!/usr/bin/env node
/**
 * Skapar eller uppdaterar superadmin-användare (hashat lösenord).
 *
 * SUPERADMIN_BOOTSTRAP_PASSWORD krävs (anges inte i kod).
 * SUPERADMIN_BOOTSTRAP_EMAIL valfri (default: superadmin@appbok.se)
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const SYSTEM_SALON_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const email = (process.env.SUPERADMIN_BOOTSTRAP_EMAIL || 'superadmin@appbok.se').toLowerCase().trim();
const password = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || url.includes('PLACEHOLDER')) {
  console.error('❌ Sätt SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i api/.env');
  process.exit(1);
}

if (!password || password.length < 6) {
  console.error('❌ Kör med: SUPERADMIN_BOOTSTRAP_PASSWORD="..." node api/scripts/ensure-superadmin-user.js');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function ensureSystemSalon() {
  const { data } = await supabase.from('salons').select('id').eq('id', SYSTEM_SALON_ID).maybeSingle();
  if (data) return true;

  const minimal = {
    id: SYSTEM_SALON_ID,
    name: 'Appbok HQ',
    slug: 'appbok-system',
  };
  const { error } = await supabase.from('salons').insert(minimal);
  if (!error) return true;
  if (error.code === '23505') return true;
  const { data: bySlug } = await supabase.from('salons').select('id').eq('slug', 'appbok-system').maybeSingle();
  if (bySlug) return true;
  console.error('❌ Kunde inte skapa system-salong:', error.message);
  return false;
}

async function main() {
  if (!(await ensureSystemSalon())) process.exit(1);

  const passwordHash = await bcrypt.hash(password, 10);

  const { data: rows, error: qErr } = await supabase.from('users').select('id, email').eq('email', email);

  if (qErr) {
    console.error('❌', qErr.message);
    process.exit(1);
  }

  const payloadBase = {
    password_hash: passwordHash,
    salon_id: SYSTEM_SALON_ID,
    name: 'Superadmin',
    title: 'Superadmin',
    active: true,
  };

  let role = 'superadmin';
  if (rows?.length) {
    const { error: uErr } = await supabase
      .from('users')
      .update({ ...payloadBase, role })
      .eq('id', rows[0].id);

    if (uErr && (uErr.message?.includes('check') || uErr.code === '23514')) {
      role = 'admin';
      const { error: u2 } = await supabase.from('users').update({ ...payloadBase, role }).eq('id', rows[0].id);
      if (u2) {
        console.error('❌', u2.message);
        process.exit(1);
      }
      console.log('⚠️  Databasen saknar roll superadmin — satt admin + använd SUPERADMIN_EMAILS i .env');
    } else if (uErr) {
      console.error('❌', uErr.message);
      process.exit(1);
    }
    console.log(`✅ Uppdaterade ${email} (id ${rows[0].id}), roll ${role}`);
  } else {
    const { error: iErr } = await supabase.from('users').insert({
      email,
      ...payloadBase,
      role,
    });

    if (iErr && (iErr.message?.includes('check') || iErr.code === '23514')) {
      role = 'admin';
      const { error: i2 } = await supabase.from('users').insert({
        email,
        ...payloadBase,
        role,
      });
      if (i2) {
        console.error('❌', i2.message);
        process.exit(1);
      }
      console.log('⚠️  Databasen saknar roll superadmin — skapad som admin + SUPERADMIN_EMAILS i .env');
    } else if (iErr) {
      console.error('❌', iErr.message);
      process.exit(1);
    } else {
      console.log(`✅ Skapade ${email} med roll ${role}`);
    }
  }

  console.log('   Lägg till i api/.env: SUPERADMIN_EMAILS=' + email);
  console.log('   Starta om API och logga in.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
