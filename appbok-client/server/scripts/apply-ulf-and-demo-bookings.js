#!/usr/bin/env node
/**
 * Ulf Jonsson som stylist + demobokningar för Colorisma (motsvarar 007 SQL).
 * Kräver SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY i server/.env
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabase from '../lib/supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const SALON = 'a0000000-0000-0000-0000-000000000001';

async function main() {
  const { error: uErr } = await supabase
    .from('users')
    .update({
      email: 'ulf@colorisma.se',
      name: 'Ulf Jonsson',
      title: 'Frisör & Stylist',
    })
    .eq('id', 'c0000000-0000-0000-0000-000000000002')
    .eq('salon_id', SALON);

  if (uErr) console.error('Ulf-update (id):', uErr.message);
  else console.log('✅ Stylist satt till Ulf Jonsson (fast UUID).');

  await supabase
    .from('users')
    .update({
      email: 'ulf@colorisma.se',
      name: 'Ulf Jonsson',
      title: 'Frisör & Stylist',
    })
    .eq('salon_id', SALON)
    .eq('email', 'marcus@colorisma.se');

  const { data: svc } = await supabase
    .from('services')
    .select('id, name')
    .eq('salon_id', SALON);
  const byName = (n) => svc?.find((s) => s.name === n)?.id;

  const { data: stylists } = await supabase
    .from('users')
    .select('id, email')
    .eq('salon_id', SALON)
    .eq('role', 'staff');
  const sid = (email) => stylists?.find((u) => u.email === email)?.id;

  const rows = [
    {
      salon_id: SALON,
      service_id: byName('Klippning inkl. tvätt & fön'),
      stylist_id: sid('ulf@colorisma.se'),
      customer_name: 'Anna Andersson',
      customer_email: 'anna@exempel.se',
      customer_phone: '070-111 22 33',
      booking_date: addDays(1),
      booking_time: '10:00:00',
      duration_minutes: 60,
      status: 'confirmed',
      amount_paid: 75000,
    },
    {
      salon_id: SALON,
      service_id: byName('Balayage / Ombre'),
      stylist_id: sid('emma@colorisma.se'),
      customer_name: 'Björn Svensson',
      customer_email: 'bjorn@exempel.se',
      customer_phone: '',
      booking_date: addDays(3),
      booking_time: '14:00:00',
      duration_minutes: 180,
      status: 'confirmed',
      amount_paid: 0,
    },
    {
      salon_id: SALON,
      service_id: byName('Tvätt & Fön'),
      stylist_id: sid('sofia@colorisma.se'),
      customer_name: 'Cecilia Holm',
      customer_email: '',
      customer_phone: '073-999 88 77',
      booking_date: addDays(5),
      booking_time: '11:30:00',
      duration_minutes: 30,
      status: 'confirmed',
      amount_paid: 0,
    },
  ];

  for (const r of rows) {
    if (!r.service_id || !r.stylist_id) {
      console.warn('⚠️  Hoppar över bokning (saknar tjänst/stylist):', r.customer_name);
      continue;
    }
    let q = supabase.from('bookings').select('id').eq('salon_id', SALON).limit(1);
    if (r.customer_email) q = supabase.from('bookings').select('id').eq('salon_id', SALON).eq('customer_email', r.customer_email);
    else q = supabase.from('bookings').select('id').eq('salon_id', SALON).eq('customer_phone', r.customer_phone);
    const { data: existing } = await q.maybeSingle();
    if (existing) {
      console.log('— Finns redan:', r.customer_name);
      continue;
    }
    const { error } = await supabase.from('bookings').insert(r);
    if (error) console.error('Bokning', r.customer_name, error.message);
    else console.log('✅ Demobokning:', r.customer_name);
  }
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
