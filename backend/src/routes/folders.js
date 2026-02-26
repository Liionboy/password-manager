const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const userRole = req.user.role;

    let teamId = null;
    if (userRole !== 'admin') {
      const membership = db.prepare('SELECT team_id FROM team_members WHERE user_id = ?').get(userId);
      teamId = membership?.team_id;
    }

    let query = `
      SELECT f.*, 
        (SELECT COUNT(*) FROM passwords p WHERE p.folder_id = f.id) as password_count,
        (SELECT COUNT(*) FROM cards c WHERE c.folder_id = f.id) as card_count
      FROM folders f 
      WHERE f.user_id = ?
    `;
    const params = [userId];

    if (teamId) {
      query += ` OR f.team_id = ?`;
      params.push(teamId);
    }

    query += ` ORDER BY f.name`;

    const folders = db.prepare(query).all(...params);

    const folderMap = {};
    folders.forEach(f => {
      f.children = [];
      folderMap[f.id] = f;
    });

    const rootFolders = [];
    folders.forEach(f => {
      if (f.parent_id && folderMap[f.parent_id]) {
        folderMap[f.parent_id].children.push(f);
      } else {
        rootFolders.push(f);
      }
    });

    res.json(rootFolders);
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { name, parent_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    if (parent_id) {
      const existing = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(parent_id, userId);
      if (!existing) {
        return res.status(400).json({ error: 'Parent folder not found' });
      }
    }

    const result = db.prepare(`
      INSERT INTO folders (user_id, name, parent_id)
      VALUES (?, ?, ?)
    `).run(userId, name, parent_id || null);

    res.status(201).json({ id: result.lastInsertRowid, name, parent_id: parent_id || null });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { name, parent_id } = req.body;

    const existing = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (parent_id) {
      if (parseInt(parent_id) === parseInt(id)) {
        return res.status(400).json({ error: 'Folder cannot be its own parent' });
      }
      const parent = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(parent_id, userId);
      if (!parent) {
        return res.status(400).json({ error: 'Parent folder not found' });
      }
    }

    db.prepare(`
      UPDATE folders SET name = ?, parent_id = ? WHERE id = ? AND user_id = ?
    `).run(name || existing.name, parent_id !== undefined ? parent_id : existing.parent_id, id, userId);

    res.json({ message: 'Folder updated successfully' });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
