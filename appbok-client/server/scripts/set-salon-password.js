#!/usr/bin/env node
/**
 * Sätter lösenord (bcrypt) för en befintlig användare.
 * TARGET_EMAIL, TARGET_PASSWORD i miljö (eller argument: e-post och lösenord).
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const email = (process.env.TARGET_EMAIL || process.argv[2] || '').toLowerCase().trim();
const password = process.env.TARGET_PASSWORD || process.argv[3];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ api/.env: SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY krävs.');
  process.exit(1);
}
if (!email || !password) {
  console.error('❌ Användning: TARGET_EMAIL=... TARGET_PASSWORD=... node api/scripts/set-salon-password.js');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const { data: rows, error: qErr } = await supabase.from('users').select('id').eq('email', email);
  if (qErr || !rows?.length) {
    console.error('❌ Hittar ingen användare med e-post:', email);
    process.exit(1);
  }
  const { error: uErr } = await supabase.from('users').update({ password_hash: hash }).eq('id', rows[0].id);
  if (uErr) {
    console.error('❌', uErr.message);
    process.exit(1);
  }
  console.log('✅ Lösenord uppdaterat för', email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
