const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/contacts', async (req, res) => {
  try {
    const rows = await req.db.query(
      `SELECT ec.owner_user_id, ec.contact_user_id, ec.delay_hours, ec.created_at, u.username AS contact_username
       FROM emergency_contacts ec
       JOIN users u ON u.id = ec.contact_user_id
       WHERE ec.owner_user_id = $1
       ORDER BY ec.created_at DESC`,
      [req.user.id]
    );
    res.json(rows.rows);
  } catch (error) {
    console.error('Emergency contacts list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { contact_user_id, delay_hours = 168 } = req.body || {};
    if (!contact_user_id) return res.status(400).json({ error: 'contact_user_id is required' });
    if (Number(contact_user_id) === ownerId) return res.status(400).json({ error: 'Cannot add yourself as emergency contact' });

    const user = await req.db.query('SELECT id FROM users WHERE id = $1', [contact_user_id]);
    if (!user.rows.length) return res.status(404).json({ error: 'Contact user not found' });

    await req.db.query(
      `INSERT INTO emergency_contacts (owner_user_id, contact_user_id, delay_hours)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner_user_id, contact_user_id)
       DO UPDATE SET delay_hours = EXCLUDED.delay_hours`,
      [ownerId, contact_user_id, delay_hours]
    );

    res.status(201).json({ message: 'Emergency contact saved' });
  } catch (error) {
    console.error('Emergency contact save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/contacts/:contactUserId', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const contactUserId = Number(req.params.contactUserId);
    await req.db.query('DELETE FROM emergency_contacts WHERE owner_user_id = $1 AND contact_user_id = $2', [ownerId, contactUserId]);
    res.json({ message: 'Emergency contact removed' });
  } catch (error) {
    console.error('Emergency contact delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/requests', async (req, res) => {
  try {
    const contactId = req.user.id;
    const { owner_user_id } = req.body || {};
    if (!owner_user_id) return res.status(400).json({ error: 'owner_user_id is required' });

    const cfg = await req.db.query(
      'SELECT delay_hours FROM emergency_contacts WHERE owner_user_id = $1 AND contact_user_id = $2',
      [owner_user_id, contactId]
    );
    if (!cfg.rows.length) return res.status(403).json({ error: 'You are not configured as emergency contact for this user' });

    const delayHours = cfg.rows[0].delay_hours;
    const existingPending = await req.db.query(
      `SELECT id FROM emergency_access_requests
       WHERE owner_user_id = $1 AND contact_user_id = $2 AND status = 'pending' AND revoked_at IS NULL`,
      [owner_user_id, contactId]
    );
    if (existingPending.rows.length) return res.status(409).json({ error: 'A pending request already exists' });

    await req.db.query(
      `INSERT INTO emergency_access_requests (owner_user_id, contact_user_id, status, requested_at, grant_after)
       VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($3 || ' hours')::interval)`,
      [owner_user_id, contactId, String(delayHours)]
    );

    res.status(201).json({ message: 'Emergency access request submitted' });
  } catch (error) {
    console.error('Emergency request create error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/requests/incoming', async (req, res) => {
  try {
    const rows = await req.db.query(
      `SELECT r.*, u.username AS contact_username
       FROM emergency_access_requests r
       JOIN users u ON u.id = r.contact_user_id
       WHERE r.owner_user_id = $1
       ORDER BY r.requested_at DESC`,
      [req.user.id]
    );
    res.json(rows.rows);
  } catch (error) {
    console.error('Incoming requests list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/requests/outgoing', async (req, res) => {
  try {
    const rows = await req.db.query(
      `SELECT r.*, u.username AS owner_username
       FROM emergency_access_requests r
       JOIN users u ON u.id = r.owner_user_id
       WHERE r.contact_user_id = $1
       ORDER BY r.requested_at DESC`,
      [req.user.id]
    );
    res.json(rows.rows);
  } catch (error) {
    console.error('Outgoing requests list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/requests/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ownerId = req.user.id;
    const result = await req.db.query(
      `UPDATE emergency_access_requests
       SET status = 'approved', decision_at = CURRENT_TIMESTAMP, expires_at = CURRENT_TIMESTAMP + interval '24 hours'
       WHERE id = $1 AND owner_user_id = $2 AND status = 'pending' AND revoked_at IS NULL`,
      [id, ownerId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Pending request not found' });
    res.json({ message: 'Emergency access approved' });
  } catch (error) {
    console.error('Approve emergency request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/requests/:id/deny', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ownerId = req.user.id;
    const result = await req.db.query(
      `UPDATE emergency_access_requests
       SET status = 'denied', decision_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND owner_user_id = $2 AND status = 'pending' AND revoked_at IS NULL`,
      [id, ownerId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Pending request not found' });
    res.json({ message: 'Emergency access denied' });
  } catch (error) {
    console.error('Deny emergency request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/requests/:id/revoke', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ownerId = req.user.id;
    const result = await req.db.query(
      `UPDATE emergency_access_requests
       SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND owner_user_id = $2 AND revoked_at IS NULL`,
      [id, ownerId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Request not found' });
    res.json({ message: 'Emergency access revoked' });
  } catch (error) {
    console.error('Revoke emergency request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/requests/:id/finalize-auto', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await req.db.query(
      `UPDATE emergency_access_requests
       SET status = 'auto_granted', decision_at = CURRENT_TIMESTAMP, expires_at = CURRENT_TIMESTAMP + interval '24 hours'
       WHERE id = $1 AND status = 'pending' AND revoked_at IS NULL AND grant_after <= CURRENT_TIMESTAMP
       RETURNING owner_user_id, contact_user_id`,
      [id]
    );
    if (!row.rows.length) return res.status(400).json({ error: 'Request not ready for auto-grant' });

    const reqRow = row.rows[0];
    if (![reqRow.owner_user_id, reqRow.contact_user_id].includes(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized for this request' });
    }

    res.json({ message: 'Emergency access auto-granted' });
  } catch (error) {
    console.error('Finalize auto grant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
