const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { search } = req.query;

    let query = `SELECT id, user_id, title, encrypted_content, created_at, updated_at FROM secure_notes WHERE user_id = $1`;
    const params = [userId];

    if (search) {
      query += ` AND title ILIKE $2`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY updated_at DESC, created_at DESC`;

    const rows = await db.prepare(query).all(...params);
    const notes = rows.map(n => {
      try {
        return {
          ...n,
          content: req.encryptionKey ? decrypt(n.encrypted_content, req.encryptionKey) : decrypt(n.encrypted_content)
        };
      } catch {
        return { ...n, content: '[DECRYPTION_FAILED]' };
      }
    });

    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { title, content } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const encryptedContent = req.encryptionKey ? encrypt(content, req.encryptionKey) : encrypt(content);

    const result = await db.prepare(`
      INSERT INTO secure_notes (user_id, title, encrypted_content)
      VALUES ($1, $2, $3)
    `).run(userId, title, encryptedContent);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Note created successfully' });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { title, content } = req.body || {};

    const existing = await db.prepare('SELECT id FROM secure_notes WHERE id = $1 AND user_id = $2').get(id, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const encryptedContent = req.encryptionKey ? encrypt(content, req.encryptionKey) : encrypt(content);

    await db.prepare(`
      UPDATE secure_notes
      SET title = $1, encrypted_content = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
    `).run(title, encryptedContent, id, userId);

    res.json({ message: 'Note updated successfully' });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.prepare('DELETE FROM secure_notes WHERE id = $1 AND user_id = $2').run(id, userId);
    if (!result.changes) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
