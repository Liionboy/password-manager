const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { search, category_id } = req.query;

    let query = `
      SELECT c.*, cat.name as category_name 
      FROM cards c 
      LEFT JOIN categories cat ON c.category_id = cat.id 
      WHERE c.user_id = ?
    `;
    const params = [userId];

    if (search) {
      query += ` AND (c.title LIKE ? OR c.cardholder_name LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (category_id) {
      query += ` AND c.category_id = ?`;
      params.push(category_id);
    }

    query += ` ORDER BY c.created_at DESC`;

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
    const { title, cardholder_name, card_number, expiry_month, expiry_year, cvv, brand, category_id, notes } = req.body;

    if (!title || !card_number) {
      return res.status(400).json({ error: 'Title and card number are required' });
    }

    const encryptedCardNumber = encrypt(card_number);
    const encryptedCvv = cvv ? encrypt(cvv) : null;
    
    const result = db.prepare(`
      INSERT INTO cards (user_id, title, cardholder_name, encrypted_card_number, expiry_month, expiry_year, cvv, brand, category_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, title, cardholder_name || null, encryptedCardNumber, expiry_month || null, expiry_year || null, encryptedCvv, brand || null, category_id || null, notes || null);

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

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
