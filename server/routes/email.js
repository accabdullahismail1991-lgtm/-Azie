const express = require('express');
const { requireAuth, requireAppAccess } = require('../auth');

const router = express.Router();

const RESEND_API_URL = 'https://api.resend.com/emails';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // Resend's own limit is ~40MB combined; keep well under it.

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

      const { to, subject, text, attachment } = req.body || {};
      if (!to || !subject || !text) {
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
        text: String(text),
      };

      if (attachment && attachment.contentBase64) {
        const sizeBytes = Math.ceil((attachment.contentBase64.length * 3) / 4);
        if (sizeBytes > MAX_ATTACHMENT_BYTES) {
          return res.status(400).json({ error: 'حجم المرفق أكبر من الحد المسموح' });
        }
        payload.attachments = [
          {
            filename: attachment.filename || 'report.csv',
            content: attachment.contentBase64,
          },
        ];
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
