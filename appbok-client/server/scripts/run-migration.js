#!/usr/bin/env node
/**
 * Kör SQL-migrering direkt mot PostgreSQL via pg.
 * Användning: node server/scripts/run-migration.js [sql-fil]
 *
 * Miljövariabler (sätt i server/.env):
 *   DB_HOST=aws-0-xxx.pooler.supabase.com   (Connection string från Supabase → Settings → Connection Pooling)
 *   DB_PORT=6543
 *   DB_NAME=postgres
 *   DB_USER=postgres.xxx
 *   DB_PASSWORD=xxx
 *
 * ELLER ange hela anslutningssträngen:
 *   DATABASE_URL=postgres://postgres.xxx:xxx@aws-0-xxx.pooler.supabase.com:6543/postgres
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const defaultSql = join(__dirname, '..', 'migrations', '004_add_salon_meta.sql');
const sqlFile = process.argv[2] || defaultSql;
const sql = readFileSync(sqlFile, 'utf8').trim();

if (!sql) {
  console.error('❌ Tom fil:', sqlFile);
  process.exit(1);
}

let config;
if (process.env.DATABASE_URL) {
  config = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
} else if (process.env.DB_HOST) {
  config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '6543'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  };
} else {
  console.error('❌ Ingen databasanslutning. Ange i server/.env:');
  console.error('   DATABASE_URL=postgres://...');
  console.error('   (Kopiera från Supabase → Settings → Connection Pooling)');
  console.error('');
  console.error('   SQL att köra manuellt i SQL Editor:');
  console.error('   ──'.repeat(30));
  console.error(sql);
  console.error('   ──'.repeat(30));
  process.exit(1);
}

const client = new pg.Client(config);

try {
  await client.connect();
  await client.query(sql);
  console.log('✅ Migrering klar!');
} catch (e) {
  console.error('❌ Fel:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
