const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, generateToken, generateTempToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const body = req.body || {};
    const { username, password } = body;

    console.log('Register request body:', JSON.stringify(body));

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const db = req.db;
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const role = userCount.count === 0 ? 'admin' : 'user';
    
    const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, passwordHash, role);

    const token = generateToken({ id: result.lastInsertRowid, username, role });

    res.status(201).json({ message: 'User created successfully', token, userId: result.lastInsertRowid, username, role });
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
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.mfa_enabled && user.mfa_secret) {
      return res.json({ 
        mfaRequired: true, 
        tempToken: generateTempToken(user) 
      });
    }

    const token = generateToken(user);

    res.json({ message: 'Login successful', token, userId: user.id, username: user.username, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

router.get('/users', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const db = req.db;
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
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

    const db = req.db;
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, passwordHash, role);

    res.status(201).json({ message: 'User created', id: result.lastInsertRowid, username, role });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/users/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { role, password, email } = req.body;
    const db = req.db;

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (role) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    }

    if (password) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, id);
    }

    if (email !== undefined) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, id);
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const db = req.db;
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', authenticateToken, (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { email, password } = req.body;

    if (email !== undefined) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, userId);
    }

    if (password) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = req.db;
    const user = db.prepare('SELECT id, username, role, email, mfa_enabled FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/setup', authenticateToken, (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);

    const speakeasy = require('speakeasy');
    const QRCode = require('qrcode');

    const secret = speakeasy.generateSecret({
      name: `PasswordManager (${user.username})`,
      issuer: 'PasswordManager'
    });

    db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?').run(secret.base32, userId);

    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to generate QR code' });
      }
      res.json({
        secret: secret.base32,
        qrCode: data_url
      });
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/enable', authenticateToken, (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { code } = req.body;

    const user = db.prepare('SELECT mfa_secret FROM users WHERE id = ?').get(userId);
    
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
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').run(userId);
    res.json({ message: 'MFA enabled successfully' });
  } catch (error) {
    console.error('MFA enable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/disable', authenticateToken, (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { code } = req.body;

    const user = db.prepare('SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?').get(userId);
    
    if (!user || !user.mfa_enabled) {
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
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    db.prepare('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?').run(userId);
    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/verify', (req, res) => {
  try {
    const db = req.db;
    const { username, password, mfa_code } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const bcrypt = require('bcryptjs');
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.mfa_enabled || !user.mfa_secret) {
      return res.json({ mfaRequired: false });
    }

    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: mfa_code,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid MFA code', mfaRequired: true });
    }

    const token = generateToken(user);
    res.json({ token, role: user.role, username: user.username });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/verify-temp', authenticateToken, (req, res) => {
  try {
    if (!req.user.mfaPending) {
      return res.status(400).json({ error: 'No MFA verification pending' });
    }

    const db = req.db;
    const userId = req.user.id;
    const { code } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    
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
      return res.status(400).json({ error: 'Invalid MFA code' });
    }

    const token = generateToken(user);
    res.json({ token, role: user.role, username: user.username, message: 'Login successful' });
  } catch (error) {
    console.error('MFA verify temp error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const db = req.db;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.json({ message: 'If the user exists, a recovery email has been sent' });
    }

    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000).toISOString();

    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(resetToken, resetExpires, user.id);

    let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(user.id);
    if (!settings || !settings.smtp_host) {
      settings = db.prepare('SELECT * FROM settings WHERE is_global = 1').get();
    }

    if (settings && settings.smtp_host && user.email) {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port,
        secure: settings.smtp_port === 465,
        tls: { rejectUnauthorized: false },
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_password
        }
      });

      const resetLink = `https://password.homelocal.work/reset-password?token=${resetToken}&username=${username}`;

      await transporter.sendMail({
        from: settings.smtp_from,
        to: user.email,
        subject: 'Password Manager - Password Recovery',
        html: `
          <h2>Password Recovery</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>This link expires in 1 hour.</p>
        `
      });
    }

    res.json({ message: 'If the user exists and has an email, a recovery email has been sent' });
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
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND reset_token = ? AND reset_expires > datetime("now")').get(username, token);
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(passwordHash, user.id);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
