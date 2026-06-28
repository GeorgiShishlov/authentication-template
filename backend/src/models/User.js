// backend/src/models/User.js
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

/**
 * Фабрика репозитория пользователей.
 * Принимает db-адаптер (любой объект с методами run/get/all),
 * поэтому не зависит от типа БД — SQLite, PostgreSQL и др.
 *
 * @param {{ run: Function, get: Function, all: Function }} db
 */
function createUserModel(db) {
  return {
    async createUser({ username, email, password }) {
      const id = randomUUID();
      const verificationToken = randomUUID();
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run(
        'INSERT INTO users (id, username, email, password, verification_token) VALUES (?, ?, ?, ?, ?)',
        [id, username, email, hashedPassword, verificationToken],
      );
      return { id, username, email, verificationToken };
    },

    async findUserByEmail(email) {
      return db.get(
        'SELECT id, username, email, email_verified, verification_token, google_id, created_at FROM users WHERE email = ?',
        [email],
      );
    },

    async findUserForLogin(email) {
      return db.get('SELECT * FROM users WHERE email = ?', [email]);
    },

    async findUserById(id) {
      return db.get(
        'SELECT id, username, email, created_at FROM users WHERE id = ?',
        [id],
      );
    },

    async verifyPassword(user, password) {
      return bcrypt.compare(password, user.password);
    },

    async findUserByVerificationToken(token) {
      return db.get('SELECT * FROM users WHERE verification_token = ?', [token]);
    },

    async markEmailVerified(id) {
      await db.run(
        'UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?',
        [id],
      );
    },

    async updatePassword(id, plainPassword) {
      const hashed = await bcrypt.hash(plainPassword, 10);
      await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
    },

    async updateUsername(id, username) {
      await db.run('UPDATE users SET username = ? WHERE id = ?', [username, id]);
    },

    // ── Google OAuth ─────────────────────────────────────────────────────────

    async findUserByGoogleId(googleId) {
      return db.get('SELECT * FROM users WHERE google_id = ?', [googleId]);
    },

    /**
     * Создаёт пользователя через Google OAuth.
     * Пароль заменяется хешем случайного UUID — вход по паролю невозможен,
     * только через Google. Это сохраняет совместимость с NOT NULL на password.
     */
    async createGoogleUser({ googleId, email, username }) {
      const id = randomUUID();
      const unusablePassword = await bcrypt.hash(randomUUID(), 10);
      await db.run(
        'INSERT INTO users (id, username, email, password, google_id, email_verified) VALUES (?, ?, ?, ?, ?, 1)',
        [id, username, email, unusablePassword, googleId],
      );
      return { id, username, email };
    },

    /**
     * Привязывает Google-аккаунт к существующему пользователю.
     * Заодно подтверждает email — Google гарантирует его валидность.
     */
    async linkGoogleId(userId, googleId) {
      await db.run(
        'UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?',
        [googleId, userId],
      );
    },

    // ── Admin ────────────────────────────────────────────────────────────────

    async getAllUsers() {
      return db.all(
        'SELECT id, username, email, password, email_verified, created_at FROM users ORDER BY created_at DESC',
      );
    },

    async adminCreateUser({ username, email, password }) {
      const id = randomUUID();
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run(
        'INSERT INTO users (id, username, email, password, email_verified) VALUES (?, ?, ?, ?, 1)',
        [id, username, email, hashedPassword],
      );
      return { id, username, email };
    },

    async adminUpdateUser(id, { username, email, password }) {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
          'UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?',
          [username, email, hashedPassword, id],
        );
      } else {
        await db.run(
          'UPDATE users SET username = ?, email = ? WHERE id = ?',
          [username, email, id],
        );
      }
    },

    async adminDeleteUser(id) {
      await db.run('DELETE FROM users WHERE id = ?', [id]);
    },
  };
}

module.exports = { createUserModel };
