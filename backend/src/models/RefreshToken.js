// backend/src/models/RefreshToken.js
const { randomUUID } = require('crypto');

const TTL_DAYS = 7;

/**
 * Фабрика репозитория refresh-токенов.
 * @param {{ run: Function, get: Function }} db
 */
function createRefreshTokenModel(db) {
  return {
    async createRefreshToken(userId) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await db.run(
        'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
        [token, userId, expiresAt],
      );
      return token;
    },

    async findRefreshToken(token) {
      return db.get('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
    },

    async deleteRefreshToken(token) {
      await db.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    },

    async deleteAllForUser(userId) {
      await db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    },
  };
}

module.exports = { createRefreshTokenModel };
