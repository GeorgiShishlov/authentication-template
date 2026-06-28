// backend/src/models/PasswordReset.js
const { randomBytes } = require('crypto');

const TOKEN_TTL_MS   = 60 * 60 * 1000; // 1 час
const RATE_WINDOW_MS = 60 * 60 * 1000; // окно для подсчёта попыток

function generateToken() {
  return randomBytes(32).toString('hex'); // 64-символьный hex
}

/**
 * Фабрика репозитория сброса пароля.
 * @param {{ run: Function, get: Function }} db
 */
function createPasswordResetModel(db) {
  return {
    MAX_ATTEMPTS: 3,

    async createResetToken(userId) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
      await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);
      await db.run(
        'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
        [token, userId, expiresAt],
      );
      return token;
    },

    async findResetToken(token) {
      const record = await db.get(
        'SELECT * FROM password_reset_tokens WHERE token = ?',
        [token],
      );
      if (!record) return null;
      if (new Date(record.expires_at) < new Date()) {
        await db.run('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
        return null;
      }
      return record;
    },

    async deleteResetToken(token) {
      await db.run('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
    },

    async countRecentAttempts(email) {
      const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      const row = await db.get(
        'SELECT COUNT(*) as cnt FROM password_reset_attempts WHERE email = ? AND created_at > ?',
        [email, since],
      );
      return row.cnt;
    },

    async recordAttempt(email) {
      const now = new Date().toISOString();
      await db.run(
        'INSERT INTO password_reset_attempts (email, created_at) VALUES (?, ?)',
        [email, now],
      );
    },
  };
}

module.exports = { createPasswordResetModel };
