// src/__tests__/routes/auth.test.js
'use strict';

process.env.JWT_SECRET     = 'test-secret';
process.env.ADMIN_LOGIN    = 'admin';
process.env.ADMIN_PASSWORD = 'admin';

const request      = require('supertest');
const express      = require('express');
const cookieParser = require('cookie-parser');

const { createAuthRouter } = require('../../routes/auth');

// ── Mock-объекты вместо jest.mock ─────────────────────────────────────────────
// Маршруты получают зависимости через параметры фабрики, поэтому
// просто передаём объекты с jest.fn(). Нет нужды в jest.mock() и перезагрузке модулей.

const mockMailer = {
  sendVerificationEmail:  jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendPasswordChangedEmail: jest.fn(),
};

const mockUserModel = {
  createUser:                  jest.fn(),
  findUserByEmail:             jest.fn(),
  findUserForLogin:            jest.fn(),
  findUserById:                jest.fn(),
  verifyPassword:              jest.fn(),
  findUserByVerificationToken: jest.fn(),
  markEmailVerified:           jest.fn(),
  updatePassword:              jest.fn(),
  updateUsername:              jest.fn(),
};

const mockRefreshTokenModel = {
  createRefreshToken: jest.fn(),
  findRefreshToken:   jest.fn(),
  deleteRefreshToken: jest.fn(),
  deleteAllForUser:   jest.fn(),
};

const mockPasswordResetModel = {
  MAX_ATTEMPTS:       3,
  createResetToken:   jest.fn(),
  findResetToken:     jest.fn(),
  deleteResetToken:   jest.fn(),
  countRecentAttempts: jest.fn(),
  recordAttempt:      jest.fn(),
};

function buildApp() {
  return express()
    .use(express.json())
    .use(cookieParser())
    .use('/api/auth', createAuthRouter({
      userModel:          mockUserModel,
      refreshTokenModel:  mockRefreshTokenModel,
      passwordResetModel: mockPasswordResetModel,
      mailer:             mockMailer,
    }));
}

let app;
beforeEach(() => {
  app = buildApp();
  mockPasswordResetModel.MAX_ATTEMPTS = 3;
});

const VALID_USER = {
  id: 'uuid-1',
  username: 'testuser',
  email: 'user@example.com',
  password: '$2a$10$hash',
  email_verified: 1,
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    mockUserModel.createUser.mockResolvedValue({
      id: 'uuid-1', username: 'user', email: 'user@example.com', verificationToken: 'tok',
    });
    mockMailer.sendVerificationEmail.mockResolvedValue();
  });

  test('успешная регистрация → 201 + сообщение', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'Secret1!' });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/подтверждения/i);
    expect(mockMailer.sendVerificationEmail).toHaveBeenCalled();
  });

  test('невалидный email → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad', password: 'Secret1!' });
    expect(res.status).toBe(400);
  });

  test('слабый пароль → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'weak' });
    expect(res.status).toBe(400);
  });

  test('дублирующийся email (подтверждён) → 400 с понятным сообщением', async () => {
    mockUserModel.createUser.mockRejectedValue(new Error('UNIQUE constraint failed: users.email'));
    mockUserModel.findUserByEmail.mockResolvedValue({ email_verified: 1, verification_token: null });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'Secret1!' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/существует/i);
  });

  test('дублирующийся email (не подтверждён) → 400 + повторное письмо', async () => {
    mockUserModel.createUser.mockRejectedValue(new Error('UNIQUE constraint failed: users.email'));
    mockUserModel.findUserByEmail.mockResolvedValue({ email_verified: 0, verification_token: 'tok123' });
    mockMailer.sendVerificationEmail.mockResolvedValue();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'Secret1!' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/не подтверждён/i);
    expect(mockMailer.sendVerificationEmail).toHaveBeenCalledWith('user@example.com', 'tok123');
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mockUserModel.verifyPassword.mockResolvedValue(true);
    mockRefreshTokenModel.createRefreshToken.mockResolvedValue('refresh-token-xyz');
  });

  test('успешный вход → 200, устанавливает cookies', async () => {
    mockUserModel.findUserForLogin.mockResolvedValue(VALID_USER);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'Secret1!' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.user.email).toBe('user@example.com');
  });

  test('пользователь не найден → 401', async () => {
    mockUserModel.findUserForLogin.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noone@example.com', password: 'Secret1!' });
    expect(res.status).toBe(401);
  });

  test('неверный пароль → 401', async () => {
    mockUserModel.findUserForLogin.mockResolvedValue(VALID_USER);
    mockUserModel.verifyPassword.mockResolvedValue(false);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'Secret1!' });
    expect(res.status).toBe(401);
  });

  test('email не подтверждён → 403', async () => {
    mockUserModel.findUserForLogin.mockResolvedValue({ ...VALID_USER, email_verified: 0 });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'Secret1!' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/подтвердите/i);
  });

  test('невалидный email → 400 (до обращения к БД)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'Secret1!' });
    expect(res.status).toBe(400);
    expect(mockUserModel.findUserForLogin).not.toHaveBeenCalled();
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  test('нет refreshToken cookie → 401', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  test('невалидный/просроченный токен → 401', async () => {
    mockRefreshTokenModel.findRefreshToken.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=invalid');
    expect(res.status).toBe(401);
  });

  test('просроченный по времени → 401', async () => {
    mockRefreshTokenModel.findRefreshToken.mockResolvedValue({
      token: 'tok', user_id: 'uuid-1',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=expired-tok');
    expect(res.status).toBe(401);
  });

  test('валидный токен → 200, новые cookies, rotation', async () => {
    mockRefreshTokenModel.findRefreshToken.mockResolvedValue({
      token: 'old-tok', user_id: 'uuid-1',
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });
    mockRefreshTokenModel.deleteRefreshToken.mockResolvedValue();
    mockRefreshTokenModel.createRefreshToken.mockResolvedValue('new-tok');

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=old-tok');
    expect(res.status).toBe(200);
    expect(mockRefreshTokenModel.deleteRefreshToken).toHaveBeenCalledWith('old-tok');
    expect(mockRefreshTokenModel.createRefreshToken).toHaveBeenCalled();
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  test('выход без cookie → 200', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });

  test('выход с refreshToken → удаляет токен из БД', async () => {
    mockRefreshTokenModel.deleteRefreshToken.mockResolvedValue();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'refreshToken=some-token');
    expect(res.status).toBe(200);
    expect(mockRefreshTokenModel.deleteRefreshToken).toHaveBeenCalledWith('some-token');
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    mockPasswordResetModel.countRecentAttempts.mockResolvedValue(0);
    mockPasswordResetModel.recordAttempt.mockResolvedValue();
    mockMailer.sendPasswordResetEmail.mockResolvedValue();
  });

  test('существующий email → 200, универсальное сообщение', async () => {
    mockUserModel.findUserByEmail.mockResolvedValue(VALID_USER);
    mockPasswordResetModel.createResetToken.mockResolvedValue('reset-tok');
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(mockMailer.sendPasswordResetEmail).toHaveBeenCalled();
  });

  test('несуществующий email → 200, то же сообщение (защита от enumeration)', async () => {
    mockUserModel.findUserByEmail.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(mockMailer.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('превышен лимит запросов → 429', async () => {
    mockPasswordResetModel.countRecentAttempts.mockResolvedValue(3);
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'user@example.com' });
    expect(res.status).toBe(429);
  });

  test('некорректный email → 200 (не раскрываем детали)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: '' });
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    mockMailer.sendPasswordChangedEmail.mockResolvedValue();
    mockRefreshTokenModel.deleteAllForUser.mockResolvedValue();
    mockUserModel.updatePassword.mockResolvedValue();
  });

  test('валидный токен + корректный пароль → 200', async () => {
    mockPasswordResetModel.findResetToken.mockResolvedValue({ token: 'tok', user_id: 'uuid-1' });
    mockPasswordResetModel.deleteResetToken.mockResolvedValue();
    mockUserModel.findUserById.mockResolvedValue(VALID_USER);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'tok', password: 'NewSecret1!' });
    expect(res.status).toBe(200);
    expect(mockUserModel.updatePassword).toHaveBeenCalledWith('uuid-1', 'NewSecret1!');
    expect(mockRefreshTokenModel.deleteAllForUser).toHaveBeenCalledWith('uuid-1');
    expect(mockMailer.sendPasswordChangedEmail).toHaveBeenCalled();
  });

  test('недействительный токен → 400', async () => {
    mockPasswordResetModel.findResetToken.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'bad-tok', password: 'NewSecret1!' });
    expect(res.status).toBe(400);
  });

  test('слабый пароль → 400, токен не расходуется', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'tok', password: 'weak' });
    expect(res.status).toBe(400);
    expect(mockPasswordResetModel.findResetToken).not.toHaveBeenCalled();
  });

  test('токен не передан → 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ password: 'NewSecret1!' });
    expect(res.status).toBe(400);
  });
});
