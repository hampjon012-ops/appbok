import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/** Om e-post finns i SUPERADMIN_EMAILS (api/.env) → superadmin i JWT utan DB-migrering */
export function isEnvSuperAdminEmail(email) {
  if (!email || !process.env.SUPERADMIN_EMAILS) return false;
  const list = process.env.SUPERADMIN_EMAILS.split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email).toLowerCase());
}

export function withEffectiveRole(user) {
  if (!user) return user;
  const role = isEnvSuperAdminEmail(user.email) ? 'superadmin' : user.role;
  return { ...user, role };
}

/**
 * Auth middleware — verifies JWT and attaches user info to req.user
 * Usage: router.get('/protected', requireAuth, handler)
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Ingen autentisering. Logga in först.' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, salonId, name }
    next();
  } catch {
    return res.status(401).json({ error: 'Ogiltig eller utgången token.' });
  }
}

/**
 * Admin-only middleware — must be used AFTER requireAuth
 * Superadmin har samma salongs‑API som admin (JWT innehåller salonId).
 */
export function requireAdmin(req, res, next) {
  const r = req.user?.role;
  if (r !== 'admin' && r !== 'superadmin') {
    return res.status(403).json({ error: 'Bara administratörer har åtkomst.' });
  }
  next();
}

/** Superadmin — efter requireAuth */
export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Bara superadmin har åtkomst.' });
  }
  next();
}

/**
 * Generate JWT for a user
 */
export function signToken(user) {
  const effective = withEffectiveRole(user);
  return jwt.sign(
    {
      id: effective.id,
      email: effective.email,
      role: effective.role,
      salonId: effective.salon_id,
      name: effective.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
