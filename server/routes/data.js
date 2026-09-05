const express = require('express');
const db = require('../db');
const { requireAuth, requireAppAccess } = require('../auth');

const router = express.Router();

router.get(
  '/:appId',
  requireAuth,
  (req, res, next) => requireAppAccess(req.params.appId)(req, res, next),
  async (req, res, next) => {
    try {
      const { rows } = await db.query(
        'SELECT data, updated_at FROM app_state WHERE app_id = $1',
        [req.params.appId]
      );
      if (rows.length === 0) {
        return res.json({ data: {}, updated_at: null });
      }
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:appId',
  requireAuth,
  (req, res, next) => requireAppAccess(req.params.appId)(req, res, next),
  async (req, res, next) => {
    try {
      const { data } = req.body || {};
      if (data === undefined || typeof data !== 'object' || data === null) {
        return res.status(400).json({ error: 'الحقل data مطلوب ويجب أن يكون كائن JSON' });
      }
      const { rows } = await db.query(
        `INSERT INTO app_state (app_id, data, updated_at, updated_by)
         VALUES ($1, $2, now(), $3)
         ON CONFLICT (app_id) DO UPDATE SET
           data = EXCLUDED.data,
           updated_at = now(),
           updated_by = EXCLUDED.updated_by
         RETURNING data, updated_at`,
        [req.params.appId, JSON.stringify(data), req.user.id]
      );
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
