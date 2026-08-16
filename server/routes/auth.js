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

function getAllowedApps(user) {
  const apps = db.prepare('SELECT * FROM apps ORDER BY sort_order ASC').all();
  return apps
    .filter((app) => userHasAppAccess(user, app.id))
    .map((app) => ({ ...app, tags: JSON.parse(app.tags) }));
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'الرجاء إدخال اسم المستخدم وكلمة المرور' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
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
    apps: getAllowedApps(user),
  });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      full_name: req.user.full_name,
      is_super_admin: !!req.user.is_super_admin,
    },
    apps: getAllowedApps(req.user),
  });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password || new_password.length < 8) {
    return res
      .status(400)
      .json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل، ويجب إدخال كلمة المرور الحالية' });
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, row.password_hash)) {
    return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }
  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
