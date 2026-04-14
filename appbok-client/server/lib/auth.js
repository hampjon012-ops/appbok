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
    
    // Impersonation Support for Superadmin
    if (req.user.role === 'superadmin') {
      const impSalonId = req.headers['x-impersonate-salon-id'];
      if (impSalonId) {
        req.user.originalSalonId = req.user.salonId;
        req.user.salonId = impSalonId;
      }
      const impStaffId = req.headers['x-impersonate-staff-id'];
      if (impStaffId) {
        req.user.impersonateStaffId = impStaffId;
      }
    }

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
 * Efter requireAuth: salongsadmin/superadmin, eller staff som endast rör sitt eget user-id i :id.
 * Används för schema (GET/PUT /api/staff/:id/schedule, blocked-days).
 */
export function requireScheduleEditor(req, res, next) {
  const r = req.user?.role;
  if (r === 'admin' || r === 'superadmin') return next();
  if (r === 'staff') {
    if (String(req.params.id) === String(req.user.id)) return next();
    return res.status(403).json({ error: 'Du kan bara redigera ditt eget schema.' });
  }
  return res.status(403).json({ error: 'Åtkomst nekad.' });
}

/**
 * Generate JWT for a user
 */
export function signToken(user) {
  const effective = withEffectiveRole(user);
  const sid = effective.salon_id ?? effective.salonId ?? null;
  return jwt.sign(
    {
      id: effective.id,
      email: effective.email,
      role: effective.role,
      salonId: sid,
      salon_id: sid,
      name: effective.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
