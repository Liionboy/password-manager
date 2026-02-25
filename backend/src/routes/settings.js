const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;

    let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    
    if (!settings) {
      db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
      settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    }

    if (settings.smtp_password) {
      settings.smtp_password = '***hidden***';
    }

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, notify_on_add, notify_on_update, notify_on_delete } = req.body;

    const existing = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);

    if (existing) {
      let updateSql = `UPDATE settings SET 
        smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_from = ?, 
        notify_on_add = ?, notify_on_update = ?, notify_on_delete = ?`;
      let params = [smtp_host, smtp_port, smtp_user, smtp_from, notify_on_add ? 1 : 0, notify_on_update ? 1 : 0, notify_on_delete ? 1 : 0];

      if (smtp_password && smtp_password !== '***hidden***') {
        updateSql += ', smtp_password = ?';
        params.push(smtp_password);
      }

      updateSql += ' WHERE user_id = ?';
      params.push(userId);

      db.prepare(updateSql).run(...params);
    } else {
      db.prepare(`INSERT INTO settings (user_id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, notify_on_add, notify_on_update, notify_on_delete)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        userId, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, notify_on_add ? 1 : 0, notify_on_update ? 1 : 0, notify_on_delete ? 1 : 0
      );
    }

    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/test-email', async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.id;
    const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_from } = req.body;

    if (!smtp_host || !smtp_port || !smtp_user || !smtp_password || !smtp_from) {
      return res.status(400).json({ error: 'All SMTP fields are required for testing' });
    }

    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port),
      secure: smtp_port === 465,
      auth: {
        user: smtp_user,
        pass: smtp_password
      }
    });

    await transporter.sendMail({
      from: smtp_from,
      to: smtp_user,
      subject: 'Password Manager - Test Email',
      text: 'If you receive this email, your SMTP settings are working correctly!'
    });

    res.json({ message: 'Test email sent successfully!' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: 'Failed to send test email: ' + error.message });
  }
});

const sendNotification = async (db, userId, subject, body, actionType) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    
    if (!settings || !settings.smtp_host) {
      return;
    }

    if (actionType === 'add' && !settings.notify_on_add) return;
    if (actionType === 'update' && !settings.notify_on_update) return;
    if (actionType === 'delete' && !settings.notify_on_delete) return;

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_port === 465,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password
      }
    });

    await transporter.sendMail({
      from: settings.smtp_from,
      to: settings.smtp_user,
      subject,
      text: body
    });
  } catch (error) {
    console.error('Email notification error:', error);
  }
};

module.exports = router;
module.exports.sendNotification = sendNotification;
