const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.REFRESH_EXPIRY || '7d';

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
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', expired: true });
      }
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id, username: user.username },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );
  
  return { accessToken, refreshToken, expiresIn: JWT_EXPIRY };
}

function generateTempToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user', mfaPending: true },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}

async function refreshAccessToken(refreshToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(refreshToken, REFRESH_SECRET, (err, user) => {
      if (err) {
        reject(new Error('Invalid refresh token'));
      } else {
        const newAccessToken = jwt.sign(
          { id: user.id, username: user.username, role: user.role || 'user' },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        resolve({ accessToken: newAccessToken, expiresIn: JWT_EXPIRY });
      }
    });
  });
}

module.exports = { 
  authenticateToken, 
  generateTokens, 
  generateTempToken, 
  refreshAccessToken,
  JWT_SECRET 
};
