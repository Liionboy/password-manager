const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const { sendNotification } = require('./settings');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { search, category_id, folder_id } = req.query;

    let query = `
      SELECT c.*, cat.name as category_name, f.name as folder_name, t.name as team_name,
        CASE WHEN c.user_id = $1 THEN 0 ELSE 1 END as is_shared,
        u.username as owner_username
      FROM cards c 
      LEFT JOIN categories cat ON c.category_id = cat.id 
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE (c.user_id = $1 
         OR c.id IN (SELECT card_id FROM shared_cards WHERE user_id = $1)
         OR c.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1))
    `;
    const params = [userId];

    if (search) {
      query += ` AND (c.title LIKE $${params.length + 1} OR c.cardholder_name LIKE $${params.length + 1})`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm);
    }

    if (category_id) {
      query += ` AND c.category_id = $${params.length + 1}`;
      params.push(parseInt(category_id));
    }

    const folderId = folder_id;
    
    if (folderId && folderId !== '' && folderId !== 'null' && folderId !== 'undefined') {
      query += ` AND c.folder_id = $${params.length + 1}`;
      params.push(parseInt(folderId));
    } else if (folderId === undefined) {
      // "All Items" shows only cards without a folder
      query += ` AND c.folder_id IS NULL`;
    }

    query += ` ORDER BY is_shared ASC, c.created_at DESC`;

    const cards = await db.prepare(query).all(...params);

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

router.post('/', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { title, cardholder_name, card_number, expiry_month, expiry_year, cvv, brand, category_id, notes, folder_id } = req.body;

    if (!title || !card_number) {
      return res.status(400).json({ error: 'Title and card number are required' });
    }

    let teamId = null;
    if (folder_id) {
      const folder = await db.prepare('SELECT team_id FROM folders WHERE id = ?').get(folder_id);
      if (folder && folder.team_id) {
        teamId = folder.team_id;
      }
    }

    const encryptedCardNumber = encrypt(card_number);
    const encryptedCvv = cvv ? encrypt(cvv) : null;
    const folder = folder_id ? await db.prepare('SELECT name FROM folders WHERE id = ?').get(folder_id) : null;
    const folderInfo = folder ? ` in folder "${folder.name}"` : '';
    
    const result = await db.prepare(`
      INSERT INTO cards (user_id, title, cardholder_name, encrypted_card_number, expiry_month, expiry_year, cvv, brand, category_id, notes, team_id, folder_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `).run(userId, title, cardholder_name || null, encryptedCardNumber, expiry_month || null, expiry_year || null, encryptedCvv, brand || null, category_id || null, notes || null, teamId, folder_id || null);

    await sendNotification(db, userId, 'New Card Added', `A new card "${title}" was added to your vault${folderInfo}.`, 'add');

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

router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;
    const { title, cardholder_name, card_number, expiry_month, expiry_year, cvv, brand, category_id, notes, folder_id } = req.body;

    const existing = await db.prepare('SELECT * FROM cards WHERE id = $1 AND user_id = $2').get(id, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const encryptedCardNumber = card_number ? encrypt(card_number) : existing.encrypted_card_number;
    const encryptedCvv = cvv ? encrypt(cvv) : existing.cvv;

    await db.prepare(`
      UPDATE cards 
      SET title = $1, cardholder_name = $2, encrypted_card_number = $3, expiry_month = $4, expiry_year = $5, cvv = $6, brand = $7, category_id = $8, notes = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND user_id = $11
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

    const newFolderId = folder_id !== undefined ? folder_id : existing.folder_id;
    const folder = newFolderId ? await db.prepare('SELECT name FROM folders WHERE id = ?').get(newFolderId) : null;
    const folderInfo = folder ? ` in folder "${folder.name}"` : '';

    await sendNotification(db, userId, 'Card Updated', `The card "${title || existing.title}" was updated${folderInfo}.`, 'update');

    res.json({ message: 'Card updated successfully' });
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await db.prepare('SELECT c.*, f.name as folder_name FROM cards c LEFT JOIN folders f ON c.folder_id = f.id WHERE c.id = $1 AND c.user_id = $2').get(id, userId);

    const result = await db.prepare('DELETE FROM cards WHERE id = $1 AND user_id = $2').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const folderInfo = existing?.folder_name ? ` from folder "${existing.folder_name}"` : '';
    await sendNotification(db, userId, 'Card Deleted', `A card was deleted from your vault${folderInfo}.`, 'delete');

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
