require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');

const APPS = [
  {
    id: 'cashier-nassim',
    title: 'نظام الكاشير — النسيم',
    description: 'نظام كاشير متكامل لنقاط البيع: تسجيل المبيعات، الفواتير، وإدارة العمليات اليومية.',
    icon: '🧾',
    accent: 'var(--ok)',
    tags: ['كاشير', 'نقاط بيع', 'مبيعات'],
  },
  {
    id: 'cfo-dashboard',
    title: 'CFO Assistant — لوحة مالية للمطاعم',
    description: 'لوحة تحكم مالية متكاملة للمطاعم: تحليل التكاليف، الأرباح، والتقارير التنفيذية.',
    icon: '💰',
    accent: 'var(--gold)',
    tags: ['مالية', 'مطاعم', 'تقارير'],
  },
  {
    id: 'fb-reference',
    title: 'مرجع F&B الشامل',
    description: 'فورمات ونماذج تشغيلية جاهزة لقطاع الأغذية والمشروبات — مرجع كامل للاستخدام اليومي.',
    icon: '🍽️',
    accent: 'var(--red)',
    tags: ['F&B', 'فورمات', 'تشغيل'],
  },
  {
    id: 'fleet-system',
    title: 'منظومة إدارة الأسطول الذكية',
    description: 'نظام متكامل لإدارة أسطول المركبات، المتابعة، والتقارير التحليلية بالرسوم البيانية.',
    icon: '🚚',
    accent: 'var(--blue)',
    tags: ['أسطول', 'مركبات', 'تحليلات'],
  },
  {
    id: 'rent-manager',
    title: 'نظام إدارة عقود الإيجار',
    description: 'إدارة عقود الإيجار، المستأجرين، والمواعيد المهمة مع دعم تصدير البيانات.',
    icon: '🏢',
    accent: 'var(--teal)',
    tags: ['عقود', 'إيجار', 'عقارات'],
  },
  {
    id: 'pricing-guide',
    title: 'دليل التسعير في شركات المقاولات',
    description: 'دليل شامل لطرق واستراتيجيات التسعير المستخدمة في قطاع المقاولات.',
    icon: '📐',
    accent: 'var(--purple)',
    tags: ['تسعير', 'مقاولات', 'دليل'],
  },
  {
    id: 'strategy-arabic',
    title: 'الاستراتيجية بالعربي',
    description: 'نظام تفاعلي شامل لفهم وبناء الاستراتيجيات بأسلوب عربي مبسّط وعملي.',
    icon: '🧭',
    accent: 'var(--rose)',
    tags: ['استراتيجية', 'تفاعلي', 'تخطيط'],
  },
];

async function upsertApp(app, index) {
  await db.query(
    `INSERT INTO apps (id, title, description, icon, accent, tags, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       icon = EXCLUDED.icon,
       accent = EXCLUDED.accent,
       tags = EXCLUDED.tags,
       sort_order = EXCLUDED.sort_order`,
    [app.id, app.title, app.description, app.icon, app.accent, JSON.stringify(app.tags), index]
  );
}

async function run() {
  await db.ensureSchema();

  for (let i = 0; i < APPS.length; i++) {
    await upsertApp(APPS[i], i);
  }

  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const { rows: existingRows } = await db.query('SELECT id FROM users WHERE username = $1', [
    adminUsername,
  ]);

  let adminId;
  if (existingRows.length === 0) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    const { rows } = await db.query(
      `INSERT INTO users (username, full_name, password_hash, is_super_admin, is_active)
       VALUES ($1,$2,$3,TRUE,TRUE) RETURNING id`,
      [adminUsername, 'مدير المنصة', hash]
    );
    adminId = rows[0].id;
    console.log(`Created super-admin user "${adminUsername}" with the seeded/default password.`);
    console.log('IMPORTANT: change this password after first login.');
  } else {
    adminId = existingRows[0].id;
    console.log(`Super-admin "${adminUsername}" already exists, skipping creation.`);
  }

  // Super admin implicitly has access to everything (checked in code), but
  // we also record explicit grants for all apps so the permissions list is
  // accurate in the admin UI.
  for (const app of APPS) {
    await db.query(
      `INSERT INTO permissions (user_id, app_id, granted_by)
       VALUES ($1,$2,$3) ON CONFLICT (user_id, app_id) DO NOTHING`,
      [adminId, app.id, adminId]
    );
  }

  console.log('Seed complete:', APPS.length, 'apps registered.');
}

const seedPromise = run();

// When run directly (`npm run seed`), exit once done instead of leaving the
// pg connection pool open and the process hanging. When required from
// server/index.js on boot, just export the promise so it can be awaited
// without killing the server process.
if (require.main === module) {
  seedPromise
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedPromise;
