// backend/src/config/passport.js
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

/**
 * Регистрирует Google OAuth стратегию в переданном экземпляре passport.
 * Принимает userModel, чтобы не зависеть от глобального состояния БД.
 *
 * @param {import('passport').PassportStatic} passport
 * @param {ReturnType<import('../models/User').createUserModel>} userModel
 */
function configureGoogleStrategy(passport, userModel) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
        scope: ['email', 'profile'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email    = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error('Google не предоставил email адрес'));
          }

          // 1. Уже авторизовывался через Google
          let user = await userModel.findUserByGoogleId(googleId);
          if (user) return done(null, user);

          // 2. Зарегистрирован по email — привязываем Google-аккаунт
          //    (заодно подтверждаем email, если он ещё не подтверждён)
          user = await userModel.findUserByEmail(email);
          if (user) {
            await userModel.linkGoogleId(user.id, googleId);
            return done(null, user);
          }

          // 3. Новый пользователь — создаём
          const username = profile.displayName || email.split('@')[0];
          user = await userModel.createGoogleUser({ googleId, email, username });
          done(null, user);
        } catch (err) {
          done(err);
        }
      },
    ),
  );
}

module.exports = { configureGoogleStrategy };
