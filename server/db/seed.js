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
  {
    id: 'sales-pulse',
    title: 'نبض المبيعات — المتوسط المتحرك 7 أيام',
    description: 'استيراد بيانات المبيعات من أودو أو فودكس وتحليل المتوسط المتحرك لـ7 أيام مع مقارنة بين الفروع وتصدير تقارير PDF.',
    icon: '📈',
    accent: '#E39A3D',
    tags: ['مبيعات', 'تحليلات', 'متوسط متحرك'],
  },
];

const SCREENS = {
  'cashier-nassim': [
    'إدخال وردية',
    'سجل ورديتي',
    'التقرير الشامل',
    'لوحة المؤشرات',
    'التقرير اليومي',
    'أرشيف الورديات',
    'مصادقات الأنظمة الخارجية',
    'مؤشرات المطابقة',
    'كل السجلات',
    'استيراد من إكسل',
    'التكاملات',
    'المستخدمون والفروع',
  ].map((title, i) => [
    ['entry', 'my-history', 'report', 'dashboard', 'daily', 'archive', 'external', 'kpi', 'allrecords', 'import', 'integrations', 'users'][i],
    title,
  ]),
  'cfo-dashboard': [
    ['exec', 'الملخص التنفيذي والرؤى الذكية'],
    ['pnl', 'القوائم المالية'],
    ['cashflow', 'التدفق النقدي'],
    ['trend', 'الموازنة مقابل الفعلي'],
    ['branches', 'مصفوفة أداء الفروع'],
    ['cost', 'ضبط التكاليف'],
    ['waste', 'الهدر'],
    ['staff', 'إنتاجية الموظفين'],
    ['aggregators', 'ربحية قنوات التوصيل'],
    ['analytics', 'التحليلات المتقدمة'],
    ['masterdata', 'البيانات الأساسية'],
    ['upload', 'رفع البيانات والقوالب'],
    ['manual', 'دليل الاستخدام'],
    ['settings', 'إعدادات النظام ومعايير IFRS'],
  ],
  'fb-reference': [
    ['formulas', 'الفورمات الحسابية'],
    ['forms', 'النماذج التشغيلية'],
  ],
  'fleet-system': [
    ['dashboard', 'لوحة التحكم'],
    ['live', 'تتبع مباشر'],
    ['vehicles', 'المركبات والأصول'],
    ['drivers', 'السائقون'],
    ['trips', 'خطوط السير والرحلات'],
    ['fuel', 'تموين الوقود'],
    ['maintenance', 'الصيانة والتجديدات'],
    ['accidents', 'الحوادث والبلاغات'],
    ['reports', 'التقارير العامة'],
    ['rpt-vehicle', 'تقرير سيارة مفصل'],
    ['rpt-driver', 'تقرير سائق مفصل'],
  ],
  'rent-manager': [
    ['dashboard', 'لوحة التحكم'],
    ['new', 'عقد جديد'],
    ['contract', 'تفاصيل العقد'],
  ],
  'pricing-guide': [
    ['s1', 'التكلفة والسعر والربح'],
    ['s2', 'أسباب الخسارة'],
    ['s3', 'دورة التسعير'],
    ['s4', 'الأخطاء القاتلة'],
    ['s5', 'بند غير موجود'],
    ['s6', 'قراءة الـ BOQ'],
  ],
  'strategy-arabic': [
    ['overview', 'الرئيسية'],
    ['concepts', 'المفاهيم'],
    ['tools', 'الأدوات'],
    ['phases', 'المراحل'],
    ['restaurant', 'نموذج المطعم'],
    ['calculator', 'حاسبة الربحية'],
    ['assistant', 'المساعد الاستراتيجي'],
  ],
  // Single continuous dashboard page (import, filters, tables, charts) with
  // no separate navigable sections, so it gets one screen covering the
  // whole tool rather than a per-section breakdown like the other apps.
  'sales-pulse': [
    ['dashboard', 'لوحة نبض المبيعات'],
  ],
};

async function upsertScreens() {
  for (const [appId, screens] of Object.entries(SCREENS)) {
    for (let i = 0; i < screens.length; i++) {
      const [screenKey, title] = screens[i];
      await db.query(
        `INSERT INTO screens (app_id, screen_key, title, sort_order)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (app_id, screen_key) DO UPDATE SET
           title = EXCLUDED.title,
           sort_order = EXCLUDED.sort_order`,
        [appId, screenKey, title, i]
      );
    }
  }
}

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
  await upsertScreens();

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

  // Same rationale as above: super admin has implicit access to every
  // screen in code, but explicit rows keep the admin matrix UI accurate.
  for (const [appId, screens] of Object.entries(SCREENS)) {
    for (const [screenKey] of screens) {
      await db.query(
        `INSERT INTO screen_permissions (user_id, app_id, screen_key, granted_by)
         VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, app_id, screen_key) DO NOTHING`,
        [adminId, appId, screenKey, adminId]
      );
    }
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
