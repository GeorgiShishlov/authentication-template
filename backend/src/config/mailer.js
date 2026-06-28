// backend/src/config/mailer.js
const nodemailer = require('nodemailer');

const APP_NAME = process.env.APP_NAME || 'Auth Demo';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'true', // true для порта 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendVerificationEmail(email, token) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: 'Подтвердите email',
    html: `
      <p>Для завершения регистрации перейдите по ссылке:</p>
      <p><a href="${url}">${url}</a></p>
      <p>Ссылка действительна до тех пор, пока вы не подтвердите адрес.</p>
    `,
  });
}

async function sendPasswordResetEmail(email, token) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: 'Сброс пароля',
    html: `
      <p>Вы запросили сброс пароля.</p>
      <p>Перейдите по ссылке для установки нового пароля (действительна 1 час):</p>
      <p><a href="${url}">${url}</a></p>
      <p>Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>
    `,
  });
}

async function sendPasswordChangedEmail(email) {
  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: 'Пароль изменён',
    html: `
      <p>Пароль от вашего аккаунта был успешно изменён.</p>
      <p>Если это были не вы — немедленно свяжитесь с поддержкой.</p>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail };
