import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../api';

function Login({ setToken, setRole }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    console.log('Login attempt:', { username, password });

    try {
      const response = await auth.login(username, password);
      console.log('Login response:', response.data);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('role', response.data.role || 'user');
      setToken(response.data.token);
      if (setRole) setRole(response.data.role || 'user');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed');
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
      <h1>PASSWORD MANAGER</h1>
      {error && <p className="error">{error}</p>}
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
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
      <p style={{ marginTop: '15px' }}>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}

export default Login;
