const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required. Copy .env.example to .env and set a strong secret.');
}

const COOKIE_NAME = 'azie_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

function signSession(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

function setSessionCookie(res, user) {
  const token = signSession(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

async function getUserById(id) {
  const { rows } = await db.query(
    'SELECT id, username, full_name, is_super_admin, is_active FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة، الرجاء تسجيل الدخول من جديد' });
  }
  try {
    const user = await getUserById(payload.sub);
    if (!user || !user.is_active) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'الحساب غير موجود أو معطّل' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.is_super_admin) {
    return res.status(403).json({ error: 'هذا الإجراء متاح لمدير المنصة فقط' });
  }
  next();
}

async function userHasAppAccess(user, appId) {
  if (!user) return false;
  if (user.is_super_admin) return true;
  const { rows } = await db.query(
    'SELECT 1 FROM permissions WHERE user_id = $1 AND app_id = $2',
    [user.id, appId]
  );
  return rows.length > 0;
}

function requireAppAccess(getAppId) {
  return async (req, res, next) => {
    const appId = typeof getAppId === 'function' ? getAppId(req) : getAppId;
    try {
      const allowed = await userHasAppAccess(req.user, appId);
      if (!allowed) {
        return res.status(403).json({ error: 'ليست لديك صلاحية للوصول إلى هذا التطبيق' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie,
  getUserById,
  requireAuth,
  requireSuperAdmin,
  requireAppAccess,
  userHasAppAccess,
};
