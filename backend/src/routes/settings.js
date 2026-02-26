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

    if (req.user.role === 'admin') {
      const globalSettings = db.prepare('SELECT * FROM settings WHERE is_global = 1').get();
      if (globalSettings) {
        settings = { ...settings, is_global: globalSettings.is_global };
        if (globalSettings.smtp_host && !settings.smtp_host) {
          settings.smtp_host = globalSettings.smtp_host;
          settings.smtp_port = globalSettings.smtp_port;
          settings.smtp_user = globalSettings.smtp_user;
          settings.smtp_from = globalSettings.smtp_from;
          settings.notify_on_add = globalSettings.notify_on_add;
          settings.notify_on_update = globalSettings.notify_on_update;
          settings.notify_on_delete = globalSettings.notify_on_delete;
          settings.is_global = true;
        }
      }
    } else {
      const globalSettings = db.prepare('SELECT * FROM settings WHERE is_global = 1').get();
      if (globalSettings && globalSettings.smtp_host && !settings.smtp_host) {
        settings.smtp_host = globalSettings.smtp_host;
        settings.smtp_port = globalSettings.smtp_port;
        settings.smtp_user = globalSettings.smtp_user;
        settings.smtp_from = globalSettings.smtp_from;
        settings.notify_on_add = globalSettings.notify_on_add;
        settings.notify_on_update = globalSettings.notify_on_update;
        settings.notify_on_delete = globalSettings.notify_on_delete;
        settings.is_global = true;
      }
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
    const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, notify_on_add, notify_on_update, notify_on_delete, is_global } = req.body;

    if (req.user.role !== 'admin' && is_global) {
      return res.status(403).json({ error: 'Only admin can save global settings' });
    }

    if (is_global) {
      const globalSettings = db.prepare('SELECT * FROM settings WHERE is_global = 1').get();
      if (globalSettings) {
        let updateSql = `UPDATE settings SET 
          smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_from = ?`;
        let params = [smtp_host, smtp_port, smtp_user, smtp_from];

        if (smtp_password && smtp_password !== '***hidden***') {
          updateSql += ', smtp_password = ?';
          params.push(smtp_password);
        }

        updateSql += ' WHERE is_global = 1';
        db.prepare(updateSql).run(...params);
      } else {
        db.prepare(`INSERT INTO settings (user_id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, is_global)
          VALUES (NULL, ?, ?, ?, ?, ?, 1)`).run(smtp_host, smtp_port, smtp_user, smtp_password, smtp_from);
      }
    }

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
      secure: parseInt(smtp_port) === 465,
      tls: {
        rejectUnauthorized: false,
        secure: parseInt(smtp_port) === 587
      },
      connectionTimeout: 15000,
      auth: {
        user: smtp_user,
        pass: smtp_password
      }
    });

    await transporter.sendMail({
      from: smtp_from,
      to: smtp_user,
      subject: 'Password Manager - Test Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0066cc, #0052a3); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; color: #333; }
            .content p { margin: 10px 0; line-height: 1.6; }
            .success-badge { display: inline-block; background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; margin-top: 20px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Manager</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>This is a <strong>test email</strong> to verify your SMTP settings are working correctly.</p>
              <p>✅ Everything is configured properly!</p>
              <div class="success-badge">Settings Verified</div>
            </div>
            <div class="footer">
              <p>This is an automated message from your Password Manager</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    res.json({ message: 'Test email sent successfully!' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: 'Failed to send test email: ' + error.message });
  }
});

const sendNotification = async (db, userId, subject, body, actionType) => {
  console.log('sendNotification called for user', userId, 'subject:', subject);
  try {
    console.log('Getting user and settings for userId:', userId);
    let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    console.log('User email:', user?.email, 'Settings:', settings);
    
    let isGlobal = false;
    if (!settings || !settings.smtp_host) {
      console.log('No personal settings, checking global');
      const globalSettings = db.prepare('SELECT * FROM settings WHERE is_global = 1').get();
      console.log('Global settings:', globalSettings);
      if (globalSettings && globalSettings.smtp_host) {
        settings = globalSettings;
        isGlobal = true;
      } else {
        console.log('No SMTP settings found for user', userId);
        return;
      }
    }

    const notifyOnAdd = isGlobal ? settings.notify_on_add : (settings.notify_on_add || (!settings.notify_on_add && !settings.notify_on_update && !settings.notify_on_delete));
    const notifyOnUpdate = isGlobal ? settings.notify_on_update : (settings.notify_on_update || (!settings.notify_on_add && !settings.notify_on_update && !settings.notify_on_delete));
    const notifyOnDelete = isGlobal ? settings.notify_on_delete : (settings.notify_on_delete || (!settings.notify_on_add && !settings.notify_on_update && !settings.notify_on_delete));

    if (actionType === 'add' && !notifyOnAdd) return;
    if (actionType === 'update' && !notifyOnUpdate) return;
    if (actionType === 'delete' && !notifyOnDelete) return;

    const recipientEmail = user?.email || settings.smtp_user;
    if (!recipientEmail) {
      console.log('No recipient email found for user', userId);
      return;
    }

    console.log('Sending notification to:', recipientEmail, 'via SMTP:', settings.smtp_host);

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_port === 465,
      tls: {
        rejectUnauthorized: false,
        secure: settings.smtp_port === 587
      },
      connectionTimeout: 15000,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password
      }
    });

    const getActionEmoji = (actionType) => {
      switch(actionType) {
        case 'add': return '➕';
        case 'update': return '✏️';
        case 'delete': return '🗑️';
        default: return '📝';
      }
    };

    const getActionText = (actionType) => {
      switch(actionType) {
        case 'add': return 'added';
        case 'update': return 'updated';
        case 'delete': return 'deleted';
        default: return 'modified';
      }
    };

    await transporter.sendMail({
      from: settings.smtp_from,
      to: recipientEmail,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0066cc, #0052a3); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; color: #333; }
            .content p { margin: 10px 0; line-height: 1.6; }
            .alert { padding: 15px; border-radius: 5px; margin: 15px 0; }
            .alert-add { background: #d4edda; border-left: 4px solid #28a745; }
            .alert-update { background: #fff3cd; border-left: 4px solid #ffc107; }
            .alert-delete { background: #f8d7da; border-left: 4px solid #dc3545; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
            .timestamp { color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Manager</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Your password vault has been <strong>${getActionText(actionType)}</strong>:</p>
              <div class="alert alert-${actionType}">
                <strong>${getActionEmoji(actionType)} ${subject}</strong>
                <p style="margin: 5px 0 0 0;">${body}</p>
              </div>
              <p class="timestamp">Time: ${new Date().toLocaleString()}</p>
            </div>
            <div class="footer">
              <p>If you did not perform this action, please secure your account immediately.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
  } catch (error) {
    console.error('Email notification error:', error);
  }
};

module.exports = router;
module.exports.sendNotification = sendNotification;
