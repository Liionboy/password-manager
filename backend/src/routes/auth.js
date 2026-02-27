const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, generateTokens, generateTempToken, refreshAccessToken } = require('../middleware/auth');
const { AuditActions } = require('../middleware/audit');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const body = req.body || {};
    const { username, password } = body;

    console.log('Register request body:', JSON.stringify(body));

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const strengthScore = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length;
    
    if (strengthScore < 3) {
      return res.status(400).json({ error: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters' });
    }

    const db = req.db;
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    // First user becomes admin ONLY if ALLOW_FIRST_ADMIN is explicitly set
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    const allowFirstAdmin = process.env.ALLOW_FIRST_ADMIN === 'true';
    const isFirstUser = parseInt(userCount.rows[0].count) === 0;
    const role = (isFirstUser && allowFirstAdmin) ? 'admin' : 'user';
    
    const result = await db.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id', [username, passwordHash, role]);

    const tokens = generateTokens({ id: result.rows[0].id, username, role });
    
    // Log audit
    await req.audit(AuditActions.USER_CREATED, { 
      resource: `user:${result.rows[0].id}`,
      username,
      role 
    });

    res.status(201).json({ 
      message: 'User created successfully', 
      ...tokens,
      userId: result.rows[0].id, 
      username, 
      role 
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const body = req.body || {};
    const { username, password } = body;

    console.log('Login request body:', JSON.stringify(body));

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required', received: body });
    }

    const db = req.db;
    const userResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${remainingMinutes} minutes` });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await db.query('UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3', [attempts, lockUntil.toISOString(), user.id]);
        await req.audit(AuditActions.ACCOUNT_LOCKED, { 
          resource: `user:${user.id}`,
          username,
          attempts 
        });
        return res.status(423).json({ error: 'Too many failed attempts. Account locked for 15 minutes' });
      }
      await db.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, user.id]);
      await req.audit(AuditActions.LOGIN_FAILED, { 
        resource: `user:${user.id}`,
        username,
        attempts,
        reason: 'invalid_password'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    
    await req.audit(AuditActions.LOGIN_SUCCESS, { 
      resource: `user:${user.id}`,
      username 
    });

    if (user.mfa_enabled && user.mfa_secret) {
      return res.json({ 
        mfaRequired: true, 
        tempToken: generateTempToken(user) 
      });
    }

    const tokens = generateTokens(user);

    res.json({ 
      message: 'Login successful', 
      ...tokens,
      userId: user.id, 
      username: user.username, 
      role: user.role 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/verify-temp', async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Temp token and code are required' });
    }

    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');

    const decoded = jwt.verify(tempToken, JWT_SECRET);

    const db = req.db;
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = userResult.rows[0];

    if (!user || !user.mfa_secret) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid MFA code' });
    }

    const tokens = generateTokens(user);
    res.json({ 
      message: 'Login successful', 
      ...tokens,
      userId: user.id, 
      username: user.username, 
      role: user.role 
    });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const db = req.db;
    const users = await db.query('SELECT id, username, role, created_at, failed_login_attempts, locked_until FROM users ORDER BY created_at DESC');
    res.json(users.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { username, password, role = 'user' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = req.db;
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role', [username, passwordHash, role]);

    res.status(201).json({ id: result.rows[0].id, username: result.rows[0].username, role: result.rows[0].role });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { role } = req.body;
    
    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const db = req.db;
    const result = await db.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role', [role, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ id: result.rows[0].id, username: result.rows[0].username, role: result.rows[0].role });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/:id/reset-password', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const db = req.db;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await db.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, username', [passwordHash, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const db = req.db;
    const result = await db.query('DELETE FROM users WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/:id/unlock', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const db = req.db;
    
    const result = await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User unlocked successfully' });
  } catch (error) {
    console.error('Unlock user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, password } = req.body;

    const db = req.db;

    if (email !== undefined) {
      await db.query('UPDATE users SET email = $1 WHERE id = $2', [email || null, userId]);
    }

    if (password) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync(password, 10);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = req.db;
    const user = await db.query('SELECT id, username, role, email, mfa_enabled FROM users WHERE id = $1', [req.user.id]);
    res.json(user.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/setup', authenticateToken, async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;

    const speakeasy = require('speakeasy');
    const qrcode = require('qrcode');

    const secret = speakeasy.generateSecret({ name: `PasswordManager-${userId}` });

    await db.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret.base32, userId]);

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/enable', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const db = req.db;
    const userResult = await db.query('SELECT mfa_secret FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    if (!user || !user.mfa_secret) {
      return res.status(400).json({ error: 'MFA not set up' });
    }

    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    await db.query('UPDATE users SET mfa_enabled = 1 WHERE id = $1', [userId]);

    res.json({ message: 'MFA enabled successfully' });
  } catch (error) {
    console.error('MFA enable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/disable', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const db = req.db;
    const userResult = await db.query('SELECT mfa_secret FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    if (!user || !user.mfa_secret) {
      return res.status(400).json({ error: 'MFA not enabled' });
    }

    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    await db.query('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = $1', [userId]);

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const tokens = await refreshAccessToken(refreshToken);
    
    // Decode token to get user info for audit
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(refreshToken);
    if (decoded && decoded.id) {
      await req.audit(AuditActions.TOKEN_REFRESHED, { 
        resource: `user:${decoded.id}` 
      });
    }
    
    res.json(tokens);
  } catch (error) {
    console.error('Refresh token error:', error.message);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  // Log audit
  await req.audit(AuditActions.LOGOUT, { 
    resource: `user:${req.user.id}`,
    username: req.user.username 
  });
  
  // In a production setup, you could add the refresh token to a blacklist
  // For now, the client just needs to discard both tokens
  res.json({ message: 'Logged out successfully' });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const db = req.db;
    const userResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userResult.rows[0];

    if (!user || !user.email) {
      return res.json({ message: 'If the username exists, a reset email will be sent' });
    }

    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await db.query('UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3', [resetToken, resetExpires.toISOString(), user.id]);

    const { sendNotification } = require('./settings');
    const resetLink = `https://password.homelocal.work/reset-password?token=${resetToken}&username=${username}`;
    await sendNotification(db, user.id, 'Password Reset', resetLink, 'reset');

    res.json({ message: 'If the username exists, a reset email will be sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { username, token, newPassword } = req.body;
    
    if (!username || !token || !newPassword) {
      return res.status(400).json({ error: 'Username, token, and new password are required' });
    }

    const db = req.db;
    const userResult = await db.query('SELECT * FROM users WHERE username = $1 AND reset_token = $2', [username, token]);
    const user = userResult.rows[0];
    
    if (!user || !user.reset_expires || new Date(user.reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2', [passwordHash, user.id]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
