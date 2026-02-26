const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt, generatePassword } = require('../utils/crypto');
const { sendNotification } = require('./settings');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    
    const db = req.db;
    const userId = req.user.id;
    const { search, category_id, folder_id } = req.query;

    let query = `
      SELECT p.*, c.name as category_name, f.name as folder_name, t.name as team_name,
        CASE WHEN p.user_id = ? THEN 0 ELSE 1 END as is_shared,
        u.username as owner_username
      FROM passwords p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN folders f ON p.folder_id = f.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE (p.user_id = ? 
          OR p.id IN (SELECT password_id FROM shared_passwords WHERE user_id = ?)
          OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?))
    `;
    const params = [userId, userId, userId, userId];

    if (search) {
      query += ` AND (p.title LIKE ? OR p.username LIKE ? OR p.url LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (category_id) {
      query += ` AND p.category_id = ?`;
      params.push(parseInt(category_id));
    }

    const folderId = folder_id;
    
    if (folderId && folderId !== '' && folderId !== 'null' && folderId !== 'undefined') {
      query += ` AND p.folder_id = ?`;
      params.push(parseInt(folderId));
    } else {
      query += ` AND p.folder_id IS NULL`;
    }

    query += ` ORDER BY is_shared ASC, p.created_at DESC`;

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
    const { title, username, password, url, folder_id, category_id, notes } = req.body;

    if (!title || !password) {
      return res.status(400).json({ error: 'Title and password are required' });
    }

    let teamId = null;
    if (folder_id) {
      const folder = db.prepare('SELECT team_id FROM folders WHERE id = ?').get(folder_id);
      if (folder && folder.team_id) {
        teamId = folder.team_id;
      }
    }

    const encryptedPassword = encrypt(password);
    
    const result = db.prepare(`
      INSERT INTO passwords (user_id, title, username, encrypted_password, url, folder_id, category_id, notes, team_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, title, username || null, encryptedPassword, url || null, folder_id || null, category_id || null, notes || null, teamId);

    sendNotification(db, userId, 'New Password Added', `A new password "${title}" was added to your vault.`, 'add');

    res.status(201).json({ 
      message: 'Password saved successfully',
      id: result.lastInsertRowid,
      title,
      username,
      password,
      url,
      folder_id,
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
    const { title, username, password, url, folder_id, category_id, notes } = req.body;

    const existing = db.prepare('SELECT * FROM passwords WHERE id = ? AND user_id = ?').get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Password not found' });
    }

    const encryptedPassword = password ? encrypt(password) : existing.encrypted_password;

    db.prepare(`
      UPDATE passwords 
      SET title = ?, username = ?, encrypted_password = ?, url = ?, folder_id = ?, category_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      title || existing.title,
      username !== undefined ? username : existing.username,
      encryptedPassword,
      url !== undefined ? url : existing.url,
      folder_id !== undefined ? folder_id : existing.folder_id,
      category_id !== undefined ? category_id : existing.category_id,
      notes !== undefined ? notes : existing.notes,
      id,
      userId
    );

    sendNotification(db, userId, 'Password Updated', `The password "${title || existing.title}" was updated.`, 'update');

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

    sendNotification(db, userId, 'Password Deleted', `A password was deleted from your vault.`, 'delete');

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
      SELECT p.*, c.name as category_name, f.name as folder_name
      FROM passwords p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN folders f ON p.folder_id = f.id
      WHERE p.user_id = ?
    `).all(userId);

    const exportData = passwords.map(p => ({
      title: p.title,
      username: p.username,
      password: decrypt(p.encrypted_password),
      url: p.url,
      folder: p.folder_name,
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
    let { passwords } = req.body;

    if (!passwords) {
      return res.status(400).json({ error: 'No passwords provided' });
    }

    let folderMap = {};
    
    if (passwords.folders && Array.isArray(passwords.folders)) {
      passwords.folders.forEach(folder => {
        if (folder.id && folder.name) {
          folderMap[folder.id] = folder.name;
        }
      });
    }

    if (passwords.items && Array.isArray(passwords.items)) {
      passwords = passwords.items.map(item => {
        let categoryName = null;
        if (item.folderId && folderMap[item.folderId]) {
          categoryName = folderMap[item.folderId];
        }
        return {
          title: item.name,
          username: item.login?.username || null,
          password: item.login?.password || '',
          url: item.login?.uris?.[0]?.uri || null,
          notes: item.notes || null,
          category: categoryName
        };
      });
    } else if (!Array.isArray(passwords)) {
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
      
      if (p.category && typeof p.category === 'string') {
        const catName = p.category.toLowerCase();
        if (categoryMap[catName]) {
          categoryId = categoryMap[catName];
        } else if (p.category) {
          const result = db.prepare('INSERT INTO categories (user_id, name) VALUES (?, ?)').run(userId, p.category);
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

router.post('/share/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { user_id } = req.body;

    const password = db.prepare('SELECT * FROM passwords WHERE id = ? AND user_id = ?').get(id, userId);
    if (!password) {
      return res.status(404).json({ error: 'Password not found or not owned by you' });
    }

    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare('INSERT OR IGNORE INTO shared_passwords (password_id, user_id) VALUES (?, ?)').run(id, user_id);

    res.json({ message: `Password shared with ${targetUser.username}` });
  } catch (error) {
    console.error('Share password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/share/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { user_id } = req.query;

    const password = db.prepare('SELECT * FROM passwords WHERE id = ? AND user_id = ?').get(id, userId);
    if (!password) {
      return res.status(404).json({ error: 'Password not found or not owned by you' });
    }

    db.prepare('DELETE FROM shared_passwords WHERE password_id = ? AND user_id = ?').run(id, user_id);

    res.json({ message: 'Share removed' });
  } catch (error) {
    console.error('Remove share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/shared/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const password = db.prepare('SELECT * FROM passwords WHERE id = ? AND user_id = ?').get(id, userId);
    if (!password) {
      return res.status(404).json({ error: 'Password not found or not owned by you' });
    }

    const shared = db.prepare(`
      SELECT u.id, u.username FROM users u
      JOIN shared_passwords sp ON sp.user_id = u.id
      WHERE sp.password_id = ?
    `).all(id);

    res.json(shared);
  } catch (error) {
    console.error('Get shared users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
