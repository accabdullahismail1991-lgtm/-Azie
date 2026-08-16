const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireSuperAdmin } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireSuperAdmin);

function userPublicShape(u) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    is_super_admin: !!u.is_super_admin,
    is_active: !!u.is_active,
    created_at: u.created_at,
  };
}

// --- Apps -------------------------------------------------------------
router.get('/apps', (req, res) => {
  const apps = db.prepare('SELECT * FROM apps ORDER BY sort_order ASC').all();
  res.json(apps.map((a) => ({ ...a, tags: JSON.parse(a.tags) })));
});

// --- Users --------------------------------------------------------------
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  const permRows = db.prepare('SELECT user_id, app_id FROM permissions').all();
  const permsByUser = {};
  for (const row of permRows) {
    (permsByUser[row.user_id] ||= []).push(row.app_id);
  }
  res.json(
    users.map((u) => ({ ...userPublicShape(u), apps: permsByUser[u.id] || [] }))
  );
});

router.post('/users', (req, res) => {
  const { username, full_name, password, is_super_admin, apps } = req.body || {};
  if (!username || !full_name || !password || password.length < 8) {
    return res.status(400).json({
      error: 'اسم المستخدم والاسم الكامل مطلوبان، وكلمة المرور يجب أن تكون 8 أحرف على الأقل',
    });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });
  }
  const hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare(
      'INSERT INTO users (username, full_name, password_hash, is_super_admin, is_active) VALUES (?,?,?,?,1)'
    )
    .run(username.trim(), full_name.trim(), hash, is_super_admin ? 1 : 0);
  const userId = Number(info.lastInsertRowid);

  if (Array.isArray(apps)) {
    const validAppIds = new Set(db.prepare('SELECT id FROM apps').all().map((a) => a.id));
    for (const appId of apps) {
      if (validAppIds.has(appId)) {
        db.prepare(
          'INSERT OR IGNORE INTO permissions (user_id, app_id, granted_by) VALUES (?,?,?)'
        ).run(userId, appId, req.user.id);
      }
    }
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.status(201).json(userPublicShape(user));
});

router.patch('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const { full_name, is_active, is_super_admin, password } = req.body || {};

  if (id === req.user.id && is_active === false) {
    return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الخاص' });
  }
  if (id === req.user.id && is_super_admin === false) {
    return res.status(400).json({ error: 'لا يمكنك إلغاء صلاحيتك كمدير عن نفسك' });
  }

  if (full_name !== undefined) {
    db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name.trim(), id);
  }
  if (is_active !== undefined) {
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
  }
  if (is_super_admin !== undefined) {
    db.prepare('UPDATE users SET is_super_admin = ? WHERE id = ?').run(is_super_admin ? 1 : 0, id);
  }
  if (password) {
    if (password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    }
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(userPublicShape(updated));
});

router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// --- Per-app permissions -------------------------------------------------
router.post('/permissions', (req, res) => {
  const { user_id, app_id } = req.body || {};
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
  const app = db.prepare('SELECT id FROM apps WHERE id = ?').get(app_id);
  if (!user || !app) return res.status(404).json({ error: 'مستخدم أو تطبيق غير موجود' });
  db.prepare(
    'INSERT OR IGNORE INTO permissions (user_id, app_id, granted_by) VALUES (?,?,?)'
  ).run(user_id, app_id, req.user.id);
  res.json({ ok: true });
});

router.delete('/permissions/:user_id/:app_id', (req, res) => {
  const { user_id, app_id } = req.params;
  db.prepare('DELETE FROM permissions WHERE user_id = ? AND app_id = ?').run(
    Number(user_id),
    app_id
  );
  res.json({ ok: true });
});

module.exports = router;
