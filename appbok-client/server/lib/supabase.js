import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from the server/ directory (parent of lib/)
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || supabaseUrl.includes('PLACEHOLDER')) {
  console.warn('⚠️  SUPABASE_URL saknas i server/.env — DB-funktioner kommer inte att fungera');
}

// Service role client — bypasses RLS, use only on server side
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder',
  { auth: { persistSession: false } }
);

export default supabase;
