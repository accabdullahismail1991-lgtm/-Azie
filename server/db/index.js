const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL env var is required. Point it at a free managed Postgres instance ' +
      '(e.g. Neon, Supabase, Render Postgres) or a local Postgres for development. ' +
      'See README.md for setup instructions.'
  );
}

// Managed free Postgres providers (Neon, Supabase, Render, ...) require TLS
// and typically encode that in the connection string (?sslmode=require).
// Local/self-hosted Postgres usually doesn't speak TLS at all, so only
// force it on when the connection string or an explicit env var asks for it.
const useSsl =
  process.env.PGSSLMODE === 'require' ||
  /sslmode=require/.test(connectionString) ||
  /\.neon\.tech|\.supabase\.co|render\.com/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🧩',
  accent TEXT NOT NULL DEFAULT 'var(--gold)',
  tags TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS permissions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, app_id)
);

-- Whole-app JSON snapshot: each tool's entire in-page dataset (records it
-- used to keep in localStorage/memory only) is stored as one document per
-- app, so existing tool code can keep its own in-memory data model and just
-- load/save that model as a blob instead of being rewritten record-by-record.
CREATE TABLE IF NOT EXISTS app_state (
  app_id TEXT PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS screens (
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  screen_key TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (app_id, screen_key)
);

CREATE TABLE IF NOT EXISTS screen_permissions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  screen_key TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, app_id, screen_key),
  FOREIGN KEY (app_id, screen_key) REFERENCES screens(app_id, screen_key) ON DELETE CASCADE
);
`;

let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(SCHEMA);
  }
  return schemaReady;
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  ensureSchema,
};
