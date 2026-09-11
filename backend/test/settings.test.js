const assert = require('node:assert/strict');
const test = require('node:test');
const nodemailer = require('nodemailer');

process.env.JWT_SECRET ||= 'settings-test-jwt-secret';
const { sendNotification } = require('../src/routes/settings');

const originalCreateTransport = nodemailer.createTransport;
const originalEnvironment = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM
};

const setEnvironmentSmtp = () => {
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'mailer@example.test';
  process.env.SMTP_PASS = 'environment-password';
  process.env.SMTP_FROM = 'Password Manager <mailer@example.test>';
};

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const makeDb = ({ personalSettings, globalSettings, email = 'user@example.test' }) => ({
  prepare(sql) {
    return {
      get: async () => {
        if (sql.includes('FROM users')) return { email };
        if (sql.includes('FROM settings') && (sql.includes('user_id = ?') || sql.includes('user_id = $1'))) return personalSettings;
        if (sql.includes('FROM settings') && sql.includes('is_global = 1')) {
          const hasCompleteSmtp = globalSettings
            && globalSettings.smtp_host
            && globalSettings.smtp_port
            && globalSettings.smtp_user
            && globalSettings.smtp_password
            && globalSettings.smtp_from;
          return sql.includes('NULLIF') && !hasCompleteSmtp ? undefined : globalSettings;
        }
        throw new Error(`Unexpected query in test: ${sql}`);
      }
    };
  }
});

const withMailerMock = async (callback) => {
  let lastMessage;
  let transportOptions;
  setEnvironmentSmtp();
  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return {
      sendMail: async (message) => {
        lastMessage = message;
      }
    };
  };

  try {
    await callback({
      getLastMessage: () => lastMessage,
      getTransportOptions: () => transportOptions
    });
  } finally {
    nodemailer.createTransport = originalCreateTransport;
    restoreEnvironment();
  }
};

test('SMTP notification regressions', async () => {
  await withMailerMock(async ({ getLastMessage, getTransportOptions }) => {
    const personalDb = makeDb({
      personalSettings: {
        user_id: 2,
        notify_on_add: 1,
        notify_on_update: 0,
        notify_on_delete: 0
      },
      // Incomplete duplicate global rows must not become the source of
      // notification preferences.
      globalSettings: {
        id: 1,
        is_global: 1,
        notify_on_add: 0,
        notify_on_update: 0,
        notify_on_delete: 0,
        smtp_host: null
      }
    });

    await sendNotification(personalDb, 2, 'New Password Added', 'A password was added.', 'add');

    assert.equal(getTransportOptions().host, 'smtp.example.test');
    assert.equal(getTransportOptions().auth.user, 'mailer@example.test');
    assert.equal(getTransportOptions().auth.pass, 'environment-password');
    assert.equal(getLastMessage().from, 'Password Manager <mailer@example.test>');
    assert.equal(getLastMessage().to, 'user@example.test');

    await sendNotification(personalDb, 2, 'Password Deleted', 'A password was deleted.', 'delete');
    assert.equal(getLastMessage().subject, 'New Password Added');

    const noPreferencesDb = makeDb({ personalSettings: undefined, globalSettings: undefined });
    await sendNotification(noPreferencesDb, 2, 'New Card Added', 'A card was added.', 'add');
    assert.equal(getLastMessage().subject, 'New Card Added');

    const validGlobalDb = makeDb({
      personalSettings: {
        user_id: 2,
        notify_on_add: 1,
        notify_on_update: 1,
        notify_on_delete: 1
      },
      globalSettings: {
        id: 99,
        is_global: 1,
        smtp_host: 'smtp.database.test',
        smtp_port: 587,
        smtp_user: 'database@example.test',
        smtp_password: 'database-password',
        smtp_from: 'Password Manager <database@example.test>',
        notify_on_add: 0,
        notify_on_update: 1,
        notify_on_delete: 0
      }
    });

    await sendNotification(validGlobalDb, 2, 'Password Deleted', 'A password was deleted.', 'delete');
    assert.equal(getLastMessage().subject, 'New Card Added');
  });
});
