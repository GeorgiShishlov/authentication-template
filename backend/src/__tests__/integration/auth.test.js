// src/__tests__/integration/auth.test.js
//
// Интеграционные тесты: реальная БД (in-memory SQLite), реальные модели, реальные маршруты.
// Единственный мок — мейлер, потому что отправка писем — внешний side-effect.
// Тесты изолированы от типа БД: createTestDb() возвращает адаптер с run/get/all/exec,
// и при переходе на PostgreSQL потребуется лишь заменить адаптер в createTestDb.
'use strict';

process.env.JWT_SECRET     = 'integration-secret';
process.env.ADMIN_LOGIN    = 'admin';
process.env.ADMIN_PASSWORD = 'admin';

const request = require('supertest');

// Мок мейлера — перехватываем, чтобы не слать реальные письма,
// и чтобы вытащить токены, которые «были бы» в письме.
jest.mock('../../config/mailer', () => ({
  sendVerificationEmail:    jest.fn().mockResolvedValue(),
  sendPasswordResetEmail:   jest.fn().mockResolvedValue(),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(),
}));

const mailer = require('../../config/mailer');

const { createApp }    = require('../../app');
const { createTestDb } = require('../helpers/createTestDb');

// ── Утилиты ───────────────────────────────────────────────────────────────────

const EMAIL    = 'test@example.com';
const PASSWORD = 'Secret1!';

/** Регистрирует пользователя и возвращает токен подтверждения из «письма». */
async function registerUser(app, email = EMAIL, password = PASSWORD) {
  const res = await request(app).post('/api/auth/register').send({ email, password });
  expect(res.status).toBe(201);
  const calls = mailer.sendVerificationEmail.mock.calls;
  const [, verToken] = calls[calls.length - 1];
  return verToken;
}

/** Подтверждает email. */
async function verifyEmail(app, token) {
  const res = await request(app).get(`/api/auth/verify-email?token=${token}`);
  expect(res.status).toBe(200);
}

/** Регистрирует + подтверждает. */
async function registerAndVerify(app, email = EMAIL, password = PASSWORD) {
  const token = await registerUser(app, email, password);
  await verifyEmail(app, token);
}

/** Логинится и возвращает строку Set-Cookie для последующих запросов. */
async function login(app, email = EMAIL, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'].join('; ');
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: Auth', () => {
  let app, db;

  beforeEach(async () => {
    jest.clearAllMocks();
    db  = await createTestDb();
    app = createApp(db);
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Регистрация ─────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    test('успешная регистрация → 201 + письмо отправлено', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/подтверждения/i);
      expect(mailer.sendVerificationEmail).toHaveBeenCalledWith(EMAIL, expect.any(String));
    });

    test('дублирующийся email (не подтверждён) → 400 + повторное письмо', async () => {
      await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      const res = await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/не подтверждён/i);
      expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(2);
    });

    test('невалидный email → 400 (до записи в БД)', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: PASSWORD });
      expect(res.status).toBe(400);
      expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
    });

    test('слабый пароль → 400', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: EMAIL, password: 'weak' });
      expect(res.status).toBe(400);
    });
  });

  // ── Подтверждение email ─────────────────────────────────────────────────────

  describe('GET /api/auth/verify-email', () => {
    test('валидный токен → 200, email подтверждён', async () => {
      const token = await registerUser(app);
      const res = await request(app).get(`/api/auth/verify-email?token=${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/подтверждён/i);
    });

    test('повторное использование токена → 400', async () => {
      const token = await registerUser(app);
      await request(app).get(`/api/auth/verify-email?token=${token}`);
      const res = await request(app).get(`/api/auth/verify-email?token=${token}`);
      expect(res.status).toBe(400);
    });

    test('несуществующий токен → 400', async () => {
      const res = await request(app).get('/api/auth/verify-email?token=no-such-token');
      expect(res.status).toBe(400);
    });
  });

  // ── Вход ───────────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    test('email не подтверждён → 403', async () => {
      await registerUser(app); // без verify
      const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/подтвердите/i);
    });

    test('успешный вход → 200, устанавливает httpOnly cookies', async () => {
      await registerAndVerify(app);
      const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'].join(' ');
      expect(cookies).toMatch(/token=/);
      expect(cookies).toMatch(/refreshToken=/);
      expect(res.body.user.email).toBe(EMAIL);
    });

    test('неверный пароль → 401', async () => {
      await registerAndVerify(app);
      const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'WrongPass1!' });
      expect(res.status).toBe(401);
    });

    test('несуществующий email → 401', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'ghost@x.com', password: PASSWORD });
      expect(res.status).toBe(401);
    });
  });

  // ── Полный флоу: регистрация → подтверждение → вход ────────────────────────

  describe('Полный auth-флоу', () => {
    test('регистрация → verify → логин → профиль → выход', async () => {
      // 1. Регистрация
      await registerAndVerify(app);

      // 2. Логин → получаем cookies
      const loginRes = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers['set-cookie'].join('; ');

      // 3. Профиль
      const profileRes = await request(app).get('/api/profile/me').set('Cookie', cookies);
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.user.email).toBe(EMAIL);

      // 4. Выход
      const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookies);
      expect(logoutRes.status).toBe(200);
    });
  });

  // ── Refresh-токен ───────────────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    test('нет cookie → 401', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    test('refresh rotation: старый токен отклоняется после обновления', async () => {
      await registerAndVerify(app);
      const loginRes = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      const oldCookies = loginRes.headers['set-cookie'].join('; ');

      // Получаем новые токены
      const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', oldCookies);
      expect(refreshRes.status).toBe(200);

      // Старый refresh-токен больше не работает
      const retryRes = await request(app).post('/api/auth/refresh').set('Cookie', oldCookies);
      expect(retryRes.status).toBe(401);
    });

    test('после refresh новый access-токен даёт доступ к профилю', async () => {
      await registerAndVerify(app);
      const loginRes = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      const oldCookies = loginRes.headers['set-cookie'].join('; ');

      const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', oldCookies);
      expect(refreshRes.status).toBe(200);
      const newCookies = refreshRes.headers['set-cookie'].join('; ');

      const profileRes = await request(app).get('/api/profile/me').set('Cookie', newCookies);
      expect(profileRes.status).toBe(200);
    });
  });

  // ── Forgot / Reset password ─────────────────────────────────────────────────

  describe('Forgot / Reset password', () => {
    test('forgot-password: несуществующий email → 200 (защита от enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'ghost@x.com' });
      expect(res.status).toBe(200);
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test('forgot-password: превышение лимита → 429', async () => {
      await registerAndVerify(app);
      // 3 запроса подряд (MAX_ATTEMPTS = 3)
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
      }
      const res = await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
      expect(res.status).toBe(429);
    });

    test('полный флоу: forgot → reset → вход с новым паролем', async () => {
      const NEW_PASSWORD = 'NewSecret2@';
      await registerAndVerify(app);

      // Запрашиваем сброс
      await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
      const resetCalls = mailer.sendPasswordResetEmail.mock.calls;
      const [, resetToken] = resetCalls[resetCalls.length - 1];

      // Устанавливаем новый пароль
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: NEW_PASSWORD });
      expect(resetRes.status).toBe(200);
      expect(mailer.sendPasswordChangedEmail).toHaveBeenCalledWith(EMAIL);

      // Вход со старым паролем → 401
      const oldLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      expect(oldLogin.status).toBe(401);

      // Вход с новым паролем → 200
      const newLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PASSWORD });
      expect(newLogin.status).toBe(200);
    });

    test('reset-password: недействительный токен → 400', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'fake-token', password: 'NewSecret2@' });
      expect(res.status).toBe(400);
    });

    test('reset-password: слабый пароль → 400, токен не расходуется', async () => {
      await registerAndVerify(app);
      await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
      const [, resetToken] = mailer.sendPasswordResetEmail.mock.calls.at(-1);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'weak' });
      expect(res.status).toBe(400);

      // Токен всё ещё действителен — повторяем с правильным паролем
      const res2 = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'NewSecret2@' });
      expect(res2.status).toBe(200);
    });
  });
});
