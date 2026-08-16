const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const {
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  userHasAppAccess,
} = require('../auth');

const router = express.Router();

async function getAllowedApps(user) {
  const { rows: apps } = await db.query('SELECT * FROM apps ORDER BY sort_order ASC');
  const allowed = [];
  for (const app of apps) {
    if (await userHasAppAccess(user, app.id)) {
      allowed.push({ ...app, tags: JSON.parse(app.tags) });
    }
  }
  return allowed;
}

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'الرجاء إدخال اسم المستخدم وكلمة المرور' });
    }
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    const user = rows[0];
    if (!user || !user.is_active || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    setSessionCookie(res, user);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        is_super_admin: !!user.is_super_admin,
      },
      apps: await getAllowedApps(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name,
        is_super_admin: !!req.user.is_super_admin,
      },
      apps: await getAllowedApps(req.user),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password || new_password.length < 8) {
      return res.status(400).json({
        error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل، ويجب إدخال كلمة المرور الحالية',
      });
    }
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [
      req.user.id,
    ]);
    if (!bcrypt.compareSync(current_password, rows[0].password_hash)) {
      return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }
    const hash = bcrypt.hashSync(new_password, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
