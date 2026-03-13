const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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

async function persistRefreshSession(db, userId, jti, expiresIn) {
  if (!db) return;
  await db.query(
    `INSERT INTO refresh_sessions (user_id, token_jti, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)`,
    [userId, jti, String(expiresIn)]
  );
}

function refreshExpiryToSeconds(expiry) {
  if (typeof expiry === 'number') return expiry;
  const m = String(expiry).match(/^(\d+)([smhd])$/i);
  if (!m) return 7 * 24 * 60 * 60;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u === 's') return n;
  if (u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  return n * 86400;
}

async function generateTokens(user, db) {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const jti = crypto.randomUUID();
  
  const refreshToken = jwt.sign(
    { id: user.id, username: user.username, jti },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );

  await persistRefreshSession(db, user.id, jti, refreshExpiryToSeconds(REFRESH_EXPIRY));
  
  return { accessToken, refreshToken, expiresIn: JWT_EXPIRY };
}

function generateTempToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user', mfaPending: true },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}

async function refreshAccessToken(refreshToken, db) {
  return new Promise((resolve, reject) => {
    jwt.verify(refreshToken, REFRESH_SECRET, async (err, user) => {
      if (err) {
        reject(new Error('Invalid refresh token'));
      } else {
        try {
          if (!user.jti) return reject(new Error('Invalid refresh token'));

          const session = await db.query(
            `SELECT id FROM refresh_sessions
             WHERE user_id = $1 AND token_jti = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
            [user.id, user.jti]
          );

          if (session.rows.length === 0) return reject(new Error('Invalid refresh token'));

          await db.query('UPDATE refresh_sessions SET revoked_at = NOW() WHERE token_jti = $1', [user.jti]);

          const userRes = await db.query('SELECT id, username, role FROM users WHERE id = $1', [user.id]);
          if (userRes.rows.length === 0) return reject(new Error('Invalid refresh token'));

          const dbUser = userRes.rows[0];
          const tokens = await generateTokens({ id: dbUser.id, username: dbUser.username, role: dbUser.role || 'user' }, db);
          resolve(tokens);
        } catch (e) {
          reject(new Error('Invalid refresh token'));
        }
      }
    });
  });
}

async function revokeAllRefreshSessions(userId, db) {
  await db.query('UPDATE refresh_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

module.exports = { 
  authenticateToken, 
  generateTokens, 
  generateTempToken, 
  refreshAccessToken,
  revokeAllRefreshSessions,
  JWT_SECRET 
};
