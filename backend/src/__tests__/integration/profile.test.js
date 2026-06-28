// src/__tests__/integration/profile.test.js
'use strict';

process.env.JWT_SECRET     = 'integration-secret';
process.env.ADMIN_LOGIN    = 'admin';
process.env.ADMIN_PASSWORD = 'admin';

const request = require('supertest');

jest.mock('../../config/mailer', () => ({
  sendVerificationEmail:    jest.fn().mockResolvedValue(),
  sendPasswordResetEmail:   jest.fn().mockResolvedValue(),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(),
}));

const mailer = require('../../config/mailer');

const { createApp }    = require('../../app');
const { createTestDb } = require('../helpers/createTestDb');

const EMAIL    = 'profile@example.com';
const PASSWORD = 'Secret1!';

async function setupUser(app) {
  // register
  const regRes = await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
  expect(regRes.status).toBe(201);

  // verify
  const [, token] = mailer.sendVerificationEmail.mock.calls.at(-1);
  await request(app).get(`/api/auth/verify-email?token=${token}`);

  // login → cookies
  const loginRes = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  expect(loginRes.status).toBe(200);
  return loginRes.headers['set-cookie'].join('; ');
}

describe('Integration: Profile', () => {
  let app, db;

  beforeEach(async () => {
    jest.clearAllMocks();
    db  = await createTestDb();
    app = createApp(db);
  });

  afterEach(async () => {
    await db.close();
  });

  // ── GET /api/profile/me ───────────────────────────────────────────────────

  describe('GET /api/profile/me', () => {
    test('без авторизации → 401', async () => {
      const res = await request(app).get('/api/profile/me');
      expect(res.status).toBe(401);
    });

    test('с авторизацией → 200, корректные данные пользователя', async () => {
      const cookies = await setupUser(app);
      const res = await request(app).get('/api/profile/me').set('Cookie', cookies);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(EMAIL);
      expect(res.body.user.password).toBeUndefined(); // пароль не возвращается
      expect(res.body.user.id).toBeDefined();
    });

    test('username по умолчанию берётся из email (часть до @)', async () => {
      const cookies = await setupUser(app);
      const res = await request(app).get('/api/profile/me').set('Cookie', cookies);
      expect(res.body.user.username).toBe('profile'); // из 'profile@example.com'
    });
  });

  // ── PUT /api/profile/me ───────────────────────────────────────────────────

  describe('PUT /api/profile/me', () => {
    test('без авторизации → 401', async () => {
      const res = await request(app).put('/api/profile/me').send({ username: 'newname' });
      expect(res.status).toBe(401);
    });

    test('успешное обновление имени → 200, новое имя в ответе и в профиле', async () => {
      const cookies = await setupUser(app);

      // Обновляем имя
      const putRes = await request(app)
        .put('/api/profile/me')
        .set('Cookie', cookies)
        .send({ username: 'updated_name' });
      expect(putRes.status).toBe(200);
      expect(putRes.body.user.username).toBe('updated_name');

      // Проверяем что изменение сохранилось в БД
      const getRes = await request(app).get('/api/profile/me').set('Cookie', cookies);
      expect(getRes.body.user.username).toBe('updated_name');
    });

    test('пустое имя → 400', async () => {
      const cookies = await setupUser(app);
      const res = await request(app)
        .put('/api/profile/me')
        .set('Cookie', cookies)
        .send({ username: '   ' });
      expect(res.status).toBe(400);
    });

    test('поле не передано → 400', async () => {
      const cookies = await setupUser(app);
      const res = await request(app).put('/api/profile/me').set('Cookie', cookies).send({});
      expect(res.status).toBe(400);
    });
  });
});
