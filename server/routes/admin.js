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
router.get('/apps', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM apps ORDER BY sort_order ASC');
    res.json(rows.map((a) => ({ ...a, tags: JSON.parse(a.tags) })));
  } catch (err) {
    next(err);
  }
});

// --- Users --------------------------------------------------------------
router.get('/users', async (req, res, next) => {
  try {
    const { rows: users } = await db.query('SELECT * FROM users ORDER BY id ASC');
    const { rows: permRows } = await db.query('SELECT user_id, app_id FROM permissions');
    const permsByUser = {};
    for (const row of permRows) {
      (permsByUser[row.user_id] ||= []).push(row.app_id);
    }
    res.json(users.map((u) => ({ ...userPublicShape(u), apps: permsByUser[u.id] || [] })));
  } catch (err) {
    next(err);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const { username, full_name, password, is_super_admin, apps } = req.body || {};
    if (!username || !full_name || !password || password.length < 8) {
      return res.status(400).json({
        error: 'اسم المستخدم والاسم الكامل مطلوبان، وكلمة المرور يجب أن تكون 8 أحرف على الأقل',
      });
    }
    const { rows: existingRows } = await db.query('SELECT id FROM users WHERE username = $1', [
      username.trim(),
    ]);
    if (existingRows.length > 0) {
      return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });
    }
    const hash = bcrypt.hashSync(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (username, full_name, password_hash, is_super_admin, is_active)
       VALUES ($1,$2,$3,$4,TRUE) RETURNING *`,
      [username.trim(), full_name.trim(), hash, !!is_super_admin]
    );
    const user = rows[0];

    if (Array.isArray(apps)) {
      const { rows: validApps } = await db.query('SELECT id FROM apps');
      const validAppIds = new Set(validApps.map((a) => a.id));
      for (const appId of apps) {
        if (validAppIds.has(appId)) {
          await db.query(
            `INSERT INTO permissions (user_id, app_id, granted_by)
             VALUES ($1,$2,$3) ON CONFLICT (user_id, app_id) DO NOTHING`,
            [user.id, appId, req.user.id]
          );
        }
      }
    }

    res.status(201).json(userPublicShape(user));
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows: userRows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const { full_name, is_active, is_super_admin, password } = req.body || {};

    if (id === req.user.id && is_active === false) {
      return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الخاص' });
    }
    if (id === req.user.id && is_super_admin === false) {
      return res.status(400).json({ error: 'لا يمكنك إلغاء صلاحيتك كمدير عن نفسك' });
    }

    if (full_name !== undefined) {
      await db.query('UPDATE users SET full_name = $1 WHERE id = $2', [full_name.trim(), id]);
    }
    if (is_active !== undefined) {
      await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [!!is_active, id]);
    }
    if (is_super_admin !== undefined) {
      await db.query('UPDATE users SET is_super_admin = $1 WHERE id = $2', [
        !!is_super_admin,
        id,
      ]);
    }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
      }
      const hash = bcrypt.hashSync(password, 12);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    }

    const { rows: updatedRows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    res.json(userPublicShape(updatedRows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
    }
    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Per-app permissions -------------------------------------------------
router.post('/permissions', async (req, res, next) => {
  try {
    const { user_id, app_id } = req.body || {};
    const { rows: userRows } = await db.query('SELECT id FROM users WHERE id = $1', [user_id]);
    const { rows: appRows } = await db.query('SELECT id FROM apps WHERE id = $1', [app_id]);
    if (userRows.length === 0 || appRows.length === 0) {
      return res.status(404).json({ error: 'مستخدم أو تطبيق غير موجود' });
    }
    await db.query(
      `INSERT INTO permissions (user_id, app_id, granted_by)
       VALUES ($1,$2,$3) ON CONFLICT (user_id, app_id) DO NOTHING`,
      [user_id, app_id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/permissions/:user_id/:app_id', async (req, res, next) => {
  try {
    const { user_id, app_id } = req.params;
    await db.query('DELETE FROM permissions WHERE user_id = $1 AND app_id = $2', [
      Number(user_id),
      app_id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
