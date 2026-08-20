const { deriveKey } = require('../utils/crypto-per-user');

/**
 * Middleware to derive user's encryption key from their master password
 * 
 * The client must send the master password in the X-Master-Password header
 * over HTTPS. The derived key is kept only on the request and is never stored.
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
        // Legacy users can still read legacy ciphertext. New registrations
        // always get a salt and therefore use per-user encryption below.
        return next();
      }
      
      const masterPasswordHeader = req.headers['x-master-password'];
      
      if (!masterPasswordHeader) {
        return res.status(400).json({ 
          error: 'Master password required',
          requiresEncryptionKey: true
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
