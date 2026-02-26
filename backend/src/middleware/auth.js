const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function generateTempToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user', mfaPending: true },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}

module.exports = { authenticateToken, generateToken, generateTempToken, JWT_SECRET };
