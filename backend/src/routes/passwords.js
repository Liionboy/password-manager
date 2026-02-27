const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt, generatePassword } = require('../utils/crypto');
const { sendNotification } = require('./settings');
const { requireEncryptionKey } = require('../middleware/encryption-key');

const router = express.Router();

router.use(authenticateToken);

// Optional: uncomment to enable per-user encryption
// router.use(requireEncryptionKey);

router.get('/', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    
    const db = req.db;
    const userId = req.user.id;
    const { search, category_id, folder_id, all } = req.query;

    let query = `
      SELECT p.*, c.name as category_name, f.name as folder_name, t.name as team_name,
        CASE WHEN p.user_id = $1 THEN 0 ELSE 1 END as is_shared,
        u.username as owner_username
      FROM passwords p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN folders f ON p.folder_id = f.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE (p.user_id = $1 
          OR p.id IN (SELECT password_id FROM shared_passwords WHERE user_id = $1)
          OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
          OR u.id IN (SELECT user_id FROM team_members WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)))
    `;
    const params = [userId];

    if (search) {
      query += ` AND (p.title LIKE $${params.length + 1} OR p.username LIKE $${params.length + 1} OR p.url LIKE $${params.length + 1})`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm);
    }

    if (category_id) {
      query += ` AND p.category_id = $${params.length + 1}`;
      params.push(parseInt(category_id));
    }

    const folderId = folder_id;
    const showAll = all === 'true' || all === true;
    const showSpecificFolder = folderId && folderId !== '' && folderId !== 'null' && folderId !== 'undefined';
    
    if (showSpecificFolder) {
      query += ` AND p.folder_id = $${params.length + 1}`;
      params.push(parseInt(folderId));
    } else if (!showAll && !category_id) {
      // Show passwords without folder (All Items view)
      query += ` AND p.folder_id IS NULL`;
    }

    query += ` ORDER BY is_shared ASC, p.created_at DESC`;

    const passwords = await db.prepare(query).all(...params);

    const decrypted = passwords.map(p => {
      // Try per-user decryption first, fall back to legacy
      try {
        if (req.encryptionKey) {
          return { ...p, password: decrypt(p.encrypted_password, req.encryptionKey) };
        }
        return { ...p, password: decrypt(p.encrypted_password) };
      } catch (e) {
        console.error('Decryption error for password', p.id, e.message);
        return { ...p, password: '[DECRYPTION_FAILED]' };
      }
    });

    res.json(decrypted);
  } catch (error) {
    console.error('Get passwords error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { title, username, password, url, folder_id, category_id, notes } = req.body;

    if (!title || !password) {
      return res.status(400).json({ error: 'Title and password are required' });
    }

    let teamId = null;
    if (folder_id) {
      const folder = await db.prepare('SELECT team_id FROM folders WHERE id = ?').get(folder_id);
      if (folder && folder.team_id) {
        teamId = folder.team_id;
      }
    }

    const encryptedPassword = req.encryptionKey 
      ? encrypt(password, req.encryptionKey)
      : encrypt(password);
    const folder = folder_id ? await db.prepare('SELECT name FROM folders WHERE id = ?').get(folder_id) : null;
    const folderInfo = folder ? ` in folder "${folder.name}"` : '';
    
    const result = await db.prepare(`
      INSERT INTO passwords (user_id, title, username, encrypted_password, url, folder_id, category_id, notes, team_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `).run(userId, title, username || null, encryptedPassword, url || null, folder_id || null, category_id || null, notes || null, teamId);

    await sendNotification(db, userId, 'New Password Added', `A new password "${title}" was added to your vault${folderInfo}.`, 'add');

    res.status(201).json({ 
      message: 'Password saved successfully',
      id: result.lastInsertRowid,
      title,
      username,
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

router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { title, username, password, url, folder_id, category_id, notes } = req.body;

    const existing = await db.prepare(`
      SELECT p.* FROM passwords p 
      WHERE p.id = $1 AND (p.user_id = $2 
        OR p.id IN (SELECT password_id FROM shared_passwords WHERE user_id = $2)
        OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $2))
    `).get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Password not found' });
    }

    const encryptedPassword = password 
      ? (req.encryptionKey ? encrypt(password, req.encryptionKey) : encrypt(password))
      : existing.encrypted_password;

    await db.prepare(`
      UPDATE passwords 
      SET title = $1, username = $2, encrypted_password = $3, url = $4, folder_id = $5, category_id = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND user_id = $9
    `).run(
      title || existing.title,
      username !== undefined ? username : existing.username,
      encryptedPassword,
      url !== undefined ? url : existing.url,
      folder_id !== undefined ? folder_id : existing.folder_id,
      category_id !== undefined ? category_id : existing.category_id,
      notes !== undefined ? notes : existing.notes,
      id,
      existing.user_id
    );

    const newFolderId = folder_id !== undefined ? folder_id : existing.folder_id;
    const folder = newFolderId ? await db.prepare('SELECT name FROM folders WHERE id = ?').get(newFolderId) : null;
    const folderInfo = folder ? ` in folder "${folder.name}"` : '';

    await sendNotification(db, userId, 'Password Updated', `The password "${title || existing.title}" was updated${folderInfo}.`, 'update');

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await db.prepare('SELECT p.*, f.name as folder_name FROM passwords p LEFT JOIN folders f ON p.folder_id = f.id WHERE p.id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Password not found' });
    }

    const isOwner = existing.user_id === userId;
    const isTeamMember = existing.team_id && await db.prepare('SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2').get(existing.team_id, userId);
    const isSharedWithUser = await db.prepare('SELECT 1 FROM shared_passwords WHERE password_id = $1 AND user_id = $2').get(id, userId);
    const canSeePassword = isOwner || isTeamMember || isSharedWithUser;
    
    if (!canSeePassword) {
      return res.status(403).json({ error: 'You do not have access to this password' });
    }

    const result = await db.prepare('DELETE FROM passwords WHERE id = $1').run(id);

    const folderInfo = existing?.folder_name ? ` from folder "${existing.folder_name}"` : '';
    await sendNotification(db, userId, 'Password Deleted', `A password was deleted from your vault${folderInfo}.`, 'delete');

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

router.get('/export', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;

    const passwords = await db.prepare(`
      SELECT p.*, c.name as category_name, f.name as folder_name
      FROM passwords p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN folders f ON p.folder_id = f.id
      WHERE p.user_id = $1
    `).all(userId);

    const exportData = passwords.map(p => {
      try {
        const decryptedPassword = req.encryptionKey 
          ? decrypt(p.encrypted_password, req.encryptionKey)
          : decrypt(p.encrypted_password);
        return {
          title: p.title,
          username: p.username,
          password: decryptedPassword,
          url: p.url,
          notes: p.notes,
          category: p.category_name,
          folder: p.folder_name
        };
      } catch (e) {
        console.error('Export decryption error for', p.id, e.message);
        return {
          title: p.title,
          username: p.username,
          password: '[DECRYPTION_FAILED]',
          url: p.url,
          notes: p.notes,
          category: p.category_name,
          folder: p.folder_name
        };
      }
    });

    res.json(exportData);
  } catch (error) {
    console.error('Export passwords error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/import', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const data = req.body;

    let passwordsToImport = [];

    if (Array.isArray(data)) {
      passwordsToImport = data;
    } else if (data.items && Array.isArray(data.items)) {
      passwordsToImport = data.items;
    } else {
      return res.status(400).json({ error: 'Invalid import data format' });
    }

    let importedCount = 0;

    for (const p of passwordsToImport) {
      const title = p.title || p.name || 'Imported';
      const username = p.login?.username || p.username || null;
      const password = p.login?.password || p.password || null;
      const url = p.login?.uri || p.url || null;
      const notes = p.notes || null;

      if (password) {
        const encryptedPassword = req.encryptionKey 
          ? encrypt(password, req.encryptionKey)
          : encrypt(password);
        await db.prepare(`
          INSERT INTO passwords (user_id, title, username, encrypted_password, url, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `).run(userId, title, username, encryptedPassword, url, notes);
        importedCount++;
      }
    }

    await sendNotification(db, userId, 'Passwords Imported', `${importedCount} passwords were imported to your vault.`, 'add');

    res.json({ message: `Successfully imported ${importedCount} passwords` });
  } catch (error) {
    console.error('Import passwords error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const db = req.db;

    const categories = await db.prepare('SELECT * FROM categories WHERE user_id IS NULL ORDER BY name').all();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { name, is_global } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const categoryUserId = is_global ? null : userId;
    const result = await db.prepare('INSERT INTO categories (user_id, name) VALUES ($1, $2)').run(categoryUserId, name);

    res.status(201).json({ id: result.lastInsertRowid, user_id: categoryUserId, name });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.prepare('DELETE FROM categories WHERE id = $1').run(id);

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
