// src/__tests__/utils/validate.test.js
'use strict';

const {
  validateEmail,
  validatePassword,
  validateRegister,
  validateLogin,
} = require('../../utils/validate');

// ─── validateEmail ────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  test('пустая строка → ошибка', () => {
    expect(validateEmail('')).toEqual(['Email обязателен']);
  });

  test('не строка (число) → ошибка', () => {
    expect(validateEmail(123)).toEqual(['Email обязателен']);
  });

  test('не строка (массив) → ошибка', () => {
    expect(validateEmail(['a@b.com'])).toEqual(['Email обязателен']);
  });

  test('без @ → некорректный формат', () => {
    expect(validateEmail('notanemail')).toContainEqual(expect.stringMatching(/формат/i));
  });

  test('без домена → некорректный формат', () => {
    expect(validateEmail('user@')).toContainEqual(expect.stringMatching(/формат/i));
  });

  test('TLD меньше 2 символов → некорректный формат', () => {
    expect(validateEmail('user@host.x')).toContainEqual(expect.stringMatching(/формат/i));
  });

  test('слишком длинный (>254) → ошибка длины', () => {
    const long = 'a'.repeat(250) + '@example.com'; // 262 символа > 254
    expect(validateEmail(long)).toContainEqual(expect.stringMatching(/254/));
  });

  test('HTML-тег → недопустимые символы', () => {
    expect(validateEmail('<script>@x.com')).toContainEqual(expect.stringMatching(/недопустимые/i));
  });

  test('корректный email → пустой массив', () => {
    expect(validateEmail('user@example.com')).toEqual([]);
  });

  test('корректный email с поддоменом → пустой массив', () => {
    expect(validateEmail('user@mail.example.com')).toEqual([]);
  });

  test('пробелы вокруг trim → корректный', () => {
    expect(validateEmail('  user@example.com  ')).toEqual([]);
  });
});

// ─── validatePassword ─────────────────────────────────────────────────────────

describe('validatePassword', () => {
  test('пустая строка → только "обязателен"', () => {
    expect(validatePassword('')).toEqual(['Пароль обязателен']);
  });

  test('не строка → "обязателен"', () => {
    expect(validatePassword(null)).toEqual(['Пароль обязателен']);
  });

  test('превышает 30 символов → сразу возвращает ошибку длины', () => {
    const long = 'Aa1!'.repeat(10); // 40 символов
    expect(validatePassword(long)).toContainEqual(expect.stringMatching(/30/));
  });

  test('меньше 6 символов → ошибка', () => {
    expect(validatePassword('Aa1!')).toContainEqual(expect.stringMatching(/6/));
  });

  test('нет прописной буквы → ошибка', () => {
    expect(validatePassword('aa1!bbbb')).toContainEqual(expect.stringMatching(/прописн/i));
  });

  test('нет строчной буквы → ошибка', () => {
    expect(validatePassword('AA1!BBBB')).toContainEqual(expect.stringMatching(/строчн/i));
  });

  test('нет цифры → ошибка', () => {
    expect(validatePassword('Aa!bbbbb')).toContainEqual(expect.stringMatching(/цифр/i));
  });

  test('нет спецсимвола → ошибка', () => {
    expect(validatePassword('Aa1bbbbb')).toContainEqual(expect.stringMatching(/специальн/i));
  });

  test('несколько нарушений → несколько ошибок', () => {
    const errors = validatePassword('aaaaaaaa'); // нет upper, digit, special
    expect(errors.length).toBeGreaterThan(1);
  });

  test('валидный пароль → пустой массив', () => {
    expect(validatePassword('Secret1!')).toEqual([]);
  });

  test('валидный пароль с unicode-спецсимволом → пустой массив', () => {
    expect(validatePassword('Secret1@pass')).toEqual([]);
  });
});

// ─── validateRegister middleware ──────────────────────────────────────────────

describe('validateRegister middleware', () => {
  function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
  }

  test('валидные данные → вызывает next()', () => {
    const req  = { body: { email: 'user@example.com', password: 'Secret1!' } };
    const res  = makeRes();
    const next = jest.fn();
    validateRegister(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('невалидный email → 400, next не вызван', () => {
    const req  = { body: { email: 'bad-email', password: 'Secret1!' } };
    const res  = makeRes();
    const next = jest.fn();
    validateRegister(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('слабый пароль → 400', () => {
    const req  = { body: { email: 'user@example.com', password: 'weak' } };
    const res  = makeRes();
    const next = jest.fn();
    validateRegister(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('тело — массив (type confusion) → 400', () => {
    const req  = { body: ['user@example.com', 'Secret1!'] };
    const res  = makeRes();
    const next = jest.fn();
    validateRegister(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('тело — null → 400', () => {
    const req  = { body: null };
    const res  = makeRes();
    const next = jest.fn();
    validateRegister(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── validateLogin middleware ─────────────────────────────────────────────────

describe('validateLogin middleware', () => {
  function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
  }

  test('валидные данные → вызывает next()', () => {
    const req  = { body: { email: 'user@example.com', password: 'Secret1!' } };
    const res  = makeRes();
    const next = jest.fn();
    validateLogin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('email отсутствует → 400', () => {
    const req  = { body: { password: 'Secret1!' } };
    const res  = makeRes();
    const next = jest.fn();
    validateLogin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('email числом → 400', () => {
    const req  = { body: { email: 12345, password: 'Secret1!' } };
    const res  = makeRes();
    const next = jest.fn();
    validateLogin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
