#!/usr/bin/env node

/**
 * Generate secure random secrets for password-manager
 * Run this ONCE before first deployment to generate .env file
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateBase64Secret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64');
}

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists!');
  console.log('   If you want to regenerate, delete the existing .env file first.');
  console.log('   This is a safety measure to prevent accidental key rotation.');
  process.exit(1);
}

const secrets = {
  // JWT Configuration
  JWT_SECRET: generateSecret(32),
  JWT_EXPIRY: '15m',
  REFRESH_SECRET: generateSecret(32),
  REFRESH_EXPIRY: '7d',
  
  // Encryption - MUST be exactly 32 characters for AES-256
  ENCRYPTION_KEY: generateBase64Secret(32),
  
  // Database Configuration
  DB_HOST: 'postgres',
  DB_USER: 'postgres',
  DB_PASSWORD: generateSecret(16),
  DB_NAME: 'passwordmanager',
  
  // Application Settings
  NODE_ENV: 'production',
  PORT: '5000',
  
  // Security Settings
  BCRYPT_ROUNDS: '10',
  MAX_LOGIN_ATTEMPTS: '5',
  LOCKOUT_DURATION_MINUTES: '15',
  
  // Admin Setup - Set to 'true' ONLY for initial admin creation
  // After creating admin, change to 'false' or remove
  ALLOW_FIRST_ADMIN: 'true',
  
  // Optional: SMTP (configure if you want email notifications)
  // SMTP_HOST: ''
  // SMTP_PORT: '587'
  // SMTP_USER: ''
  // SMTP_PASS: ''
  // SMTP_FROM: 'Password Manager <noreply@example.com>'
};

// Generate .env file
const envContent = Object.entries(secrets)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(envPath, envContent);
fs.chmodSync(envPath, 0o600); // Only owner can read/write

console.log('✅ Secure .env file generated!');
console.log('');
console.log('📁 Location:', envPath);
console.log('🔐 Permissions: 600 (owner read/write only)');
console.log('');
console.log('⚠️  IMPORTANT:');
console.log('   - Back up this .env file securely');
console.log('   - If you lose ENCRYPTION_KEY, all stored passwords are lost');
console.log('   - If you lose JWT_SECRET, all users must re-login');
console.log('');
console.log('📋 Next steps:');
console.log('   1. Review .env file');
console.log('   2. Update SMTP settings if needed');
console.log('   3. Run: docker compose up -d');
