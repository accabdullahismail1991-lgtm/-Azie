const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireAppAccess } = require('../auth');

const router = express.Router();
const FILES_DIR = path.join(__dirname, '..', 'private-assets', 'standards-guide');
const APP_ID = 'standards-guide';

router.get(
  '/:file',
  requireAuth,
  requireAppAccess(APP_ID),
  (req, res) => {
    // Only allow a plain "<id>.pdf" basename — no path segments, no traversal.
    const file = req.params.file;
    if (!/^[a-z0-9-]+\.pdf$/.test(file)) {
      return res.status(400).send('اسم ملف غير صالح');
    }
    const filePath = path.join(FILES_DIR, file);
    if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).send('الملف غير موجود');
    }
    res.sendFile(filePath);
  }
);

module.exports = router;
