// backend/src/middleware/adminAuth.js
const jwt = require('jsonwebtoken');

function adminAuth(req, res, next) {
  const token = req.cookies.adminToken;
  if (!token) {
    return res.status(401).json({ message: 'Требуется авторизация администратора' });
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Сессия администратора истекла' });
  }
}

module.exports = adminAuth;
