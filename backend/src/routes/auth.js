// backend/src/routes/auth.js
const express    = require('express');
const jwt        = require('jsonwebtoken');
const passport   = require('passport');
const rateLimit  = require('express-rate-limit');
const { validateRegister, validateLogin, validatePassword } = require('../utils/validate');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const IS_PROD = process.env.NODE_ENV === 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Слишком много запросов. Попробуйте через 15 минут.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const ACCESS_TOKEN_TTL      = '15m';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function setTokenCookies(res, accessToken, refreshToken) {
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

/**
 * Фабрика роутера аутентификации.
 * Все зависимости (модели, мейлер) передаются снаружи — код не зависит от типа БД.
 *
 * @param {{ userModel, refreshTokenModel, passwordResetModel, mailer }} deps
 */
function createAuthRouter({ userModel, refreshTokenModel, passwordResetModel, mailer }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Регистрация нового пользователя
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               username:
   *                 type: string
   *                 example: johndoe
   *               email:
   *                 type: string
   *                 format: email
   *                 example: john@example.com
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 example: secret123
   *     responses:
   *       201:
   *         description: Пользователь создан, отправлено письмо с подтверждением
   *       400:
   *         description: Ошибка валидации или пользователь уже существует
   */
  router.post('/register', authLimiter, validateRegister, async (req, res) => {
    const { username, email, password } = req.body;
    const derivedUsername = username || email.trim().split('@')[0];
    try {
      const user = await userModel.createUser({ username: derivedUsername, email, password });
      await mailer.sendVerificationEmail(email, user.verificationToken).catch((mailErr) => {
        console.error('SMTP error (verification):', mailErr.message);
        if (!IS_PROD) console.log(`[DEV] Ссылка подтверждения для ${email}: ${FRONTEND_URL}/verify-email?token=${user.verificationToken}`);
      });
      res.status(201).json({ message: 'Регистрация прошла успешно. Проверьте почту для подтверждения.' });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed') || error.code === '23505') {
        const existing = await userModel.findUserByEmail(email).catch(() => null);
        if (existing && !existing.email_verified && existing.verification_token) {
          await mailer.sendVerificationEmail(email, existing.verification_token).catch((mailErr) => {
            console.error('SMTP error (re-verification):', mailErr.message);
            if (!IS_PROD) console.log(`[DEV] Ссылка подтверждения для ${email}: ${FRONTEND_URL}/verify-email?token=${existing.verification_token}`);
          });
          return res.status(400).json({ message: 'Этот email уже зарегистрирован, но не подтверждён. Мы отправили новое письмо — проверьте почту.' });
        }
        return res.status(400).json({ message: 'Пользователь с таким email или именем уже существует' });
      }
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  /**
   * @swagger
   * /api/auth/verify-email:
   *   get:
   *     summary: Подтверждение email по токену из письма
   *     tags: [Auth]
   *     parameters:
   *       - in: query
   *         name: token
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Email подтверждён }
   *       400: { description: Токен не указан или недействителен }
   */
  router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Токен не указан' });
    try {
      const user = await userModel.findUserByVerificationToken(token);
      if (!user) return res.status(400).json({ message: 'Недействительный или уже использованный токен' });
      await userModel.markEmailVerified(user.id);
      res.json({ message: 'Email подтверждён. Теперь вы можете войти.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Вход в систему
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string, format: email }
   *               password: { type: string }
   *     responses:
   *       200: { description: Успешный вход }
   *       401: { description: Неверные учётные данные }
   *       403: { description: Email не подтверждён }
   */
  router.post('/login', authLimiter, validateLogin, async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await userModel.findUserForLogin(email);
      if (!user) return res.status(401).json({ message: 'Неверный email или пароль' });

      const isValid = await userModel.verifyPassword(user, password);
      if (!isValid) return res.status(401).json({ message: 'Неверный email или пароль' });

      if (!user.email_verified) return res.status(403).json({ message: 'Подтвердите email перед входом' });

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const refreshToken = await refreshTokenModel.createRefreshToken(user.id);
      setTokenCookies(res, accessToken, refreshToken);

      res.json({
        message: 'Вход выполнен успешно',
        user: { id: user.id, username: user.username, email: user.email },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  /**
   * @swagger
   * /api/auth/refresh:
   *   post:
   *     summary: Обновление access токена (rotation)
   *     tags: [Auth]
   *     responses:
   *       200: { description: Токены обновлены }
   *       401: { description: Refresh токен отсутствует или недействителен }
   */
  router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ message: 'Нет refresh токена' });

    try {
      const record = await refreshTokenModel.findRefreshToken(refreshToken);
      if (!record || new Date(record.expires_at) < new Date()) {
        return res.status(401).json({ message: 'Refresh токен недействителен или истёк' });
      }

      await refreshTokenModel.deleteRefreshToken(refreshToken);
      const newRefreshToken = await refreshTokenModel.createRefreshToken(record.user_id);

      const accessToken = jwt.sign(
        { userId: record.user_id },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      setTokenCookies(res, accessToken, newRefreshToken);
      res.json({ message: 'Токен обновлён' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Выход из системы
   *     tags: [Auth]
   *     responses:
   *       200: { description: Выход выполнен }
   */
  router.post('/logout', async (req, res) => {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      await refreshTokenModel.deleteRefreshToken(refreshToken).catch(() => {});
    }
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.json({ message: 'Выход выполнен' });
  });

  /**
   * @swagger
   * /api/auth/forgot-password:
   *   post:
   *     summary: Запрос на сброс пароля
   *     tags: [Auth]
   *     description: Всегда возвращает одно и то же сообщение. Лимит — 3 запроса в час.
   *     responses:
   *       200: { description: Универсальный ответ }
   *       429: { description: Превышен лимит запросов }
   */
  router.post('/forgot-password', async (req, res) => {
    const GENERIC_MSG = 'Если аккаунт с таким email существует, инструкции по сбросу пароля отправлены.';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    if (!email) return res.json({ message: GENERIC_MSG });

    try {
      const attempts = await passwordResetModel.countRecentAttempts(email);
      if (attempts >= passwordResetModel.MAX_ATTEMPTS) {
        return res.status(429).json({ message: 'Слишком много запросов. Попробуйте через час.' });
      }
      await passwordResetModel.recordAttempt(email);

      const user = await userModel.findUserByEmail(email);
      if (user) {
        const token = await passwordResetModel.createResetToken(user.id);
        await mailer.sendPasswordResetEmail(email, token).catch((mailErr) => {
          console.error('SMTP error (reset):', mailErr.message);
          if (!IS_PROD) console.log(`[DEV] Ссылка сброса пароля для ${email}: ${FRONTEND_URL}/reset-password?token=${token}`);
        });
      }
      res.json({ message: GENERIC_MSG });
    } catch (err) {
      console.error(err);
      res.json({ message: GENERIC_MSG });
    }
  });

  /**
   * @swagger
   * /api/auth/reset-password:
   *   post:
   *     summary: Установка нового пароля по токену
   *     tags: [Auth]
   *     responses:
   *       200: { description: Пароль успешно изменён }
   *       400: { description: Недействительный токен или слабый пароль }
   */
  router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body ?? {};

    if (typeof token !== 'string' || !token) {
      return res.status(400).json({ message: 'Недействительная или устаревшая ссылка.' });
    }
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length) {
      return res.status(400).json({ message: passwordErrors[0], errors: { password: passwordErrors } });
    }

    try {
      const record = await passwordResetModel.findResetToken(token);
      if (!record) return res.status(400).json({ message: 'Ссылка недействительна или уже была использована.' });

      await userModel.updatePassword(record.user_id, password);
      await passwordResetModel.deleteResetToken(token);
      await refreshTokenModel.deleteAllForUser(record.user_id);

      const user = await userModel.findUserById(record.user_id);
      if (user) await mailer.sendPasswordChangedEmail(user.email);

      res.json({ message: 'Пароль успешно изменён! Войдите с новым паролем.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  // ── Google OAuth ───────────────────────────────────────────────────────────
  // Маршруты регистрируются только если GOOGLE_CLIENT_ID задан в окружении.

  if (process.env.GOOGLE_CLIENT_ID) {
    /**
     * @swagger
     * /api/auth/google:
     *   get:
     *     summary: Вход через Google OAuth
     *     tags: [Auth]
     *     description: Перенаправляет на страницу авторизации Google
     *     responses:
     *       302: { description: Редирект на Google }
     */
    router.get(
      '/google',
      passport.authenticate('google', { scope: ['email', 'profile'], session: false }),
    );

    /**
     * @swagger
     * /api/auth/google/callback:
     *   get:
     *     summary: Callback после Google OAuth
     *     tags: [Auth]
     *     description: Google перенаправляет сюда после авторизации
     *     responses:
     *       302: { description: Редирект на /profile или /?error=oauth_failed }
     */
    router.get(
      '/google/callback',
      passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/?error=oauth_failed` }),
      async (req, res) => {
        try {
          const user = req.user;
          const accessToken  = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
          const refreshToken = await refreshTokenModel.createRefreshToken(user.id);
          setTokenCookies(res, accessToken, refreshToken);
          res.redirect(`${FRONTEND_URL}/profile`);
        } catch (err) {
          console.error('Google OAuth callback error:', err);
          res.redirect(`${FRONTEND_URL}/?error=oauth_failed`);
        }
      },
    );
  }

  return router;
}

module.exports = { createAuthRouter };
