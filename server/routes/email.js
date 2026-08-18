const express = require('express');
const { requireAuth, requireAppAccess } = require('../auth');

const router = express.Router();

const RESEND_API_URL = 'https://api.resend.com/emails';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // per file
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024; // combined; Resend's own limit is ~40MB, keep well under it.
const MAX_ATTACHMENTS = 5;

// Sends a report (with an optional file attachment) by email through Resend.
// Scoped to a specific app so the same per-app permission that gates the
// tool itself also gates who can email its data out.
router.post(
  '/send',
  requireAuth,
  (req, res, next) => {
    const appId = req.body && req.body.appId;
    if (!appId) return res.status(400).json({ error: 'الحقل appId مطلوب' });
    return requireAppAccess(appId)(req, res, next);
  },
  async (req, res, next) => {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'خدمة البريد غير مُفعّلة على هذا السيرفر — أضف RESEND_API_KEY لمتغيرات البيئة.',
        });
      }

      const { to, subject, text, html, attachment, attachments } = req.body || {};
      if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ error: 'الحقول to وsubject وtext مطلوبة' });
      }
      const recipients = (Array.isArray(to) ? to : [to]).map((x) => String(x).trim()).filter(Boolean);
      if (recipients.length === 0) {
        return res.status(400).json({ error: 'الرجاء إدخال بريد إلكتروني واحد على الأقل' });
      }

      const payload = {
        from: process.env.RESEND_FROM_EMAIL || 'المنصة الموحدة <onboarding@resend.dev>',
        to: recipients,
        subject: String(subject),
      };
      if (text) payload.text = String(text);
      if (html) payload.html = String(html);

      // Accept either a single `attachment` (legacy) or an `attachments` array.
      const files = Array.isArray(attachments) ? attachments : attachment ? [attachment] : [];
      const validFiles = files.filter((f) => f && f.contentBase64);
      if (validFiles.length > MAX_ATTACHMENTS) {
        return res.status(400).json({ error: `عدد المرفقات أكبر من الحد المسموح (${MAX_ATTACHMENTS})` });
      }
      let totalBytes = 0;
      for (const f of validFiles) {
        const sizeBytes = Math.ceil((f.contentBase64.length * 3) / 4);
        if (sizeBytes > MAX_ATTACHMENT_BYTES) {
          return res.status(400).json({ error: `حجم المرفق "${f.filename || ''}" أكبر من الحد المسموح` });
        }
        totalBytes += sizeBytes;
      }
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        return res.status(400).json({ error: 'إجمالي حجم المرفقات أكبر من الحد المسموح' });
      }
      if (validFiles.length > 0) {
        payload.attachments = validFiles.map((f) => ({
          filename: f.filename || 'report.csv',
          content: f.contentBase64,
        }));
      }

      const resendRes = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resendBody = await resendRes.json().catch(() => ({}));
      if (!resendRes.ok) {
        console.error('Resend API error:', resendRes.status, resendBody);
        return res.status(502).json({
          error: resendBody.message || 'تعذّر إرسال البريد عبر خدمة Resend',
        });
      }

      res.json({ ok: true, id: resendBody.id });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
