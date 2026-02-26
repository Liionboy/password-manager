import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../api';

function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await auth.forgotPassword(username);
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Error sending recovery email');
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
      <h1>RECOVERY</h1>
      <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Enter your username to receive a password reset link</p>
      {error && <p className="error">{error}</p>}
      {message && <p className="success" style={{ color: '#00f0ff' }}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Recovery Email'}
        </button>
      </form>
      <p style={{ marginTop: '15px' }}>
        Remember your password? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}

export default ForgotPassword;
