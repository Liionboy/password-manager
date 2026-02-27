const CryptoJS = require('crypto-js');
const { deriveKey, encrypt: encryptPerUser, decrypt: decryptPerUser } = require('./crypto-per-user');

// Legacy mode (global key) - for backward compatibility
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

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
  
  // Legacy mode (global key)
  if (!ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY environment variable is not set!');
    throw new Error('Encryption key not configured');
  }
  
  return CryptoJS.AES.encrypt(text, userKey || ENCRYPTION_KEY).toString();
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
  
  // Legacy mode (CryptoJS format)
  if (!ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY environment variable is not set!');
    throw new Error('Encryption key not configured');
  }
  
  const bytes = CryptoJS.AES.decrypt(ciphertext, userKey || ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Legacy password generator - still useful
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
  const crypto = require('crypto');
  const array = new Uint32Array(length);
  crypto.randomFillSync(array);
  
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
}

module.exports = { encrypt, decrypt, generatePassword };
