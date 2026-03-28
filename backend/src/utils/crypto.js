const crypto = require('crypto');
const { deriveKey, encrypt: encryptPerUser, decrypt: decryptPerUser } = require('./crypto-per-user');

// Legacy mode (global key) - for backward compatibility
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/**
 * Derive AES key using PBKDF2 (native crypto - no CryptoJS)
 * @param {string} passphrase - Password/key string
 * @returns {{ key: Buffer, salt: Buffer }}
 */
function deriveLegacyKey(passphrase) {
  const salt = crypto.createHash('sha256').update('password-manager-legacy-salt').digest();
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt data - supports both per-user and legacy global key modes
 * @param {string} text - Data to encrypt
 * @param {Buffer|string} userKey - User's encryption key (Buffer) or legacy mode (string)
 * @returns {string|object} - Encrypted data
 */
function encrypt(text, userKey) {
  // Per-user mode (userKey is a Buffer)
  if (Buffer.isBuffer(userKey)) {
    const encrypted = encryptPerUser(text, userKey);
    return JSON.stringify(encrypted);
  }

  // Legacy mode (global key) - uses native crypto AES-256-CBC with PBKDF2
  if (!ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY environment variable is not set!');
    throw new Error('Encryption key not configured');
  }

  const passphrase = userKey || ENCRYPTION_KEY;
  const key = deriveLegacyKey(passphrase);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt data - supports both per-user and legacy global key modes
 * @param {string|object} ciphertext - Encrypted data
 * @param {Buffer|string} userKey - User's encryption key (Buffer) or legacy mode (string)
 * @returns {string} - Decrypted data
 */
function decrypt(ciphertext, userKey) {
  // Per-user mode (ciphertext is JSON string)
  if (typeof ciphertext === 'string' && ciphertext.startsWith('{')) {
    const encrypted = JSON.parse(ciphertext);
    if (!Buffer.isBuffer(userKey)) {
      throw new Error('Per-user decryption requires a Buffer key');
    }
    return decryptPerUser(encrypted, userKey);
  }

  // Legacy mode
  if (!ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY environment variable is not set!');
    throw new Error('Encryption key not configured');
  }

  // New format: iv:encryptedHex (AES-256-CBC with PBKDF2-derived key)
  if (ciphertext.includes(':')) {
    const [ivHex, encryptedHex] = ciphertext.split(':');
    const passphrase = userKey || ENCRYPTION_KEY;
    const key = deriveLegacyKey(passphrase);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Old format: CryptoJS-style (backward compatibility - will be deprecated)
  // Import CryptoJS only for legacy decryption
  const CryptoJS = require('crypto-js');
  const bytes = CryptoJS.AES.decrypt(ciphertext, userKey || ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Password generator - uses crypto.randomFillSync for secure randomness
 */
function generatePassword(length = 16, options = {}) {
  const { uppercase = true, lowercase = true, numbers = true, symbols = true } = options;

  let charset = '';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (charset === '') charset = 'abcdefghijklmnopqrstuvwxyz';

  let password = '';
  const array = new Uint32Array(length);
  crypto.randomFillSync(array);

  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }

  return password;
}

module.exports = { encrypt, decrypt, generatePassword };
