const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again later.' }
});

app.use(generalLimiter);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'passwords.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    email TEXT,
    mfa_secret TEXT,
    mfa_enabled INTEGER DEFAULT 0,
    reset_token TEXT,
    reset_expires DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    username TEXT,
    encrypted_password TEXT NOT NULL,
    url TEXT,
    notes TEXT,
    category_id INTEGER,
    folder_id INTEGER,
    team_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    cardholder_name TEXT,
    encrypted_card_number TEXT NOT NULL,
    expiry_month TEXT,
    expiry_year TEXT,
    cvv TEXT,
    brand TEXT,
    category_id INTEGER,
    folder_id INTEGER,
    team_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    parent_id INTEGER,
    team_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_password TEXT,
    smtp_from TEXT,
    notify_on_add INTEGER DEFAULT 0,
    notify_on_update INTEGER DEFAULT 0,
    notify_on_delete INTEGER DEFAULT 0,
    is_global INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

try {
  db.exec('ALTER TABLE settings ADD COLUMN smtp_password TEXT');
} catch (e) {}
try {
  db.exec('ALTER TABLE settings ADD COLUMN notify_on_add INTEGER DEFAULT 0');
} catch (e) {}
try {
  db.exec('ALTER TABLE settings ADD COLUMN notify_on_update INTEGER DEFAULT 0');
} catch (e) {}
try {
  db.exec('ALTER TABLE settings ADD COLUMN notify_on_delete INTEGER DEFAULT 0');
} catch (e) {}
try {
  db.exec('ALTER TABLE passwords ADD COLUMN encrypted_password TEXT');
} catch (e) {}
try {
  db.exec('ALTER TABLE cards ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL');
} catch (e) {}

try {
  db.exec('ALTER TABLE passwords ADD COLUMN updated_at DATETIME');
} catch (e) {}
try {
  db.exec('ALTER TABLE cards ADD COLUMN updated_at DATETIME');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0');
} catch (e) {}
try {
  db.exec('ALTER TABLE users ADD COLUMN locked_until DATETIME');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN role TEXT DEFAULT \'user\'');
} catch (e) {}

try {
  db.exec('ALTER TABLE passwords ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL');
} catch (e) {}

try {
  db.exec('ALTER TABLE cards ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL');
} catch (e) {}

try {
  db.exec('ALTER TABLE passwords ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL');
} catch (e) {}

try {
  db.exec('ALTER TABLE cards ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL');
} catch (e) {}

try {
  db.exec('ALTER TABLE folders ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL');
} catch (e) {}

try {
  db.exec('INSERT OR IGNORE INTO settings (user_id, is_global) VALUES (NULL, 1)');
} catch (e) {}

const bcrypt = require('bcryptjs');
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const passwordHash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', passwordHash, 'admin');
  console.log('Default admin user created: admin / admin');
}

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/passwords', passwordRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/teams', teamRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
