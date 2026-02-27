const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const userRole = req.user.role;

    let teamId = null;
    const membership = await db.prepare('SELECT team_id FROM team_members WHERE user_id = ?').get(userId);
    teamId = membership?.team_id;

    let query = `
      SELECT f.*, 
        (SELECT COUNT(*) FROM passwords p WHERE p.folder_id = f.id) as password_count,
        (SELECT COUNT(*) FROM cards c WHERE c.folder_id = f.id) as card_count
      FROM folders f 
      WHERE f.user_id = $1
    `;
    const params = [userId];

    if (teamId) {
      query += ` OR f.team_id = $${params.length + 1}`;
      params.push(teamId);
    }

    query += ` ORDER BY f.name`;

    const folders = await db.prepare(query).all(...params);

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

router.post('/', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { name, parent_id, team_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    let allowedTeamId = null;
    if (team_id) {
      // Check if user is member of this team
      const membership = await db.prepare('SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2').get(team_id, userId);
      if (membership || userRole === 'admin') {
        allowedTeamId = team_id;
      }
    }

    if (parent_id) {
      const existing = await db.prepare('SELECT * FROM folders WHERE id = $1 AND (user_id = $2 OR team_id = $3)').get(parent_id, userId, allowedTeamId);
      if (!existing) {
        return res.status(400).json({ error: 'Parent folder not found' });
      }
    }

    const result = await db.prepare(`
      INSERT INTO folders (user_id, name, parent_id, team_id)
      VALUES ($1, $2, $3, $4)
    `).run(userId, name, parent_id || null, allowedTeamId);

    res.status(201).json({ id: result.lastInsertRowid, name, parent_id: parent_id || null, team_id: allowedTeamId });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;
    const { name, parent_id, team_id } = req.body;

    const existing = await db.prepare('SELECT * FROM folders WHERE id = $1 AND user_id = $2').get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (parent_id) {
      if (parseInt(parent_id) === parseInt(id)) {
        return res.status(400).json({ error: 'Folder cannot be its own parent' });
      }
      const parent = await db.prepare('SELECT * FROM folders WHERE id = $1 AND (user_id = $2 OR team_id IN (SELECT team_id FROM team_members WHERE user_id = $3))').get(parent_id, userId, userId);
      if (!parent) {
        return res.status(400).json({ error: 'Parent folder not found' });
      }
    }

    let allowedTeamId = existing.team_id;
    if (team_id !== undefined && userRole === 'admin') {
      if (team_id) {
        const team = await db.prepare('SELECT * FROM teams WHERE id = ?').get(team_id);
        if (team) {
          allowedTeamId = team_id;
        }
      } else {
        allowedTeamId = null;
      }
    }

    await db.prepare(`
      UPDATE folders SET name = $1, parent_id = $2, team_id = $3 WHERE id = $4 AND user_id = $5
    `).run(name || existing.name, parent_id !== undefined ? parent_id : existing.parent_id, allowedTeamId, id, userId);

    res.json({ message: 'Folder updated successfully' });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.prepare('DELETE FROM folders WHERE id = $1 AND user_id = $2').run(id, userId);

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
