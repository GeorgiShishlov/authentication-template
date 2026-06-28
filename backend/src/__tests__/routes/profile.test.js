// src/__tests__/routes/profile.test.js
'use strict';

process.env.JWT_SECRET = 'test-secret';

const request      = require('supertest');
const express      = require('express');
const cookieParser = require('cookie-parser');
const jwt          = require('jsonwebtoken');

const { createProfileRouter } = require('../../routes/profile');

const mockUserModel = {
  findUserById:   jest.fn(),
  updateUsername: jest.fn(),
};

function buildApp() {
  return express()
    .use(express.json())
    .use(cookieParser())
    .use('/api/profile', createProfileRouter({ userModel: mockUserModel }));
}

let app;
beforeEach(() => { app = buildApp(); });

function authCookie(userId = 'uuid-1') {
  const token = jwt.sign({ userId }, 'test-secret', { expiresIn: '15m' });
  return `token=${token}`;
}

const PROFILE_USER = {
  id: 'uuid-1',
  username: 'testuser',
  email: 'user@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
};

// ─── GET /api/profile/me ──────────────────────────────────────────────────────

describe('GET /api/profile/me', () => {
  test('без токена → 401', async () => {
    const res = await request(app).get('/api/profile/me');
    expect(res.status).toBe(401);
  });

  test('с валидным токеном → 200, данные пользователя', async () => {
    mockUserModel.findUserById.mockResolvedValue(PROFILE_USER);
    const res = await request(app)
      .get('/api/profile/me')
      .set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@example.com');
    expect(res.body.user.password).toBeUndefined();
  });

  test('пользователь не найден в БД → 404', async () => {
    mockUserModel.findUserById.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/profile/me')
      .set('Cookie', authCookie());
    expect(res.status).toBe(404);
  });

  test('просроченный токен → 403', async () => {
    const expired = jwt.sign({ userId: 'uuid-1' }, 'test-secret', { expiresIn: -1 });
    const res = await request(app)
      .get('/api/profile/me')
      .set('Cookie', `token=${expired}`);
    expect(res.status).toBe(403);
  });
});

// ─── PUT /api/profile/me ──────────────────────────────────────────────────────

describe('PUT /api/profile/me', () => {
  beforeEach(() => {
    mockUserModel.updateUsername.mockResolvedValue();
    mockUserModel.findUserById.mockResolvedValue({ ...PROFILE_USER, username: 'newname' });
  });

  test('без токена → 401', async () => {
    const res = await request(app).put('/api/profile/me').send({ username: 'newname' });
    expect(res.status).toBe(401);
  });

  test('валидное имя → 200, обновлённый пользователь', async () => {
    const res = await request(app)
      .put('/api/profile/me')
      .set('Cookie', authCookie())
      .send({ username: 'newname' });
    expect(res.status).toBe(200);
    expect(mockUserModel.updateUsername).toHaveBeenCalledWith('uuid-1', 'newname');
    expect(res.body.user.username).toBe('newname');
  });

  test('пустое имя → 400', async () => {
    const res = await request(app)
      .put('/api/profile/me')
      .set('Cookie', authCookie())
      .send({ username: '   ' });
    expect(res.status).toBe(400);
    expect(mockUserModel.updateUsername).not.toHaveBeenCalled();
  });

  test('имя не передано → 400', async () => {
    const res = await request(app)
      .put('/api/profile/me')
      .set('Cookie', authCookie())
      .send({});
    expect(res.status).toBe(400);
  });
});
