const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt, generatePassword } = require('../utils/crypto');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { search, category_id } = req.query;

    let query = `
      SELECT p.*, c.name as category_name 
      FROM passwords p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.user_id = ?
    `;
    const params = [userId];

    if (search) {
      query += ` AND (p.title LIKE ? OR p.username LIKE ? OR p.url LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (category_id) {
      query += ` AND p.category_id = ?`;
      params.push(category_id);
    }

    query += ` ORDER BY p.created_at DESC`;

    const passwords = db.prepare(query).all(...params);

    const decrypted = passwords.map(p => ({
      ...p,
      password: decrypt(p.encrypted_password)
    }));

    res.json(decrypted);
  } catch (error) {
    console.error('Get passwords error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { title, username, password, url, category_id, notes } = req.body;

    if (!title || !password) {
      return res.status(400).json({ error: 'Title and password are required' });
    }

    const encryptedPassword = encrypt(password);
    
    const result = db.prepare(`
      INSERT INTO passwords (user_id, title, username, encrypted_password, url, category_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, title, username || null, encryptedPassword, url || null, category_id || null, notes || null);

    res.status(201).json({ 
      message: 'Password saved successfully',
      id: result.lastInsertRowid,
      title,
      username,
      password,
      url,
      category_id,
      notes
    });
  } catch (error) {
    console.error('Create password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { title, username, password, url, category_id, notes } = req.body;

    const existing = db.prepare('SELECT * FROM passwords WHERE id = ? AND user_id = ?').get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Password not found' });
    }

    const encryptedPassword = password ? encrypt(password) : existing.encrypted_password;

    db.prepare(`
      UPDATE passwords 
      SET title = ?, username = ?, encrypted_password = ?, url = ?, category_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      title || existing.title,
      username !== undefined ? username : existing.username,
      encryptedPassword,
      url !== undefined ? url : existing.url,
      category_id !== undefined ? category_id : existing.category_id,
      notes !== undefined ? notes : existing.notes,
      id,
      userId
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM passwords WHERE id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Password not found' });
    }

    res.json({ message: 'Password deleted successfully' });
  } catch (error) {
    console.error('Delete password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/generate', (req, res) => {
  try {
    const { length = 16, uppercase = true, lowercase = true, numbers = true, symbols = true } = req.body;
    const password = generatePassword(length, { uppercase, lowercase, numbers, symbols });
    res.json({ password });
  } catch (error) {
    console.error('Generate password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/export', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;

    const passwords = db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM passwords p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.user_id = ?
    `).all(userId);

    const exportData = passwords.map(p => ({
      title: p.title,
      username: p.username,
      password: decrypt(p.encrypted_password),
      url: p.url,
      category: p.category_name,
      notes: p.notes,
      created_at: p.created_at,
      updated_at: p.updated_at
    }));

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/import', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { passwords } = req.body;

    if (!Array.isArray(passwords)) {
      return res.status(400).json({ error: 'Passwords must be an array' });
    }

    let categoryMap = {};
    const existingCategories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(userId);
    existingCategories.forEach(c => {
      categoryMap[c.name.toLowerCase()] = c.id;
    });

    const insertPassword = db.prepare(`
      INSERT INTO passwords (user_id, title, username, encrypted_password, url, category_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCategory = db.prepare(`
      INSERT INTO categories (user_id, name) VALUES (?, ?)
    `);

    let imported = 0;

    passwords.forEach(p => {
      let categoryId = null;
      
      if (p.category) {
        const catName = p.category.toLowerCase();
        if (categoryMap[catName]) {
          categoryId = categoryMap[catName];
        } else {
          const result = insertCategory.run(userId, p.category);
          categoryId = result.lastInsertRowid;
          categoryMap[catName] = categoryId;
        }
      }

      insertPassword.run(
        userId,
        p.title || 'Untitled',
        p.username || null,
        encrypt(p.password || ''),
        p.url || null,
        categoryId,
        p.notes || null
      );
      imported++;
    });

    res.json({ message: `Successfully imported ${imported} passwords` });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/categories', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;

    const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY name').all(userId);
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/categories', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const existing = db.prepare('SELECT * FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?)').get(userId, name);

    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const result = db.prepare('INSERT INTO categories (user_id, name) VALUES (?, ?)').run(userId, name);

    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/categories/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
