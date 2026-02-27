const { deriveKey } = require('../utils/crypto-per-user');

/**
 * Middleware to derive user's encryption key from their master password
 * 
 * The client must send the master password in the X-Master-Password header
 * (encrypted with the server's public key in production, or plain in dev)
 * 
 * For better security, the key derivation should happen client-side and only
 * the derived key should be sent (encrypted with TLS).
 */
function requireEncryptionKey(req, res, next) {
  try {
    const db = req.db;
    const userId = req.user.id;
    
    // Get user's salt from database
    const userQuery = db.query('SELECT encryption_salt FROM users WHERE id = $1', [userId]);
    
    userQuery.then(result => {
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = result.rows[0];
      
      if (!user.encryption_salt) {
        // Legacy mode - user was created before per-user encryption
        return res.status(400).json({ 
          error: 'User does not have encryption salt. Please re-create your account or contact admin.' 
        });
      }
      
      // Get the master password from header (in production, this should be encrypted)
      const masterPasswordHeader = req.headers['x-master-password'];
      
      if (!masterPasswordHeader) {
        return res.status(400).json({ 
          error: 'Master password required',
          requiresEncryptionKey: true,
          salt: user.encryption_salt
        });
      }
      
      // Derive the encryption key
      const salt = Buffer.from(user.encryption_salt, 'base64');
      const encryptionKey = deriveKey(masterPasswordHeader, salt);
      
      // Attach the key to the request for use in routes
      req.encryptionKey = encryptionKey;
      
      next();
    }).catch(error => {
      console.error('Encryption key derivation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
    
  } catch (error) {
    console.error('Encryption key middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { requireEncryptionKey };
