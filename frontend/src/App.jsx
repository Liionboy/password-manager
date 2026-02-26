import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import PasswordForm from './pages/PasswordForm';
import CardForm from './pages/CardForm';
import Settings from './pages/Settings';
import Team from './pages/Team';
import TeamManagement from './pages/TeamManagement';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role') || 'user');

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
    }
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!token ? <Login setToken={setToken} setRole={setRole} /> : <Navigate to="/" />} />
        <Route path="/register" element={!token ? <Register setToken={setToken} setRole={setRole} /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!token ? <ForgotPassword /> : <Navigate to="/" />} />
        <Route path="/reset-password" element={!token ? <ResetPassword /> : <Navigate to="/" />} />
        <Route path="/" element={token ? <Dashboard token={token} role={role} setToken={setToken} /> : <Navigate to="/login" />} />
        <Route path="/add" element={token ? <PasswordForm token={token} /> : <Navigate to="/login" />} />
        <Route path="/edit/:id" element={token ? <PasswordForm token={token} /> : <Navigate to="/login" />} />
        <Route path="/add-card" element={token ? <CardForm token={token} /> : <Navigate to="/login" />} />
        <Route path="/edit-card/:id" element={token ? <CardForm token={token} /> : <Navigate to="/login" />} />
        <Route path="/settings" element={token && role === 'admin' ? <Settings token={token} /> : <Navigate to="/" />} />
        <Route path="/team" element={token && role === 'admin' ? <Team token={token} /> : <Navigate to="/" />} />
        <Route path="/teams" element={token ? <TeamManagement token={token} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
