const bcrypt = require('bcryptjs');
const argon2 = require('argon2');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '19456', 10),
  timeCost: parseInt(process.env.ARGON2_TIME_COST || '2', 10),
  parallelism: parseInt(process.env.ARGON2_PARALLELISM || '1', 10),
};

function isArgon2Hash(hash = '') {
  return hash.startsWith('$argon2');
}

function isBcryptHash(hash = '') {
  return /^\$2[aby]\$/.test(hash);
}

async function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return { valid: false, needsUpgrade: false };

  if (isArgon2Hash(passwordHash)) {
    const valid = await argon2.verify(passwordHash, password);
    return { valid, needsUpgrade: false };
  }

  if (isBcryptHash(passwordHash)) {
    const valid = await bcrypt.compare(password, passwordHash);
    return { valid, needsUpgrade: valid };
  }

  return { valid: false, needsUpgrade: false };
}

async function maybeUpgradePasswordHash(db, userId, plaintextPassword, needsUpgrade) {
  if (!needsUpgrade) return;
  const newHash = await hashPassword(plaintextPassword);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
}

module.exports = {
  hashPassword,
  verifyPassword,
  maybeUpgradePasswordHash,
  isArgon2Hash,
  isBcryptHash,
  BCRYPT_ROUNDS,
  ARGON2_OPTIONS,
};

