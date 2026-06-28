// backend/src/routes/profile.js
const express = require('express');
const authMiddleware = require('../middleware/auth');

/**
 * @param {{ userModel }} deps
 */
function createProfileRouter({ userModel }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/profile/me:
   *   get:
   *     summary: Получить профиль текущего пользователя
   *     tags: [Profile]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Данные пользователя
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user: { $ref: '#/components/schemas/User' }
   *       401: { description: Не авторизован }
   *       404: { description: Пользователь не найден }
   */
  router.get('/me', authMiddleware, async (req, res) => {
    try {
      const user = await userModel.findUserById(req.userId);
      if (!user) {
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        return res.status(404).json({ message: 'Пользователь не найден' });
      }
      res.json({ user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  /**
   * @swagger
   * /api/profile/me:
   *   put:
   *     summary: Обновить имя пользователя
   *     tags: [Profile]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username]
   *             properties:
   *               username: { type: string, example: johndoe }
   *     responses:
   *       200: { description: Имя обновлено }
   *       400: { description: Имя не указано }
   *       401: { description: Не авторизован }
   */
  router.put('/me', authMiddleware, async (req, res) => {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Имя не может быть пустым' });
    }
    try {
      await userModel.updateUsername(req.userId, username.trim());
      const user = await userModel.findUserById(req.userId);
      res.json({ message: 'Имя обновлено', user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  return router;
}

module.exports = { createProfileRouter };
