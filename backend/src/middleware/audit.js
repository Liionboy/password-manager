/**
 * Audit Logging Middleware
 * Logs all security-relevant actions for compliance and incident response
 */

async function logAudit(db, userId, action, details = {}) {
  try {
    const query = `
      INSERT INTO audit_logs (user_id, action, resource, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `;
    
    const values = [
      userId,
      action,
      details.resource || null,
      JSON.stringify(details),
      details.ip || null,
      details.userAgent || null
    ];
    
    await db.query(query, values);
  } catch (error) {
    console.error('Audit log error:', error.message);
    // Don't fail the request if audit logging fails
  }
}

function createAuditLogger(db) {
  return function auditLogger(req, res, next) {
    // Attach audit logger to request
    req.audit = (action, details) => {
      return logAudit(db, req.user?.id, action, {
        ...details,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    };
    
    next();
  };
}

// Pre-defined action types for consistency
const AuditActions = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',
  
  // MFA
  MFA_SETUP: 'MFA_SETUP',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  MFA_VERIFIED: 'MFA_VERIFIED',
  
  // Passwords
  PASSWORD_CREATED: 'PASSWORD_CREATED',
  PASSWORD_VIEWED: 'PASSWORD_VIEWED',
  PASSWORD_UPDATED: 'PASSWORD_UPDATED',
  PASSWORD_DELETED: 'PASSWORD_DELETED',
  PASSWORD_EXPORT: 'PASSWORD_EXPORT',
  PASSWORD_IMPORT: 'PASSWORD_IMPORT',
  
  // Cards
  CARD_CREATED: 'CARD_CREATED',
  CARD_VIEWED: 'CARD_VIEWED',
  CARD_UPDATED: 'CARD_UPDATED',
  CARD_DELETED: 'CARD_DELETED',
  
  // Admin
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_LOCKED: 'USER_LOCKED',
  USER_UNLOCKED: 'USER_UNLOCKED',
  
  // Settings
  SMTP_SETTINGS_UPDATED: 'SMTP_SETTINGS_UPDATED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  
  // Teams
  TEAM_CREATED: 'TEAM_CREATED',
  TEAM_DELETED: 'TEAM_DELETED',
  TEAM_MEMBER_ADDED: 'TEAM_MEMBER_ADDED',
  TEAM_MEMBER_REMOVED: 'TEAM_MEMBER_REMOVED',
  
  // Security
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSIONS_LIST_VIEWED: 'SESSIONS_LIST_VIEWED'
};

module.exports = {
  logAudit,
  createAuditLogger,
  AuditActions
};
