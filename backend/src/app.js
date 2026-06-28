// backend/src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');

const passport = require('passport');

const { initializeDatabase }      = require('./config/database');
const { configureGoogleStrategy } = require('./config/passport');
const swaggerSpec = require('./config/swagger');
const mailer = require('./config/mailer');

const { createUserModel }          = require('./models/User');
const { createRefreshTokenModel }  = require('./models/RefreshToken');
const { createPasswordResetModel } = require('./models/PasswordReset');
const { createPageViewModel }      = require('./models/PageView');

const { createAuthRouter }    = require('./routes/auth');
const { createProfileRouter } = require('./routes/profile');
const { createAdminRouter }   = require('./routes/admin');

const PORT = process.env.PORT || 3001;

/**
 * Фабрика приложения.
 * Принимает db-адаптер (любой объект с run/get/all/exec),
 * поэтому не привязана к конкретному типу БД.
 *
 * @param {{ run: Function, get: Function, all: Function }} db
 * @returns {import('express').Application}
 */
function createApp(db) {
  const userModel          = createUserModel(db);
  const refreshTokenModel  = createRefreshTokenModel(db);
  const passwordResetModel = createPasswordResetModel(db);
  const pageViewModel      = createPageViewModel(db);

  const app = express();

  // Google OAuth strategy (только если заданы переменные окружения)
  if (process.env.GOOGLE_CLIENT_ID) {
    configureGoogleStrategy(passport, userModel);
  }

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '16kb' }));
  app.use(passport.initialize());

  app.use('/api/auth',    createAuthRouter({ userModel, refreshTokenModel, passwordResetModel, mailer }));
  app.use('/api/profile', createProfileRouter({ userModel }));
  app.use('/api/admin',   createAdminRouter({ userModel, pageViewModel }));

  // Публичный трекинг посещений — без авторизации, ошибки игнорируются
  app.post('/api/track', async (req, res) => {
    const { path } = req.body ?? {};
    if (typeof path === 'string' && path.startsWith('/')) {
      pageViewModel.track(path.slice(0, 200)).catch(() => {});
    }
    res.status(204).end();
  });
  app.use('/api-docs',    swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get('/api/health', (_req, res) => res.json({ status: 'OK', message: 'Сервер работает' }));

  return app;
}

// Запуск сервера только при прямом вызове (не при require в тестах)
if (require.main === module) {
  initializeDatabase().then(db => {
    const app = createApp(db);
    app.listen(PORT, () => console.log(`🚀 Сервер запущен на http://localhost:${PORT}`));
  });
}

module.exports = { createApp };
