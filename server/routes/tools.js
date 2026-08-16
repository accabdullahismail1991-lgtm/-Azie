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
  (req, res) => {
    const app = db.prepare('SELECT id FROM apps WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).send('App not found');

    const filePath = path.join(TOOLS_DIR, `${app.id}.html`);
    if (!filePath.startsWith(TOOLS_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).send('App file missing');
    }
    res.sendFile(filePath);
  }
);

module.exports = router;
