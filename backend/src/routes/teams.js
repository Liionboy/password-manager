const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;

    const teams = db.prepare(`
      SELECT t.*, tm.role as user_role
      FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = ?
      ORDER BY t.name
    `).all(userId);

    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/all', (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const db = req.db;
    const teams = db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
      FROM teams t
      ORDER BY t.name
    `).all();

    res.json(teams);
  } catch (error) {
    console.error('Get all teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const result = db.prepare('INSERT INTO teams (name) VALUES (?)').run(name);
    db.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, userId, 'admin');

    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/join', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { team_id } = req.body;

    if (!team_id) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(team_id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const existing = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(team_id, userId);
    if (existing) {
      return res.status(400).json({ error: 'Already a member' });
    }

    db.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)').run(team_id, userId, 'member');

    res.json({ message: 'Joined team successfully' });
  } catch (error) {
    console.error('Join team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/members', (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;

    const members = db.prepare(`
      SELECT u.id, u.username, tm.role, tm.created_at
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ?
    `).all(id);

    res.json(members);
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/members/:userId', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id, userId: memberId } = req.params;

    const membership = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(id, userId);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only team admin can remove members' });
    }

    if (parseInt(memberId) === userId) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(id, memberId);

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/members', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { user_id, role = 'member' } = req.body;

    const membership = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(id, userId);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only team admin can add members' });
    }

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(id, user_id);
    if (existing) {
      return res.status(400).json({ error: 'User already in team' });
    }

    db.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)').run(id, user_id, role);

    res.json({ message: 'Member added successfully' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      const membership = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(id, userId);
      if (!membership || membership.role !== 'admin') {
        return res.status(403).json({ error: 'Only team admin can delete team' });
      }
    }

    const result = db.prepare('DELETE FROM teams WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
