const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const { sendNotification } = require('./settings');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { search, category_id, folder_id } = req.query;

    let query = `
      SELECT c.*, cat.name as category_name, f.name as folder_name, t.name as team_name,
        CASE WHEN c.user_id = ? THEN 0 ELSE 1 END as is_shared,
        u.username as owner_username
      FROM cards c 
      LEFT JOIN categories cat ON c.category_id = cat.id 
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE c.user_id = ? 
         OR c.id IN (SELECT card_id FROM shared_cards WHERE user_id = ?)
         OR c.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?)
    `;
    const params = [userId, userId, userId, userId];

    if (search) {
      query += ` AND (c.title LIKE ? OR c.cardholder_name LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (category_id) {
      query += ` AND c.category_id = ?`;
      params.push(parseInt(category_id));
    }

    if (folder_id && folder_id !== '' && folder_id !== 'null') {
      query += ` AND c.folder_id = ?`;
      params.push(parseInt(folder_id));
    } else if (!folder_id || folder_id === '' || folder_id === 'null') {
      query += ` AND c.folder_id IS NULL`;
    }

    query += ` ORDER BY is_shared ASC, c.created_at DESC`;

    const cards = db.prepare(query).all(...params);

    const decrypted = cards.map(card => ({
      ...card,
      card_number: decrypt(card.encrypted_card_number),
      cvv: card.cvv ? decrypt(card.cvv) : null
    }));

    res.json(decrypted);
  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { title, cardholder_name, card_number, expiry_month, expiry_year, cvv, brand, category_id, notes, folder_id } = req.body;

    if (!title || !card_number) {
      return res.status(400).json({ error: 'Title and card number are required' });
    }

    let teamId = null;
    if (folder_id) {
      const folder = db.prepare('SELECT team_id FROM folders WHERE id = ?').get(folder_id);
      if (folder && folder.team_id) {
        teamId = folder.team_id;
      }
    }

    const encryptedCardNumber = encrypt(card_number);
    const encryptedCvv = cvv ? encrypt(cvv) : null;
    
    const result = db.prepare(`
      INSERT INTO cards (user_id, title, cardholder_name, encrypted_card_number, expiry_month, expiry_year, cvv, brand, category_id, notes, team_id, folder_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, title, cardholder_name || null, encryptedCardNumber, expiry_month || null, expiry_year || null, encryptedCvv, brand || null, category_id || null, notes || null, teamId, folder_id || null);

    sendNotification(db, userId, 'New Card Added', `A new card "${title}" was added to your vault.`, 'add');

    res.status(201).json({ 
      message: 'Card saved successfully',
      id: result.lastInsertRowid,
      title,
      cardholder_name,
      card_number,
      expiry_month,
      expiry_year,
      cvv,
      brand,
      category_id,
      notes
    });
  } catch (error) {
    console.error('Create card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { title, cardholder_name, card_number, expiry_month, expiry_year, cvv, brand, category_id, notes } = req.body;

    const existing = db.prepare('SELECT * FROM cards WHERE id = ? AND user_id = ?').get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const encryptedCardNumber = card_number ? encrypt(card_number) : existing.encrypted_card_number;
    const encryptedCvv = cvv ? encrypt(cvv) : existing.cvv;

    db.prepare(`
      UPDATE cards 
      SET title = ?, cardholder_name = ?, encrypted_card_number = ?, expiry_month = ?, expiry_year = ?, cvv = ?, brand = ?, category_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      title || existing.title,
      cardholder_name !== undefined ? cardholder_name : existing.cardholder_name,
      encryptedCardNumber,
      expiry_month !== undefined ? expiry_month : existing.expiry_month,
      expiry_year !== undefined ? expiry_year : existing.expiry_year,
      encryptedCvv,
      brand !== undefined ? brand : existing.brand,
      category_id !== undefined ? category_id : existing.category_id,
      notes !== undefined ? notes : existing.notes,
      id,
      userId
    );

    sendNotification(db, userId, 'Card Updated', `The card "${title || existing.title}" was updated.`, 'update');

    res.json({ message: 'Card updated successfully' });
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    sendNotification(db, userId, 'Card Deleted', `A card was deleted from your vault.`, 'delete');

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
