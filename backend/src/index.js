const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const passwordRoutes = require('./routes/passwords');

const app = express();
const PORT = process.env.PORT || 5000;

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    username TEXT,
    encrypted_password TEXT NOT NULL,
    url TEXT,
    category_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );
`);

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/passwords', passwordRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
