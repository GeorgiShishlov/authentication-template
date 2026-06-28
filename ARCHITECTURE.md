# Architecture — survey-quizzes

> Открыть превью: `Ctrl+Shift+V`. Все ссылки кликабельны — открывают файл на нужной строке.

---

## Содержание

- [Общая схема](#общая-схема)
- [Точка входа и DI](#точка-входа-и-di)
- [База данных](#база-данных)
- [Поток: Аутентификация](#поток-аутентификация)
- [Поток: JWT и middleware](#поток-jwt-и-middleware)
- [Поток: Опросы (CRUD + публичная ссылка)](#поток-опросы)
- [Поток: Квиз-шаблоны и scoring](#поток-квиз-шаблоны-и-scoring)
- [Фронтенд: страницы и компоненты](#фронтенд)
- [HTTP-клиент (api.ts)](#http-клиент)

---

## Общая схема

```
Browser
  │
  ├── Next.js 16 (App Router, :3000)
  │     ├── /                    → лендинг
  │     ├── /surveys             → личный кабинет
  │     ├── /templates           → библиотека шаблонов
  │     └── /p/[uuid]            → публичная страница квиза
  │
  └── Express API (:3001)
        ├── /api/auth/**         → регистрация, логин, OAuth
        ├── /api/profile/**      → профиль пользователя
        ├── /api/surveys/**      → CRUD опросов + результаты
        ├── /api/templates/**    → библиотека + клонирование
        └── /api-docs            → Swagger UI

БД: SQLite (dev) / PostgreSQL (prod)
```

---

## Точка входа и DI

**[backend/src/app.js](backend/src/app.js)**

| Строка | Что происходит |
|--------|----------------|
| [11](backend/src/app.js#L11) | `initializeDatabase()` — инициализация БД |
| [16](backend/src/app.js#L16) | `createUserModel(db)` — фабрика модели |
| [39](backend/src/app.js#L39) | `createApp(db)` — точка сборки приложения |
| [40–44](backend/src/app.js#L40) | DI: модели создаются из `db`-адаптера |
| [60](backend/src/app.js#L60) | Регистрация `/api/auth` роутера |
| [72](backend/src/app.js#L72) | Регистрация `/api/surveys` роутера |
| [73](backend/src/app.js#L73) | Регистрация `/api/templates` роутера |
| [83](backend/src/app.js#L83) | `initializeDatabase().then(...)` — старт сервера |

> **Паттерн:** все модели и роуты — фабричные функции, принимающие `db`. Тесты подставляют SQLite in-memory, прод — PostgreSQL.

---

## База данных

**[backend/src/config/database.js](backend/src/config/database.js)**

| Строка | Таблица / действие |
|--------|-------------------|
| [9](backend/src/config/database.js#L9) | `applySchema()` — создание всех таблиц (SQLite) |
| [11](backend/src/config/database.js#L11) | `users` — id, email, username, password_hash, google_id |
| [24](backend/src/config/database.js#L24) | `refresh_tokens` |
| [33](backend/src/config/database.js#L33) | `password_reset_tokens` |
| [50](backend/src/config/database.js#L50) | `surveys` — scoring_type, public_uuid |
| [65](backend/src/config/database.js#L65) | `questions` |
| [76](backend/src/config/database.js#L76) | `choices` — scores_json, score (для квизов) |
| [86](backend/src/config/database.js#L86) | `responses` — result_key, rating |
| [97](backend/src/config/database.js#L97) | `answers` |
| [118](backend/src/config/database.js#L118) | `survey_results` — title, subtitle, description, min/max score |
| [132](backend/src/config/database.js#L132) | `quiz_templates` |
| [145](backend/src/config/database.js#L145) | `template_questions` |
| [155](backend/src/config/database.js#L155) | `template_choices` |
| [167](backend/src/config/database.js#L167) | `template_results` |
| [267](backend/src/config/database.js#L267) | `applySchemaPostgres()` — то же для PostgreSQL |

### Схема связей (упрощённо)

```
users
  └── surveys (user_id)
        ├── questions (survey_id)
        │     └── choices (question_id) ← scores_json / score
        ├── survey_results (survey_id)  ← result_key, title, subtitle, description
        └── responses (survey_id)
              ├── result_key → survey_results
              └── answers (response_id, question_id, choice_id)

quiz_templates
  ├── template_questions (template_id)
  │     └── template_choices (question_id) ← scores_json / score
  └── template_results (template_id)
```

---

## Поток: Аутентификация

### Регистрация

```
POST /api/auth/register
  │
  ├── [routes/auth.js:78](backend/src/routes/auth.js#L78)   validateRegister middleware
  ├── [models/User.js:14](backend/src/models/User.js#L14)   createUser() — bcrypt hash
  └── → письмо с verify-token на email  [routes/auth.js:120](backend/src/routes/auth.js#L120)
```

### Верификация email

```
GET /api/auth/verify-email?token=...
  └── [routes/auth.js:120](backend/src/routes/auth.js#L120)  markEmailVerified()
```

### Логин

```
POST /api/auth/login
  │
  ├── [routes/auth.js:155](backend/src/routes/auth.js#L155)  validateLogin middleware
  ├── [models/User.js:25](backend/src/models/User.js#L25)    findUserByEmail()
  ├── [models/User.js:43](backend/src/models/User.js#L43)    verifyPassword() — bcrypt.compare
  ├── → JWT access token (15 мин)  httpOnly cookie `token`
  └── → refresh token (30 дней)   httpOnly cookie `refreshToken`
```

### Обновление токена

```
POST /api/auth/refresh
  └── [routes/auth.js:194](backend/src/routes/auth.js#L194)
        ├── проверяет refreshToken из cookie
        ├── ищет в таблице refresh_tokens
        └── выдаёт новый access token
```

### Сброс пароля

```
POST /api/auth/forgot-password  [routes/auth.js:250](backend/src/routes/auth.js#L250)
  └── → письмо со ссылкой

POST /api/auth/reset-password   [routes/auth.js:287](backend/src/routes/auth.js#L287)
  └── [models/User.js:58](backend/src/models/User.js#L58)  updatePassword() — новый bcrypt hash
```

### Google OAuth

```
GET /api/auth/google            [routes/auth.js:330](backend/src/routes/auth.js#L330)
  └── [config/passport.js](backend/src/config/passport.js)  GoogleStrategy
        ├── [models/User.js:69](backend/src/models/User.js#L69)  findUserByGoogleId()
        ├── [models/User.js:78](backend/src/models/User.js#L78)  createGoogleUser() если новый
        └── [models/User.js:92](backend/src/models/User.js#L92)  linkGoogleId() если email уже есть

GET /api/auth/google/callback   [routes/auth.js:345](backend/src/routes/auth.js#L345)
  └── → устанавливает JWT cookie → редирект на /surveys
```

---

## Поток: JWT и middleware

**[backend/src/middleware/auth.js](backend/src/middleware/auth.js)**

```
Каждый защищённый запрос:
  │
  ├── [auth.js:6](backend/src/middleware/auth.js#L6)   токен из cookie `token` ИЛИ заголовка Authorization
  ├── [auth.js:13](backend/src/middleware/auth.js#L13)  jwt.verify(token, JWT_SECRET)
  └── [auth.js:14](backend/src/middleware/auth.js#L14)  req.userId = decoded.userId  → дальше в роут
```

**Авто-рефреш на фронтенде:**

```
[frontend/lib/api.ts:4](frontend/lib/api.ts#L4)   apiCall() — обёртка над fetch
  └── [api.ts:16](frontend/lib/api.ts#L16)  если 401 → POST /auth/refresh → повтор запроса
```

---

## Поток: Опросы

**[backend/src/routes/surveys.js](backend/src/routes/surveys.js)** · **[backend/src/models/Survey.js](backend/src/models/Survey.js)**

### CRUD (требует авторизации)

| Маршрут | Строка | Модель |
|---------|--------|--------|
| `GET /api/surveys` | [surveys.js:10](backend/src/routes/surveys.js#L10) | [Survey.js:18](backend/src/models/Survey.js#L18) `getSurveysByUser` |
| `POST /api/surveys` | [surveys.js:34](backend/src/routes/surveys.js#L34) | [Survey.js:7](backend/src/models/Survey.js#L7) `createSurvey` |
| `PUT /api/surveys/:id` | [surveys.js:83](backend/src/routes/surveys.js#L83) | [Survey.js:42](backend/src/models/Survey.js#L42) `updateSurvey` |
| `PATCH /api/surveys/:id/publish` | [surveys.js:125](backend/src/routes/surveys.js#L125) | [Survey.js:50](backend/src/models/Survey.js#L50) `publishSurvey` |
| `DELETE /api/surveys/:id` | [surveys.js:144](backend/src/routes/surveys.js#L144) | [Survey.js:64](backend/src/models/Survey.js#L64) `deleteSurvey` |
| `GET /api/surveys/:id/results` | [surveys.js:180](backend/src/routes/surveys.js#L180) | [Survey.js:240](backend/src/models/Survey.js#L240) `getResults` |

### Публичное прохождение (без авторизации)

```
GET  /api/surveys/public/:uuid      [surveys.js:196](backend/src/routes/surveys.js#L196)
  └── [Survey.js:137](backend/src/models/Survey.js#L137)  getFullSurveyByPublicUuid()

POST /api/surveys/public/:uuid/submit  [surveys.js:209](backend/src/routes/surveys.js#L209)
  ├── [Survey.js:215](backend/src/models/Survey.js#L215)  submitResponse()
  ├── [Survey.js:157](backend/src/models/Survey.js#L157)  computeResult()  ← scoring engine
  └── → { responseId, result: { title, subtitle, description } }
```

---

## Поток: Квиз-шаблоны и scoring

### Библиотека шаблонов

**[backend/src/routes/templates.js](backend/src/routes/templates.js)** · **[backend/src/models/Template.js](backend/src/models/Template.js)**

```
GET  /api/templates         [templates.js:7](backend/src/routes/templates.js#L7)
  └── [Template.js:5](backend/src/models/Template.js#L5)  getAll()

POST /api/templates/:id/use [templates.js:17](backend/src/routes/templates.js#L17)  (auth required)
  └── [Template.js:46](backend/src/models/Template.js#L46)  cloneToSurvey(templateId, userId)
        ├── копирует questions + choices (scores_json, score)
        ├── копирует template_results → survey_results
        └── → { surveyId, publicUuid, publicUrl }
```

### Данные шаблонов

- **[backend/src/data/quiz_templates.json](backend/src/data/quiz_templates.json)** — 30 шаблонов (4 партии)
- **[backend/seed-templates.js](backend/seed-templates.js)** — идемпотентный сидер (запускается в CI)

### Scoring engine

**[backend/src/models/Survey.js:157](backend/src/models/Survey.js#L157)** — `computeResult(surveyId, answers)`

```
scoring_type = "max"
  │  каждый ответ добавляет 1 в scores[result_key]
  └── победитель = ключ с максимальной суммой

scoring_type = "sum_thresholds"
  │  каждый ответ имеет числовой score
  └── сумма → попадает в диапазон survey_results (min_score..max_score)
```

---

## Фронтенд

### Страницы

| Страница | Файл | Назначение |
|----------|------|-----------|
| Лендинг | [app/page.tsx](frontend/app/page.tsx) | Главная, Auth Modal |
| Мои анкеты | [app/surveys/page.tsx](frontend/app/surveys/page.tsx) | Список опросов пользователя |
| Создать | [app/surveys/new/page.tsx](frontend/app/surveys/new/page.tsx) | Конструктор анкеты |
| Редактировать | [app/surveys/[id]/edit/page.tsx](frontend/app/surveys/[id]/edit/page.tsx) | Редактор |
| Результаты | [app/surveys/[id]/results/page.tsx](frontend/app/surveys/[id]/results/page.tsx) | Аккордеон ответов + результат квиза |
| Публичная | [app/p/[uuid]/page.tsx](frontend/app/p/[uuid]/page.tsx) | Прохождение + экран результата |
| Шаблоны | [app/templates/page.tsx](frontend/app/templates/page.tsx) | Библиотека 30 тестов |
| Профиль | [app/profile/page.tsx](frontend/app/profile/page.tsx) | Настройки аккаунта |

### Ключевые компоненты

| Компонент | Файл | Что делает |
|-----------|------|-----------|
| `AuthModal` | [components/AuthModal.tsx:50](frontend/components/AuthModal.tsx#L50) | Форма логина/регистрации |
| `AppLayout` | [components/AppLayout.tsx:26](frontend/components/AppLayout.tsx#L26) | Шапка + навигация (NAV на [строке 14](frontend/components/AppLayout.tsx#L14)) |
| `SurveyForm` | [components/SurveyForm.tsx](frontend/components/SurveyForm.tsx) | Конструктор вопросов |
| `ThemeProvider` | [components/ThemeProvider.tsx](frontend/components/ThemeProvider.tsx) | dark/light тема |

### Экран результата квиза (публичная страница)

```
[app/p/[uuid]/page.tsx:75](frontend/app/p/[uuid]/page.tsx#L75)  handleSubmit()
  └── surveyAPI.submit() → data.result
        └── если result → показывает карточку с title + subtitle + description
```

---

## HTTP-клиент

**[frontend/lib/api.ts](frontend/lib/api.ts)**

| Строка | Что |
|--------|-----|
| [4](frontend/lib/api.ts#L4) | `apiCall()` — базовая обёртка, `credentials: 'include'` |
| [16](frontend/lib/api.ts#L16) | авто-рефреш при 401 |
| [44](frontend/lib/api.ts#L44) | `surveyAPI` — все методы работы с опросами |
| [75](frontend/lib/api.ts#L75) | `templatesAPI` — list, use |
| [80](frontend/lib/api.ts#L80) | `authAPI` — register, login, logout, refresh, profile |

---

## CI/CD

**[.github/workflows/ci.yml](.github/workflows/ci.yml)**

```
push → main
  ├── backend tests (Jest + Supertest)
  ├── docker build → push to Docker Hub
  ├── SSH deploy → docker-compose up -d
  └── docker exec app_backend_1 node seed-templates.js
```
