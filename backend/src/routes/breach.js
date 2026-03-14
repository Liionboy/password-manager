const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const HIBP_API_KEY = process.env.HIBP_API_KEY || '';

async function hibpCheckEmail(email) {
  if (!HIBP_API_KEY) {
    throw new Error('HIBP_API_KEY is not configured');
  }

  const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;
  const response = await fetch(url, {
    headers: {
      'hibp-api-key': HIBP_API_KEY,
      'user-agent': 'password-manager-breach-monitor/1.0'
    }
  });

  if (response.status === 404) return [];
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HIBP request failed (${response.status}): ${text.slice(0, 120)}`);
  }

  return response.json();
}

function severityFromBreach(b) {
  const classes = (b.DataClasses || []).map(x => String(x).toLowerCase());
  if (classes.includes('passwords') || classes.includes('password hints')) return 'high';
  if (classes.includes('phone numbers') || classes.includes('physical addresses')) return 'medium';
  return 'low';
}

router.get('/emails', async (req, res) => {
  try {
    const rows = await req.db.query(
      `SELECT id, email, created_at
       FROM breach_monitored_emails
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows.rows);
  } catch (error) {
    console.error('List monitored emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/emails', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });

    await req.db.query(
      `INSERT INTO breach_monitored_emails (user_id, email)
       VALUES ($1, $2)
       ON CONFLICT (user_id, email) DO NOTHING`,
      [req.user.id, String(email).trim().toLowerCase()]
    );

    res.status(201).json({ message: 'Monitored email added' });
  } catch (error) {
    console.error('Add monitored email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/emails/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await req.db.query('DELETE FROM breach_monitored_emails WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ message: 'Monitored email removed' });
  } catch (error) {
    console.error('Delete monitored email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const rows = await req.db.query(
      `SELECT id, email, source, breach_name, breach_date, severity, status, details, created_at, updated_at
       FROM breach_alerts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows.rows);
  } catch (error) {
    console.error('List breach alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/alerts/check', async (req, res) => {
  try {
    const emailsRes = await req.db.query(
      'SELECT email FROM breach_monitored_emails WHERE user_id = $1',
      [req.user.id]
    );
    const emails = emailsRes.rows.map(r => r.email);

    if (!emails.length) {
      return res.status(400).json({ error: 'No monitored emails configured' });
    }

    let inserted = 0;
    for (const email of emails) {
      let breaches = [];
      try {
        breaches = await hibpCheckEmail(email);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      for (const breach of breaches) {
        const breachName = breach.Name || breach.Title || 'Unknown breach';
        const breachDate = breach.BreachDate || null;
        const severity = severityFromBreach(breach);

        const exists = await req.db.query(
          `SELECT id FROM breach_alerts
           WHERE user_id = $1 AND email = $2 AND breach_name = $3`,
          [req.user.id, email, breachName]
        );

        if (!exists.rows.length) {
          await req.db.query(
            `INSERT INTO breach_alerts (user_id, email, source, breach_name, breach_date, severity, status, details)
             VALUES ($1, $2, 'haveibeenpwned', $3, $4, $5, 'new', $6)`,
            [req.user.id, email, breachName, breachDate, severity, JSON.stringify({ dataClasses: breach.DataClasses || [], domain: breach.Domain || null })]
          );
          inserted++;
        }
      }
    }

    res.json({ message: 'Breach check completed', inserted });
  } catch (error) {
    console.error('Breach check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/alerts/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!['new', 'acknowledged', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'status must be new|acknowledged|resolved' });
    }

    const result = await req.db.query(
      `UPDATE breach_alerts
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [status, id, req.user.id]
    );

    if (!result.rowCount) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert status updated' });
  } catch (error) {
    console.error('Update alert status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
