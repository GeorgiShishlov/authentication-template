// backend/src/config/database.js
const path = require('path');

// ── SQLite ────────────────────────────────────────────────────────────────────

/**
 * Применяет схему к SQLite-соединению.
 */
async function applySchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      google_id TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const userCols = await db.all('PRAGMA table_info(users)');
  if (!userCols.some((c) => c.name === 'google_id')) {
    await db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
  }
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL');
}

/**
 * Создаёт новое SQLite-соединение и применяет схему.
 * @param {string} filename  ':memory:' для тестов, путь к файлу для production.
 */
async function createDatabase(filename) {
  const sqlite3 = require('sqlite3');
  const { open } = require('sqlite');
  const db = await open({ filename, driver: sqlite3.Database });
  await applySchema(db);
  return db;
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────

/**
 * Адаптер поверх pg.Pool — предоставляет тот же интерфейс, что и SQLite-адаптер:
 * run / get / all / exec. Автоматически конвертирует ? → $1, $2, …
 */
class PostgresAdapter {
  constructor(pool) {
    this.pool = pool;
  }

  /** Заменяет позиционные ? на $1, $2, … */
  _convert(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  /** INSERT / UPDATE / DELETE — возвращает result.rowCount */
  async run(sql, params = []) {
    const result = await this.pool.query(this._convert(sql), params);
    return result;
  }

  /** SELECT одной строки (аналог db.get) */
  async get(sql, params = []) {
    const result = await this.pool.query(this._convert(sql), params);
    return result.rows[0] ?? null;
  }

  /** SELECT нескольких строк (аналог db.all) */
  async all(sql, params = []) {
    const result = await this.pool.query(this._convert(sql), params);
    return result.rows;
  }

  /** DDL-запросы без параметров (аналог db.exec) */
  async exec(sql) {
    await this.pool.query(sql);
  }
}

/**
 * Применяет схему к PostgreSQL-адаптеру.
 * Использует PostgreSQL-специфичный синтаксис: SERIAL, TIMESTAMPTZ, IF NOT EXISTS.
 */
async function applySchemaPostgres(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      google_id TEXT,
      email_verified SMALLINT DEFAULT 0,
      verification_token TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_attempts (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS page_views (
      id SERIAL PRIMARY KEY,
      path TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT');
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL');
}

/**
 * Создаёт PostgreSQL-пул и применяет схему.
 * @param {string} connectionString  postgresql://user:pass@host:5432/db
 */
async function createPostgresDatabase(connectionString) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString,
    max:                  Number(process.env.PG_POOL_MAX)                   || 5,
    idleTimeoutMillis:    Number(process.env.PG_POOL_IDLE_TIMEOUT_MS)       || 30_000,
    connectionTimeoutMillis: Number(process.env.PG_POOL_CONNECTION_TIMEOUT_MS) || 5_000,
  });
  const db = new PostgresAdapter(pool);
  await applySchemaPostgres(db);
  console.log('✅ PostgreSQL подключён и схема применена');
  return db;
}

// ── Точка входа ───────────────────────────────────────────────────────────────

/**
 * Инициализирует БД: PostgreSQL (если задан DATABASE_URL) или SQLite (иначе).
 */
async function initializeDatabase() {
  if (process.env.DATABASE_URL) {
    return createPostgresDatabase(process.env.DATABASE_URL);
  }
  const db = await createDatabase(path.join(__dirname, '../../database.sqlite'));
  console.log('✅ База данных SQLite готова');
  return db;
}

module.exports = { initializeDatabase, createDatabase, applySchema, PostgresAdapter };
