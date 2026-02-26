import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { auth } from '../api';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const token = searchParams.get('token');
  const username = searchParams.get('username');

  useEffect(() => {
    if (!token || !username) {
      setError('Invalid reset link');
    }
  }, [token, username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setLoading(true);

    try {
      await auth.resetPassword({ username, token, newPassword: password });
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error resetting password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="64" height="64">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#00f0ff',stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#0066cc',stopOpacity:1}} />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="12" fill="url(#grad1)"/>
          <rect x="8" y="28" width="48" height="32" rx="4" fill="rgba(0,0,0,0.3)"/>
          <path d="M20 28V20C20 14.4772 24.4772 10 30 10C35.5228 10 40 14.4772 40 20V28" stroke="white" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="30" cy="38" r="6" fill="#0a0e17"/>
          <rect x="28" y="38" width="4" height="10" rx="2" fill="#00f0ff"/>
          <rect x="26" y="44" width="8" height="3" rx="1.5" fill="#00f0ff"/>
        </svg>
      </div>
      <h1>RESET PASSWORD</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="success" style={{ color: '#00f0ff' }}>{message}</p>}
      {!message && token && username && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={4}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}
      <p style={{ marginTop: '15px' }}>
        <Link to="/login">Back to Login</Link>
      </p>
    </div>
  );
}

export default ResetPassword;
