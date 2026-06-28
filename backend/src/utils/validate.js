// backend/src/utils/validate.js

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 30;
const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 50;

// Запрещённые символы: null-байты и управляющие символы (кроме \t \n \r)
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

/**
 * Защита от type-confusion: значение должно быть именно строкой,
 * не массивом, объектом или числом (HTTP Parameter Pollution и т.п.)
 */
function isString(value) {
  return typeof value === 'string';
}

/**
 * Защита от XSS и header injection: отклоняем HTML-теги и CRLF.
 */
function hasUnsafeChars(str) {
  return /<|>|\r|\n/.test(str) || CONTROL_CHARS_RE.test(str);
}

/**
 * Проверяет, что тело запроса — простой объект (защита от prototype pollution).
 * Возвращает массив ошибок.
 */
function validateBodyShape(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    return ['Некорректный формат запроса'];
  }

  // Отклоняем опасные собственные ключи (prototype pollution)
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  if (dangerousKeys.some((k) => Object.prototype.hasOwnProperty.call(body, k))) {
    return ['Некорректный формат запроса'];
  }

  return [];
}

function validateEmail(raw) {
  const errors = [];

  if (!isString(raw)) return ['Email обязателен'];
  const email = raw.trim();

  if (!email) return ['Email обязателен'];

  // Ограничение длины до regex — защита от ReDoS
  if (email.length > EMAIL_MAX_LENGTH) return [`Email не должен превышать ${EMAIL_MAX_LENGTH} символов`];

  if (hasUnsafeChars(email)) return ['Email содержит недопустимые символы'];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Некорректный формат email');

  return errors;
}

function validatePassword(raw) {
  const errors = [];

  if (!isString(raw)) return ['Пароль обязателен'];
  if (!raw) return ['Пароль обязателен'];

  // Проверяем длину первой — до остальных regex (защита от ReDoS)
  if (raw.length > PASSWORD_MAX_LENGTH) return [`Пароль не должен превышать ${PASSWORD_MAX_LENGTH} символов`];
  if (raw.length < PASSWORD_MIN_LENGTH) errors.push(`Не менее ${PASSWORD_MIN_LENGTH} символов`);

  if (!/[A-Z]/.test(raw)) errors.push('Хотя бы одна прописная буква (A–Z)');
  if (!/[a-z]/.test(raw)) errors.push('Хотя бы одна строчная буква (a–z)');
  if (!/[0-9]/.test(raw)) errors.push('Хотя бы одна цифра');
  if (!/[^A-Za-z0-9]/.test(raw)) errors.push('Хотя бы один специальный символ');

  return errors;
}

function validateUsername(raw) {
  if (!isString(raw)) return ['Имя пользователя должно быть строкой'];
  const val = raw.trim();
  const errors = [];

  if (val.length > USERNAME_MAX_LENGTH) return [`Имя не должно превышать ${USERNAME_MAX_LENGTH} символов`];
  if (val.length < USERNAME_MIN_LENGTH) errors.push(`Имя должно содержать минимум ${USERNAME_MIN_LENGTH} символа`);
  if (hasUnsafeChars(val)) errors.push('Имя содержит недопустимые символы');

  return errors;
}

/**
 * Middleware-фабрика. Принимает функцию-схему вида:
 *   (body) => { fieldName: [errors], ... }
 * При наличии ошибок отвечает 400 с { errors } и сводным message.
 */
function makeValidator(schemaFn) {
  return (req, res, next) => {
    const shapeErrors = validateBodyShape(req.body);
    if (shapeErrors.length) {
      return res.status(400).json({ message: shapeErrors[0] });
    }

    const errors = schemaFn(req.body);
    const hasErrors = Object.values(errors).some((e) => e.length > 0);

    if (hasErrors) {
      const firstMessage = Object.values(errors).flat()[0];
      return res.status(400).json({ message: firstMessage, errors });
    }

    next();
  };
}

// Готовые middleware для роутов
const validateRegister = makeValidator(({ email, password, username }) => {
  const errors = {};
  const emailErrors = validateEmail(email);
  const passwordErrors = validatePassword(password);
  if (emailErrors.length) errors.email = emailErrors;
  if (passwordErrors.length) errors.password = passwordErrors;
  if (username !== undefined) {
    const usernameErrors = validateUsername(username);
    if (usernameErrors.length) errors.username = usernameErrors;
  }
  return errors;
});

function validatePasswordLogin(raw) {
  if (!isString(raw) || !raw) return ['Пароль обязателен'];
  if (raw.length > PASSWORD_MAX_LENGTH) return [`Пароль не должен превышать ${PASSWORD_MAX_LENGTH} символов`];
  return [];
}

const validateLogin = makeValidator(({ email, password }) => {
  const errors = {};
  const emailErrors = validateEmail(email);
  const passwordErrors = validatePasswordLogin(password);
  if (emailErrors.length) errors.email = emailErrors;
  if (passwordErrors.length) errors.password = passwordErrors;
  return errors;
});

module.exports = { validateRegister, validateLogin, validateEmail, validatePassword, validateUsername };
