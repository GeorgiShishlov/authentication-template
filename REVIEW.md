# Code Review: Survey — платформа для анкетирования

> **Автор:** Юрий Шишлов  
> **Курс:** OTUS — AI для разработчиков  
> **Репозиторий:** https://github.com/georgheim13/otus-ai-project *(приватный)*  
> **Прод:** https://survey-quizzes.ru  
> **Дата:** апрель 2026

---

## 1. Описание проекта и область анализа

**Survey** — учебный full-stack проект: платформа для создания анкет, сбора ответов и просмотра аналитики. Пользователь регистрируется, создаёт анкеты с вопросами двух типов (выбор / свободный текст), публикует их по публичной ссылке и просматривает ответы с возможностью поставить оценку каждому участнику.

**Стек:**

| Слой | Технология |
|------|-----------|
| Backend | Node.js 20, Express 5, JWT (access + refresh), Passport.js (Google OAuth), Nodemailer |
| База данных | PostgreSQL 16 (прод) / SQLite in-memory (тесты) |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Инфраструктура | Docker Compose, GitHub Actions CI/CD, nginx-proxy + acme-companion (SSL) |
| Тесты | Jest + Supertest (backend, 94 теста), Jest + React Testing Library (frontend, 116 тестов) |

**Область анализа:** весь проект — backend-аутентификация, модели, middleware, frontend-компоненты, CI/CD-пайплайн.

---

## 2. Архитектура

### Backend (`backend/src/`)

```
app.js                  ← Express entry point; вызывает initializeDatabase() до listen()
config/
  database.js           ← Универсальный DB-адаптер (SQLite / PostgreSQL)
  mailer.js             ← Nodemailer: верификация email, сброс пароля, уведомления
models/
  User.js               ← CRUD пользователей (bcrypt, UUID)
  RefreshToken.js       ← Refresh-токены с ротацией
  Survey.js / Question.js / Response.js / Answer.js / PageView.js
middleware/
  auth.js               ← JWT-верификация; читает cookie или заголовок Authorization
routes/
  auth.js               ← /api/auth/* (register, login, logout, verify-email, OAuth)
  profile.js            ← /api/profile/me (protected)
  surveys.js            ← /api/surveys/* (CRUD + publish)
  admin.js              ← /api/admin/* (пользователи, статистика)
utils/
  validate.js           ← express-validator middleware
```

**Ключевое архитектурное решение — factory pattern:**

```js
// Все модели и роуты — фабричные функции
const userModel = createUserModel(db);
const app = createApp(db);
```

Это позволяет тестам использовать `createDatabase(':memory:')` (SQLite), а проду — PostgreSQL, без изменений в бизнес-логике. Один интерфейс: `run / get / all / exec`. Адаптер PostgreSQL автоматически конвертирует `?` → `$1, $2, …`.

**Auth flow:**

```
Регистрация → bcrypt(password) → UUID токен верификации → письмо на email
Вход        → findUserByEmail → verifyPassword → JWT(15m) + refreshToken(7d) → httpOnly cookies
Refresh     → POST /refresh → ротация refresh-токена → новый access-токен
Google OAuth → Passport → callback → setTokenCookies → redirect /surveys
```

### Frontend (`frontend/app/`)

```
page.tsx                    ← Лендинг + AuthModal (login / register / forgot)
profile/page.tsx            ← Профиль пользователя
surveys/page.tsx            ← Список анкет
surveys/new/page.tsx        ← Создание анкеты
surveys/[id]/edit/page.tsx  ← Редактирование
surveys/[id]/results/page.tsx ← Просмотр ответов
verify-email/page.tsx       ← Подтверждение email
reset-password/page.tsx     ← Сброс пароля
admin/page.tsx              ← Панель администратора
p/[uuid]/page.tsx           ← Публичная страница анкеты (без авторизации)
```

Все авторизованные страницы используют общий `AppLayout` (хедер + профиль-дропдаун). Тема (светлая/тёмная) хранится в `localStorage` и применяется CSS-переменными.

---

## 3. Инструкция по настройке (ручные шаги)

### 3.1 Локальный запуск

```bash
git clone <repo>
cd otus-ai-project
docker compose up --build
```

Сервисы:
- **Приложение:** http://localhost:3000
- **API + Swagger:** http://localhost:3001/api-docs
- **pgAdmin:** http://localhost:5050

### 3.2 Файл `backend/.env` (создать вручную)

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=<случайная строка 32+ символа>
ADMIN_PASSWORD=<пароль для /admin>

FRONTEND_URL=http://localhost:3000

# Google OAuth (опционально — см. п. 3.3)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# SMTP (опционально — см. п. 3.4)
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<ваш логин @yandex.ru>
SMTP_FROM=<ваш логин @yandex.ru>
SMTP_PASS=<пароль приложения — НЕ основной пароль>
```

> **Важно:** без SMTP всё равно работает — токены верификации/сброса печатаются в консоль:
> `[DEV] Ссылка подтверждения для user@mail.ru: http://localhost:3000/verify-email?token=...`

### 3.3 Настройка Google OAuth

1. Перейти в [Google Cloud Console](https://console.cloud.google.com/)
2. Создать проект → **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
3. Тип приложения: **Web application**
4. **Authorised redirect URIs:**
   - Для локальной разработки: `http://localhost:3001/api/auth/google/callback`
   - Для прода: `https://survey-quizzes.ru/api/auth/google/callback`
5. Скопировать **Client ID** и **Client Secret** в `.env`
6. В `.env` также задать `GOOGLE_CALLBACK_URL` (URL из п. 4)

> Если `GOOGLE_CLIENT_ID` не задан — маршруты `/api/auth/google*` просто не регистрируются, кнопка Google скрыта.

### 3.4 Настройка SMTP (Яндекс)

1. Войти в аккаунт Яндекс.Почты
2. **Настройки → Безопасность → Пароли приложений → Создать пароль**
3. Тип: **Почта** → скопировать сгенерированный пароль (16 символов)
4. В `.env`: `SMTP_PASS=<этот пароль>`, `SMTP_USER=yourlogin@yandex.ru`

> **Известная проблема:** Яндекс блокирует письма с Docker IP как спам. На проде это проявляется ошибкой `554 5.7.1 Message rejected`. Workaround — использовать другой SMTP-провайдер (Gmail, Mailgun, SendGrid, Resend) или сервер вне Docker-сети.

### 3.5 GitHub Secrets (для CI/CD деплоя)

| Secret | Описание |
|--------|----------|
| `DOCKERHUB_USERNAME` | Логин Docker Hub |
| `DOCKERHUB_TOKEN` | Access Token Docker Hub (не пароль) |
| `SSH_HOST` | IP-адрес VDS |
| `SSH_PRIVATE_KEY` | Приватный SSH-ключ (содержимое `~/.ssh/id_rsa`) |
Выполните в PowerShell:  
Get-Content $env:USERPROFILE\.ssh\id_ed25519 | Set-Clipboard
Содержимое приватного ключа скопируется в буфер обмена.

Затем на GitHub → New repository secret:

Name: SSH_PRIVATE_KEY
Secret: вставьте из буфера (Ctrl+V)
Начинается с -----BEGIN OPENSSH PRIVATE KEY----- и заканчивается -----END OPENSSH PRIVATE KEY-----.
| `BACKEND_ENV` | Полное содержимое `backend/.env` для прода |

Создать: **GitHub → Settings → Secrets and variables → Actions → New repository secret**

### 3.6 Продакшн-переменные (в `BACKEND_ENV`)

Отличаются от локальных:
```env
NODE_ENV=production
FRONTEND_URL=https://survey-quizzes.ru
GOOGLE_CALLBACK_URL=https://survey-quizzes.ru/api/auth/google/callback
# DATABASE_URL задаётся в docker-compose, не нужен здесь
```

---

## 4. Найденные проблемы

> Статус: ✅ Исправлено / ⏳ Открыто

### 4.1 Безопасность

---

#### ✅ [КРИТИЧНО] Отсутствовал rate limiting на эндпоинтах аутентификации

**Файл:** `backend/src/routes/auth.js`  
**Проблема:** Эндпоинты `/register` и `/login` не ограничивали число запросов. Злоумышленник мог перебирать пароли (brute force) или спамить регистрациями без ограничений.

**Исправление:** Добавлен `express-rate-limit` — максимум **5 запросов** с одного IP за 15 минут на оба эндпоинта. В тестовом окружении (`NODE_ENV=test`) лимитер отключается через `skip`, чтобы не ломать тесты.

```js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  skip: () => process.env.NODE_ENV === 'test',
});
router.post('/login', authLimiter, validateLogin, ...);
router.post('/register', authLimiter, validateRegister, ...);
```

---

#### ✅ [ВАЖНО] Токены верификации попадали в production-логи

**Файл:** `backend/src/routes/auth.js`  
**Проблема:** При ошибке SMTP в лог писалась полная ссылка с токеном верификации, что раскрывало возможность подтвердить чужой email через log aggregator.

**Исправление:** `[DEV]`-логи обёрнуты в `if (!IS_PROD)`, а дублирующий inline-fallback `process.env.FRONTEND_URL || '...'` заменён на уже объявленную константу `FRONTEND_URL`.

```js
if (!IS_PROD) console.log(`[DEV] Ссылка подтверждения для ${email}: ${FRONTEND_URL}/verify-email?token=...`);
```

---

#### ✅ [ВАЖНО] Отсутствовали HTTP security headers

**Файл:** `backend/src/app.js`  
**Проблема:** Не было пакета `helmet` — браузер был уязвим к clickjacking и MIME-sniffing.

**Исправление:** Добавлен `helmet({ contentSecurityPolicy: false })` первым middleware, до `cors`.

---

#### ✅ [УМЕРЕННО] `findUserByEmail` возвращал хеш пароля

**Файл:** `backend/src/models/User.js`  
**Проблема:** Метод делал `SELECT *`, включая `password`, хотя большинство вызовов (регистрация, Google OAuth, forgot-password) хеш не используют.

**Исправление:** Добавлен отдельный метод `findUserForLogin(email)` — возвращает `SELECT *` для логина. `findUserByEmail` теперь исключает `password`. Маршрут логина переключён на `findUserForLogin`.

---

### 4.2 Архитектура

---

#### ✅ [ВАЖНО] Оценки ответов не сохранялись в базу данных

**Файлы:** `results/page.tsx`, `backend/src/routes/surveys.js`, `backend/src/models/Survey.js`  
**Проблема:** Звёздные оценки хранились только в `useState` — пропадали после перезагрузки.

**Исправление:**
- В таблицу `responses` добавлена колонка `rating INTEGER` (миграция для существующих баз)
- Новый эндпоинт `PATCH /api/surveys/:id/responses/:responseId/rating` (только автор, валидация 1–5)
- Frontend загружает оценки при открытии страницы и сохраняет при клике

---

#### ⏳ [ВАЖНО] Нет пагинации для списка анкет

**Файл:** `frontend/app/surveys/page.tsx`; `backend/src/routes/surveys.js`  
**Проблема:** `GET /api/surveys` возвращает все анкеты одним запросом. При росте числа анкет создаст нагрузку на БД.

**Рекомендация:** Добавить `?page=1&limit=20` и серверную пагинацию. Отложено — актуально при накоплении данных.

---

#### ✅ [УМЕРЕННО] Дублирование кода между `new/page.tsx` и `edit/page.tsx`

**Проблема:** ~70% кода (формы, логика вопросов, экран публикации) было продублировано между двумя страницами.

**Исправление:** Вынесен компонент `SurveyForm` (`frontend/components/SurveyForm.tsx`, 260 строк). Страницы стали тонкими обёртками: `new/page.tsx` — 45 строк, `edit/page.tsx` — 60 строк. Заодно устранён `let nextId = 1` в `edit/page.tsx`.

---

#### ✅ [УМЕРЕННО] Миграции БД замалчивали ошибки

**Файл:** `backend/src/config/database.js`  
**Проблема:** `ALTER TABLE ... ADD COLUMN` выполнялся с `.catch(() => {})` — любые ошибки (нет прав, таблица повреждена) проходили незамеченными.

**Исправление:**
- **SQLite:** перед `ALTER TABLE` проверяем через `PRAGMA table_info` — пропускаем если колонка уже есть, иначе выполняем без catch
- **PostgreSQL:** использует `IF NOT EXISTS` (идемпотентно) — лишний `.catch()` убран

---

#### ✅ [УМЕРЕННО] Нет явных настроек connection pool для PostgreSQL

**Файл:** `backend/src/config/database.js`  
**Проблема:** `pg.Pool` создавался без параметров — дефолтный `max=10` мог быть избыточным для VDS.

**Исправление:** Параметры пула берутся из переменных окружения с разумными дефолтами:

```js
new Pool({
  connectionString,
  max:                     Number(process.env.PG_POOL_MAX)                    || 5,
  idleTimeoutMillis:       Number(process.env.PG_POOL_IDLE_TIMEOUT_MS)        || 30_000,
  connectionTimeoutMillis: Number(process.env.PG_POOL_CONNECTION_TIMEOUT_MS)  || 5_000,
})
```

---

### 4.3 Читаемость

---

#### ✅ [НЕЗНАЧИТЕЛЬНО] Устаревший бренд "Auth Demo" в письмах

**Файл:** `backend/src/config/mailer.js`  
**Проблема:** Все письма приходили от `"Auth Demo"` вместо названия проекта.

**Исправление:** Имя отправителя берётся из `process.env.APP_NAME || 'Auth Demo'`. Достаточно добавить `APP_NAME=Survey-quizzes` в `.env`.

---

#### ✅ [НЕЗНАЧИТЕЛЬНО] Мутабельный счётчик на уровне модуля

**Файл:** `frontend/app/surveys/new/page.tsx` (и `edit/page.tsx`)  
**Проблема:** `let nextId = 1` — модульный мутабельный стейт, антипаттерн в React.

**Исправление:** Заменён на `function uid() { return crypto.randomUUID(); }` в компоненте `SurveyForm`.

---

#### ✅ [НЕЗНАЧИТЕЛЬНО] Дублирование fallback-значения `FRONTEND_URL`

**Файл:** `backend/src/routes/auth.js`  
**Проблема:** Константа `FRONTEND_URL` была объявлена вверху файла, но внутри `.catch()` заново писалось `process.env.FRONTEND_URL || 'http://localhost:3000'`.

**Исправление:** Все inline-вхождения заменены на константу `FRONTEND_URL`.

---

### 4.4 Тесты

---

#### ✅ [ВАЖНО] Логика сохранения оценок не покрыта тестами

**Файл:** `frontend/app/surveys/[id]/results/page.tsx`  
**Проблема:** Компонент `StarPicker` и вызов `surveyAPI.rateResponse` не имели тестов. После добавления персистентности это стало реальной бизнес-логикой.

**Исправление:** Добавлено 8 тестов для `ResultsPage` в `__tests__/app/surveys/[id]/results.page.test.tsx`: предзагрузка оценки, клик по звезде → вызов `rateResponse` с правильными аргументами, отображение «X из 5», снятие оценки повторным кликом, устойчивость к сетевой ошибке. Также заодно покрыты все остальные страницы фронтенда — добавлено 64 теста по 5 новым файлам (`surveys/page`, `surveys/new`, `surveys/[id]/edit`, `p/[uuid]`, `admin`).

---

#### ⏳ [УМЕРЕННО] Тесты используют SQLite, прод — PostgreSQL

**Файл:** `backend/src/__tests__/helpers/createTestDb.js`  
**Проблема:** Диалекты SQL различаются. Некоторые ошибки PostgreSQL (`error.code === '23505'`) не воспроизводятся в SQLite-тестах.

**Рекомендация:** Добавить CI-этап с реальным PostgreSQL через `services: postgres:` в GitHub Actions.

---

#### ⏳ [УМЕРЕННО] Нет E2E-тестов

**Проблема:** Happy path (регистрация → верификация → создание анкеты → ответ → результаты) не покрыт сквозными тестами. Регрессии в интеграции фронт+бэк обнаруживаются только вручную.

**Рекомендация:** Playwright или Cypress хотя бы для критического пути.

---

### 4.5 Документация

---

#### ✅ [ВАЖНО] Отсутствовал `.env.example`

**Проблема:** Новый разработчик не знал, какие переменные окружения нужны.

**Исправление:** Создан `backend/.env.example` со всеми ключами, комментариями и командой для генерации `JWT_SECRET`. Включены переменные для PG pool (`PG_POOL_MAX` и др.).

---

#### ⏳ [НЕЗНАЧИТЕЛЬНО] Swagger не описывает эндпоинты анкет

**Файл:** `backend/src/routes/surveys.js`  
**Проблема:** Swagger-аннотации есть только на auth-роутах. Эндпоинты `/api/surveys/*` не задокументированы.

**Рекомендация:** Добавить JSDoc-аннотации для всех survey-маршрутов.

---

## 5. Статус исправлений

| Приоритет | Проблема | Статус |
|-----------|----------|--------|
| 🔴 Высокий | Rate limiting на `/login` и `/register` | ✅ Готово |
| 🔴 Высокий | Токены в production-логах | ✅ Готово |
| 🔴 Высокий | `backend/.env.example` | ✅ Готово |
| 🟡 Средний | HTTP security headers (`helmet`) | ✅ Готово |
| 🟡 Средний | Оценки ответов в БД | ✅ Готово |
| 🟡 Средний | `findUserForLogin` — не передавать хеш пароля лишний раз | ✅ Готово |
| 🟡 Средний | Вынести `SurveyForm` — устранить дублирование | ✅ Готово |
| 🟡 Средний | Исправить миграции — не замалчивать ошибки | ✅ Готово |
| 🟡 Средний | PG connection pool из env | ✅ Готово |
| 🟡 Средний | Пагинация списка анкет | ⏳ Отложено |
| 🟢 Низкий | `APP_NAME` из env в письмах | ✅ Готово |
| 🟢 Низкий | `let nextId` → `crypto.randomUUID()` | ✅ Готово |
| 🟢 Низкий | Дедублировать `FRONTEND_URL` fallback | ✅ Готово |
| 🟢 Низкий | Тесты для `StarPicker` / `rateResponse` | ✅ Готово |
| 🟢 Низкий | PostgreSQL в CI (GitHub Actions) | ⏳ Открыто |
| 🟢 Низкий | E2E-тесты (Playwright) | ⏳ Открыто |
| 🟢 Низкий | Swagger на survey-роутах | ⏳ Открыто |

---

## 6. Итоговый вывод

Проект находится в **хорошем production-готовом состоянии**: работающий деплой на VDS с SSL, CI/CD через GitHub Actions, 230 тестов (114 backend + 116 frontend), продуманная архитектура с factory pattern и универсальным DB-адаптером.

**Сильные стороны:**
- Чистый factory pattern — тесты изолированы от типа БД
- Access + refresh token rotation — корректная JWT-стратегия
- Rate limiting, helmet, IS_PROD-guards — базовая безопасность закрыта
- Компонентная архитектура frontend (`AppLayout`, `SurveyForm`) без дублирования
- Реальный CI/CD с автоматическим деплоем

**Что осталось открытым (не критично):**
- Пагинация — нужна при накоплении данных, сейчас не горит
- E2E-тесты и PostgreSQL в CI — повышают уверенность в релизах
- Swagger на survey-роутах — удобно при интеграции с внешними клиентами

---

## 7. Список промптов, использованных при анализе

1. *«Объясни архитектуру этого проекта: какие паттерны использованы, как устроена аутентификация, как frontend взаимодействует с backend»*
2. *«Найди потенциальные проблемы безопасности в backend/src/routes/auth.js — особенно в эндпоинтах login и register»*
3. *«Проверь middleware/auth.js — есть ли уязвимости в JWT-верификации?»*
4. *«Какие архитектурные решения в backend/src/config/database.js могут вызвать проблемы при масштабировании?»*
5. *«Есть ли в frontend/app/surveys/new/page.tsx антипаттерны React? Обрати особое внимание на стейт-менеджмент»*
6. *«Посмотри на backend/src/models/User.js — есть ли проблемы с тем, какие данные возвращают методы?»*
7. *«Проанализируй тестовое покрытие: какие функции не покрыты тестами, и насколько это критично?»*
8. *«Что нужно задокументировать в первую очередь для нового разработчика, подключающегося к проекту?»*
9. *«Сгруппируй все найденные проблемы по типам: баги, архитектура, читаемость, тесты, документация»*
10. *«Оцени общее состояние проекта: что сделано хорошо, что является главными приоритетами для улучшения?»*
