// src/__tests__/middleware/auth.test.js
'use strict';

process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');
const authMiddleware = require('../../middleware/auth');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

describe('authMiddleware', () => {
  test('нет токена → 401', () => {
    const req  = { cookies: {}, headers: {} };
    const res  = makeRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('невалидный токен в cookies → 403', () => {
    const req  = { cookies: { token: 'invalid.token.here' }, headers: {} };
    const res  = makeRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('просроченный токен → 403', () => {
    const expired = jwt.sign({ userId: 'u1' }, 'test-secret', { expiresIn: -1 });
    const req  = { cookies: { token: expired }, headers: {} };
    const res  = makeRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('валидный токен в cookies → next(), req.userId установлен', () => {
    const token = jwt.sign({ userId: 'user-uuid' }, 'test-secret');
    const req   = { cookies: { token }, headers: {} };
    const res   = makeRes();
    const next  = jest.fn();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-uuid');
  });

  test('валидный токен в Authorization header → next()', () => {
    const token = jwt.sign({ userId: 'user-uuid' }, 'test-secret');
    const req   = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res   = makeRes();
    const next  = jest.fn();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-uuid');
  });

  test('токен с другим секретом → 403', () => {
    const wrong = jwt.sign({ userId: 'u1' }, 'wrong-secret');
    const req   = { cookies: { token: wrong }, headers: {} };
    const res   = makeRes();
    const next  = jest.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
