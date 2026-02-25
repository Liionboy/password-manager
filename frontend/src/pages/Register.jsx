import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../api';

function Register({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    try {
      const response = await auth.register(username, password);
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="64" height="64">
          <rect width="64" height="64" rx="12" fill="#0066cc"/>
          <rect x="8" y="28" width="48" height="32" rx="4" fill="#ffffff"/>
          <path d="M20 28V20C20 14.4772 24.4772 10 30 10C35.5228 10 40 14.4772 40 20V28" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
          <circle cx="30" cy="38" r="6" fill="#0066cc"/>
          <rect x="28" y="38" width="4" height="10" rx="2" fill="#0066cc"/>
          <rect x="26" y="44" width="8" height="3" rx="1.5" fill="#0066cc"/>
        </svg>
      </div>
      <h1>Password Manager</h1>
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
        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Register</button>
      </form>
      <p style={{ marginTop: '15px' }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}

export default Register;
