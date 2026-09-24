const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireAppAccess } = require('../auth');

const router = express.Router();
const TOOLS_DIR = path.join(__dirname, '..', '..', 'public', 'tools');

router.get(
  '/:id',
  requireAuth,
  (req, res, next) => requireAppAccess(req.params.id)(req, res, next),
  async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT id FROM apps WHERE id = $1', [req.params.id]);
      if (rows.length === 0) return res.status(404).send('App not found');

      const filePath = path.join(TOOLS_DIR, `${rows[0].id}.html`);
      if (!filePath.startsWith(TOOLS_DIR) || !fs.existsSync(filePath)) {
        return res.status(404).send('App file missing');
      }
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
