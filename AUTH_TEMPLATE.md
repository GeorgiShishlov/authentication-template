# Auth Template — Справочник по шаблону

Этот файл описывает, что реализовано в шаблоне аутентификации на базе проекта **Survey-quizzes**.
Скопируйте его в новый проект и загрузите в контекст Claude — он восстановит полную картину.

---

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Node.js 20, Express 5 |
| Auth | JWT (access 15m + refresh 7d), httpOnly cookies, bcryptjs |
| OAuth | Passport.js — Google OAuth 2.0 (опционально) |
| Email | Nodemailer (Yandex SMTP) + DEV-fallback в консоль |
| База данных | PostgreSQL (прод) / SQLite in-memory (тесты) |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Безопасность | helmet, express-rate-limit, express-validator |
| Тесты | Jest + Supertest (backend), Jest + RTL (frontend) |
| Инфраструктура | Docker Compose, GitHub Actions CI/CD |

---

## Реализованные фичи аутентификации

### Backend (`backend/src/`)

| Фича | Эндпоинт | Файл |
|------|----------|------|
| Регистрация с верификацией email | `POST /api/auth/register` | `routes/auth.js` |
| Подтверждение email по токену | `GET /api/auth/verify-email` | `routes/auth.js` |
| Вход (email + пароль) | `POST /api/auth/login` | `routes/auth.js` |
| Выход | `POST /api/auth/logout` | `routes/auth.js` |
| Обновление access-токена | `POST /api/auth/refresh` | `routes/auth.js` |
| Сброс пароля (forgot) | `POST /api/auth/forgot-password` | `routes/auth.js` |
| Сброс пароля (reset) | `POST /api/auth/reset-password` | `routes/auth.js` |
| Профиль (protected) | `GET /api/profile/me` | `routes/profile.js` |
| Google OAuth | `GET /api/auth/google` + callback | `routes/auth.js`, `config/passport.js` |
| Регистрация через Google | автоматически при первом OAuth | `config/passport.js` |
| Панель администратора | `GET/POST /api/admin/*` | `routes/admin.js` |

### Frontend (`frontend/app/`)

| Страница | Путь | Описание |
|----------|------|----------|
| Лендинг + AuthModal | `/` | Регистрация / вход / forgot-password в одном модале |
| Верификация email | `/verify-email` | Читает `?token=` из URL |
| Сброс пароля | `/reset-password` | Читает `?token=` из URL |
| Профиль | `/profile` | Защищённая страница, редирект на `/` при 401 |
| Панель администратора | `/admin` | Отдельная авторизация (ADMIN_PASSWORD) |

---

## Архитектурные решения

### Factory pattern (DI для DB)
Все модели и роуты — фабричные функции, принимающие `db`-адаптер:
```js
const app = createApp(db);           // тесты: createDatabase(':memory:')
const userModel = createUserModel(db); // прод: PostgreSQL Pool
```

### DB-адаптер — единый интерфейс SQLite/PostgreSQL
Файл: `backend/src/config/database.js`
- Методы: `run(sql, params)`, `get(sql, params)`, `all(sql, params)`, `exec(sql)`
- PostgreSQL-адаптер автоматически конвертирует `?` → `$1, $2, …`
- `initializeDatabase()` выбирает БД по `DATABASE_URL` (если задан — PostgreSQL, иначе SQLite)

### JWT-стратегия
- **Access-токен:** 15 минут, в httpOnly cookie `token`
- **Refresh-токен:** 7 дней, в httpOnly cookie `refreshToken`, хранится в таблице `refresh_tokens`
- Ротация: при каждом `/refresh` старый токен инвалидируется, выпускается новый
- Middleware `auth.js` читает токен из cookie или заголовка `Authorization: Bearer ...`

### Безопасность (уже закрыто)
- `helmet({ contentSecurityPolicy: false })` — первый middleware
- Rate limiting: 5 запросов / 15 мин на `/login` и `/register` (отключается при `NODE_ENV=test`)
- `validatePassword` проверяет сложность только при **регистрации и сбросе пароля** (не при входе)
- `findUserForLogin(email)` — единственный метод, возвращающий хеш пароля
- Токены верификации/сброса в консоль только при `NODE_ENV !== production`

### Google OAuth
- Регистрируется только если задан `GOOGLE_CLIENT_ID`
- При первом входе через Google — автоматически создаётся пользователь с `email_verified = true`
- Redirect URI для прода: `https://<domain>/api/auth/google/callback`

### SMTP / Email
- При ошибке отправки письма — fallback: токен печатается в консоль (`[DEV]`)
- Имя отправителя: `process.env.APP_NAME || 'Auth Demo'`
- Письма: верификация email, сброс пароля

---

## Структура файлов

```
backend/
  src/
    app.js                    ← Express entry point, createApp(db)
    config/
      database.js             ← DB-адаптер + initializeDatabase()
      mailer.js               ← Nodemailer, sendVerificationEmail, sendPasswordReset
      passport.js             ← Google OAuth strategy
      swagger.js              ← Swagger UI
    middleware/
      auth.js                 ← verifyToken middleware (cookie + Bearer)
      adminAuth.js            ← Admin-only middleware
    models/
      User.js                 ← createUser, findUserByEmail, findUserForLogin, verifyPassword
      RefreshToken.js         ← create, findByToken, deleteByToken, deleteAllForUser
      PasswordReset.js        ← createToken, findByToken, deleteByToken
    routes/
      auth.js                 ← Все auth-эндпоинты
      profile.js              ← GET /api/profile/me
      admin.js                ← Управление пользователями + статистика
    utils/
      validate.js             ← validateRegister, validateLogin middleware
    __tests__/
      routes/auth.test.js     ← 40+ тестов auth flow
      routes/profile.test.js
      utils/validate.test.js
      integration/auth.test.js
      helpers/createTestDb.js ← in-memory SQLite для тестов
  .env.example                ← Все переменные окружения с комментариями

frontend/
  app/
    page.tsx                  ← Лендинг + AuthModal
    profile/page.tsx
    verify-email/page.tsx
    reset-password/page.tsx
    admin/page.tsx
  components/
    AppLayout.tsx             ← Хедер + профиль-дропдаун + выход
    ThemeToggle.tsx           ← Светлая/тёмная тема (localStorage)
  lib/
    api.ts                    ← authAPI: login, register, logout, getProfile,
                                 verifyEmail, forgotPassword, resetPassword
```

---

## Переменные окружения (`backend/.env`)

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=<случайная строка 32+ символа>
ADMIN_PASSWORD=<пароль для /admin>
FRONTEND_URL=http://localhost:3000
APP_NAME=Survey-quizzes

# Google OAuth (опционально)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# SMTP (опционально — без него токены идут в консоль)
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_FROM=
SMTP_PASS=

# PostgreSQL (опционально — без него SQLite)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
PG_POOL_MAX=5
PG_POOL_IDLE_TIMEOUT_MS=30000
PG_POOL_CONNECTION_TIMEOUT_MS=5000
```

---

## Как адаптировать для нового проекта

1. **Переименовать** `APP_NAME` в `.env` и в `package.json`
2. **Добавить таблицы** своей предметной области в `initializeDatabase()` в `database.js`
3. **Создать модели** по образцу `User.js` (фабричная функция, принимает `db`)
4. **Создать роуты** по образцу `profile.js` (экспортирует `createRouter(db)`)
5. **Подключить роуты** в `app.js` (`app.use('/api/...', createRouter(db))`)
6. **Frontend:** страницы, не требующие авторизации — без `AppLayout`, защищённые — с ним
7. **Тесты:** копировать `createTestDb.js`, в каждом тест-файле `createApp(await createTestDb())`

### Что НЕ нужно трогать при адаптации
- Весь `auth.js` (роуты, логика токенов)
- `middleware/auth.js` — уже работает для любых роутов
- `models/User.js`, `RefreshToken.js`, `PasswordReset.js`
- `config/mailer.js`, `config/passport.js`
- `utils/validate.js` (только если нужны новые поля)
- Frontend: `page.tsx` (AuthModal), `verify-email`, `reset-password`, `AppLayout`

---

## Известные нюансы

- **SMTP + Docker:** Yandex блокирует письма с Docker IP. В dev режиме токены идут в консоль — это норм.
- **PostgreSQL vs SQLite:** дубликат уникального поля — SQLite: `UNIQUE constraint failed`, PG: `error.code === '23505'`. В `auth.js` оба случая уже обрабатываются.
- **Google OAuth + localhost:** в Google Cloud Console нужно добавить `http://localhost:3001/api/auth/google/callback` в Authorised redirect URIs.
- **Next.js 16 + useSearchParams:** требует обёртки в `<Suspense>`. Паттерн: внутренний компонент `*Content` с хуком, внешний экспорт с `<Suspense>`.
- **Rate limiter в тестах:** отключается через `skip: () => process.env.NODE_ENV === 'test'`.
