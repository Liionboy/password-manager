import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PasswordForm from './pages/PasswordForm';
import CardForm from './pages/CardForm';
import Settings from './pages/Settings';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!token ? <Login setToken={setToken} /> : <Navigate to="/" />} />
        <Route path="/register" element={!token ? <Register setToken={setToken} /> : <Navigate to="/" />} />
        <Route path="/" element={token ? <Dashboard token={token} setToken={setToken} /> : <Navigate to="/login" />} />
        <Route path="/add" element={token ? <PasswordForm token={token} /> : <Navigate to="/login" />} />
        <Route path="/edit/:id" element={token ? <PasswordForm token={token} /> : <Navigate to="/login" />} />
        <Route path="/add-card" element={token ? <CardForm token={token} /> : <Navigate to="/login" />} />
        <Route path="/edit-card/:id" element={token ? <CardForm token={token} /> : <Navigate to="/login" />} />
        <Route path="/settings" element={token ? <Settings token={token} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
