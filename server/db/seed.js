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

function upsertApp(app, index) {
  const existing = db.prepare('SELECT id FROM apps WHERE id = ?').get(app.id);
  if (existing) {
    db.prepare(
      `UPDATE apps SET title=?, description=?, icon=?, accent=?, tags=?, sort_order=? WHERE id=?`
    ).run(app.title, app.description, app.icon, app.accent, JSON.stringify(app.tags), index, app.id);
  } else {
    db.prepare(
      `INSERT INTO apps (id, title, description, icon, accent, tags, sort_order) VALUES (?,?,?,?,?,?,?)`
    ).run(app.id, app.title, app.description, app.icon, app.accent, JSON.stringify(app.tags), index);
  }
}

APPS.forEach((app, i) => upsertApp(app, i));

const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);

let adminId;
if (!adminExists) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  const info = db
    .prepare(
      `INSERT INTO users (username, full_name, password_hash, is_super_admin, is_active) VALUES (?,?,?,1,1)`
    )
    .run(adminUsername, 'مدير المنصة', hash);
  adminId = Number(info.lastInsertRowid);
  console.log(`Created super-admin user "${adminUsername}" with the seeded/default password.`);
  console.log('IMPORTANT: change this password after first login.');
} else {
  adminId = adminExists.id;
  console.log(`Super-admin "${adminUsername}" already exists, skipping creation.`);
}

// Super admin implicitly has access to everything (checked in code), but we
// also record explicit grants for all apps so the permissions list is accurate.
for (const app of APPS) {
  const has = db
    .prepare('SELECT 1 FROM permissions WHERE user_id = ? AND app_id = ?')
    .get(adminId, app.id);
  if (!has) {
    db.prepare(
      'INSERT INTO permissions (user_id, app_id, granted_by) VALUES (?, ?, ?)'
    ).run(adminId, app.id, adminId);
  }
}

console.log('Seed complete:', APPS.length, 'apps registered.');
