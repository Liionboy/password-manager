const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('./db');
const { createAuditLogger } = require('./middleware/audit');
const authRoutes = require('./routes/auth');
const passwordRoutes = require('./routes/passwords');
const cardRoutes = require('./routes/cards');
const settingsRoutes = require('./routes/settings');
const folderRoutes = require('./routes/folders');
const teamRoutes = require('./routes/teams');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.use(helmet());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

const db = new Database({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'passwordmanager',
  port: 5432
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const initDB = async (retries = 10) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Initializing database (attempt ${i + 1}/${retries})...`);
      
      // Test connection first
      await db.query('SELECT 1');
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' CHECK(role IN ('admin', 'user')),
        email VARCHAR(255),
        mfa_secret TEXT,
        mfa_enabled INTEGER DEFAULT 0,
        reset_token TEXT,
        reset_expires TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        encryption_salt TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(50) DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(team_id, user_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        parent_id INTEGER,
        team_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS passwords (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        encrypted_password TEXT NOT NULL,
        url TEXT,
        notes TEXT,
        category_id INTEGER,
        folder_id INTEGER,
        team_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS password_history (
        id SERIAL PRIMARY KEY,
        password_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        encrypted_password TEXT NOT NULL,
        url TEXT,
        notes TEXT,
        category_id INTEGER,
        folder_id INTEGER,
        version_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (password_id) REFERENCES passwords(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        cardholder_name VARCHAR(255),
        encrypted_card_number TEXT NOT NULL,
        expiry_month VARCHAR(10),
        expiry_year VARCHAR(10),
        cvv TEXT,
        brand VARCHAR(50),
        category_id INTEGER,
        folder_id INTEGER,
        team_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      )
    `);

    await db.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        name VARCHAR(255) NOT NULL,
        team_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      )
    `);

    await db.query(`ALTER TABLE categories ALTER COLUMN user_id DROP NOT NULL`).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        smtp_host VARCHAR(255),
        smtp_port INTEGER,
        smtp_user VARCHAR(255),
        smtp_password VARCHAR(255),
        smtp_from VARCHAR(255),
        notify_on_add INTEGER DEFAULT 0,
        notify_on_update INTEGER DEFAULT 0,
        notify_on_delete INTEGER DEFAULT 0,
        is_global INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS shared_passwords (
        id SERIAL PRIMARY KEY,
        password_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (password_id) REFERENCES passwords(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(password_id, user_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS shared_cards (
        id SERIAL PRIMARY KEY,
        card_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(card_id, user_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS refresh_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token_jti VARCHAR(128) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        ip_address VARCHAR(50),
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.query(`ALTER TABLE refresh_sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP`).catch(() => {});
    await db.query(`ALTER TABLE refresh_sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50)`).catch(() => {});
    await db.query(`ALTER TABLE refresh_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT`).catch(() => {});

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id ON refresh_sessions(user_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_sessions_token_jti ON refresh_sessions(token_jti);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);

    await db.query(`
      INSERT INTO settings (user_id, is_global) 
      VALUES (NULL, 1) 
      ON CONFLICT DO NOTHING
    `);

    const bcrypt = require('bcryptjs');
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    
    if (parseInt(userCount.rows[0].count) === 0) {
      const passwordHash = bcrypt.hashSync('admin', 10);
      await db.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        ['admin', passwordHash, 'admin']
      );
      console.log('Default admin user created: admin / admin');
    }

    console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error.message);
      if (i < retries - 1) {
        console.log(`Retrying in 3 seconds...`);
        await sleep(3000);
      } else {
        console.error('Failed to initialize database after all retries. Exiting...');
        process.exit(1);
      }
    }
  }
};

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use('/api', apiLimiter);

// Auth route tuning
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/forgot-password', sensitiveAuthLimiter);
app.use('/api/auth/reset-password', sensitiveAuthLimiter);
app.use('/api/auth/mfa/verify-temp', sensitiveAuthLimiter);

// Attach audit logger to all requests
app.use(createAuditLogger(db));

app.use('/api/auth', authRoutes);
app.use('/api/passwords', passwordRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/teams', teamRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
