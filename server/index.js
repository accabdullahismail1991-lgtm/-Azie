require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

// Applying the (idempotent) seed on every boot means a fresh deployment
// gets its schema, apps, and first super-admin without a separate manual
// step — safe to run repeatedly since it only inserts what's missing.
const seedReady = require('./db/seed');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const toolsRoutes = require('./routes/tools');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/tools', toolsRoutes);

// Static assets (css/js/images if any) are public; the HTML pages
// themselves check auth client-side via /api/auth/me and redirect to
// /login.html when unauthenticated. Real access control for the embedded
// apps is enforced server-side by the /tools route above.
app.use(express.static(PUBLIC_DIR, { index: false }));

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في السيرفر' });
});

seedReady
  .then(() => {
    app.listen(PORT, () => {
      console.log(`المنصة الموحدة تعمل على http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('فشل الاتصال بقاعدة البيانات أو تجهيزها:', err);
    process.exit(1);
  });
