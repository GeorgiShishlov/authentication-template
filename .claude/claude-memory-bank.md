# Memory Bank — auth-template

## Что это
Full-stack шаблон аутентификации. Node.js/Express + Next.js 16 + PostgreSQL.
Очищен от логики анкет/опросов — готов как стартер для любого проекта с auth.

## Стек
- **Backend:** Node.js, Express 5, JWT (httpOnly cookies + refresh tokens), bcryptjs, Passport.js (Google OAuth), Nodemailer (Yandex SMTP), Swagger, SQLite (тесты) / PostgreSQL (прод)
- **Frontend:** Next.js 16 App Router, TypeScript, Tailwind CSS v4
- **Инфраструктура:** Docker Compose (postgres:16, pgAdmin, backend, frontend)
- **Тесты:** Jest + Supertest (backend), Jest + React Testing Library (frontend)

## Архитектурные решения

### Factory pattern (инжекция БД)
Все модели и роуты — фабричные функции, принимающие `db`-адаптер:
```js
const userModel = createUserModel(db);
const app = createApp(db); // createApp принимает db, создаёт все модели внутри
```
Тесты используют in-memory SQLite, прод — PostgreSQL, без изменений в бизнес-логике.

### DB-адаптер (единый интерфейс)
Оба адаптера реализуют: `run(sql, params)`, `get(sql, params)`, `all(sql, params)`, `exec(sql)`.
`PostgresAdapter` автоматически конвертирует `?` → `$1, $2, …`.
Файл: `backend/src/config/database.js`

### Выбор БД
`initializeDatabase()` использует PostgreSQL если задан `DATABASE_URL`, иначе — SQLite-файл.

### Тесты изолированы от типа БД
`createTestDb()` (`backend/src/__tests__/helpers/createTestDb.js`) возвращает in-memory SQLite.

## Известные особенности

### SMTP из Docker
Yandex SMTP блокирует письма с Docker-IP как спам.
Fallback: при ошибке отправки токен печатается в лог:
```
[DEV] Ссылка подтверждения для ...: http://localhost:3000/verify-email?token=...
```

### PostgreSQL vs SQLite — обработка ошибок
Дубликат уникального поля: SQLite бросает `UNIQUE constraint failed`, PostgreSQL — `error.code === '23505'`.
В роутах проверяем оба случая.

### Next.js 16 — useSearchParams
`useSearchParams()` требует обёртки в `<Suspense>` при статической сборке.
Паттерн: внутренний компонент `*Content` с хуком, внешний экспорт с `<Suspense>`.

### Google OAuth
Маршруты `/api/auth/google*` регистрируются только если задан `GOOGLE_CLIENT_ID`.
После успешного OAuth редирект → `/profile`.
Redirect URI в Google Cloud Console: `http://localhost:3001/api/auth/google/callback`.

## Docker
```bash
docker compose up --build   # первый запуск
docker compose up           # последующие
docker compose logs backend # логи бэкенда
```
- Приложение: http://localhost:3000
- API + Swagger: http://localhost:3001/api-docs
- pgAdmin: http://localhost:5050 (пароль БД: `otus_password`)

## Переменные окружения
Все секреты в `backend/.env`. Docker читает их через `env_file: ./backend/.env`.
`DATABASE_URL` переопределяется в `docker-compose.yml` → указывает на контейнер postgres.

## Структура после очистки

### Backend routes
- `POST/GET /api/auth/*` — регистрация, логин, логаут, refresh, email verify, forgot/reset password, Google OAuth
- `GET/PUT /api/profile/me` — профиль пользователя (protected)
- `GET/POST/PUT/DELETE /api/admin/*` — admin panel
- `POST /api/track` — анонимный трекинг страниц для admin stats

### Frontend pages
- `/` — лендинг с кнопками входа/регистрации
- `/profile` — страница профиля (protected)
- `/verify-email` — подтверждение email
- `/reset-password` — сброс пароля
- `/admin` — admin panel
