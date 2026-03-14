const crypto = require('crypto');

/**
 * Per-User Encryption Module
 * 
 * Each user has a unique encryption key derived from their master password
 * using PBKDF2. This ensures that even if one user is compromised, others
 * remain secure.
 * 
 * Key derivation:
 * - Uses PBKDF2 with SHA256
 * - 100,000 iterations (OWASP recommendation)
 * - 32-byte salt stored per user
 * - 32-byte output key for AES-256-GCM
 */

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const SALT_LENGTH = 16;

/**
 * Generate a random salt for key derivation
 */
function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * Derive an encryption key from a password and salt
 * @param {string} password - The user's master password
 * @param {Buffer} salt - The user's unique salt
 * @returns {Buffer} - 32-byte encryption key
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {Buffer} key - 32-byte encryption key
 * @returns {object} - { ciphertext, iv, authTag } (all base64 encoded)
 */
function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag().toString('base64');
  
  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {object} encrypted - { ciphertext, iv, authTag } (base64 encoded)
 * @param {Buffer} key - 32-byte encryption key
 * @returns {string} - Decrypted plaintext
 */
function decrypt(encrypted, key) {
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  
  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);
  
  return plaintext.toString('utf8');
}

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 16)
 * @param {object} options - { uppercase, lowercase, numbers, symbols }
 * @returns {string} - Generated password
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

module.exports = {
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
  generatePassword,
  PBKDF2_ITERATIONS,
  KEY_LENGTH,
  SALT_LENGTH
};
