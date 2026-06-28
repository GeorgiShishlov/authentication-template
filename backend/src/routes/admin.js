// backend/src/routes/admin.js
const express = require('express');
const jwt = require('jsonwebtoken');
const adminAuth = require('../middleware/adminAuth');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 4 * 60 * 60 * 1000, // 4 часа
};

/**
 * @param {{ userModel, pageViewModel }} deps
 */
function createAdminRouter({ userModel, pageViewModel }) {
  const router = express.Router();

  // POST /api/admin/login
  router.post('/login', (req, res) => {
    const { login, password } = req.body ?? {};
    if (
      typeof login !== 'string' ||
      typeof password !== 'string' ||
      login !== process.env.ADMIN_LOGIN ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '4h' });
    res.cookie('adminToken', token, COOKIE_OPTS);
    res.json({ message: 'Вход выполнен' });
  });

  // POST /api/admin/logout
  router.post('/logout', (_req, res) => {
    res.clearCookie('adminToken');
    res.json({ message: 'Выход выполнен' });
  });

  // GET /api/admin/me
  router.get('/me', adminAuth, (_req, res) => {
    res.json({ ok: true });
  });

  // GET /api/admin/users
  router.get('/users', adminAuth, async (_req, res) => {
    try {
      const users = await userModel.getAllUsers();
      res.json({ users });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  // POST /api/admin/users
  router.post('/users', adminAuth, async (req, res) => {
    const { username, email, password } = req.body ?? {};
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email и password обязательны' });
    }
    try {
      const user = await userModel.adminCreateUser({ username, email, password });
      res.status(201).json({ user });
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed') || err.code === '23505') {
        return res.status(400).json({ message: 'Пользователь с таким email или именем уже существует' });
      }
      console.error(err);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  // PUT /api/admin/users/:id
  router.put('/users/:id', adminAuth, async (req, res) => {
    const { username, email, password } = req.body ?? {};
    if (!username || !email) {
      return res.status(400).json({ message: 'username и email обязательны' });
    }
    try {
      await userModel.adminUpdateUser(req.params.id, { username, email, password });
      res.json({ message: 'Пользователь обновлён' });
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed') || err.code === '23505') {
        return res.status(400).json({ message: 'Email или имя уже заняты' });
      }
      console.error(err);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  // DELETE /api/admin/users/:id
  router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
      await userModel.adminDeleteUser(req.params.id);
      res.json({ message: 'Пользователь удалён' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  // GET /api/admin/stats
  router.get('/stats', adminAuth, async (_req, res) => {
    try {
      const stats = await pageViewModel.getStats();
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
