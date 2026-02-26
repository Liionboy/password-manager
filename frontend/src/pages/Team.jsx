import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../api';

function Team({ token }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await auth.getUsers();
      setUsers(response.data);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await auth.createUser(newUser);
      setSuccess('User created successfully!');
      setNewUser({ username: '', password: '', role: 'user' });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating user');
    }
  };

  const handleDeleteUser = async (id) => {
    const currentUsername = localStorage.getItem('username');
    const userToDelete = users.find(u => u.id === id);
    
    if (userToDelete?.username === currentUsername) {
      alert('You cannot delete your own account!');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await auth.deleteUser(id);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Error deleting user');
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    try {
      await auth.updateUser(editingUser.id, { role: editRole });
      setSuccess('User updated successfully!');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating user');
    }
  };

  return (
    <div>
      <div className="header">
        <div className="header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="36" height="36">
              <rect width="64" height="64" rx="12" fill="#0066cc"/>
              <rect x="8" y="28" width="48" height="32" rx="4" fill="#ffffff"/>
              <path d="M20 28V20C20 14.4772 24.4772 10 30 10C35.5228 10 40 14.4772 40 20V28" stroke="#ffffff" strokeWidth="4" strokeLinecap="round"/>
              <circle cx="30" cy="38" r="6" fill="#0066cc"/>
              <rect x="28" y="38" width="4" height="10" rx="2" fill="#0066cc"/>
              <rect x="26" y="44" width="8" height="3" rx="1.5" fill="#0066cc"/>
            </svg>
            <h1>User Management</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/">
              <button className="secondary">Back</button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="form-container" style={{ maxWidth: '800px' }}>
          <h2>Create New User</h2>
          {error && <p className="error">{error}</p>}
          {success && <p className="success" style={{ color: '#00f0ff' }}>{success}</p>}
          
          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: '10px', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="success">Add</button>
            </div>
          </form>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h2 style={{ marginBottom: '20px' }}>Team Members</h2>
          {error && <p className="error">{error}</p>}
          {success && <p className="success" style={{ color: '#00f0ff' }}>{success}</p>}
          <div className="password-list">
            {users.map(user => (
              <div key={user.id} className="password-card">
                <div className="password-info">
                  <h3>{user.username}</h3>
                  <p>Role: <span style={{ 
                    color: user.role === 'admin' ? '#00f0ff' : '#94a3b8',
                    fontWeight: 'bold'
                  }}>{user.role.toUpperCase()}</span></p>
                  <p>Created: {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div className="password-actions">
                  <button onClick={() => { setEditingUser(user); setEditRole(user.role); setError(''); setSuccess(''); }} className="secondary">Edit</button>
                  <button onClick={() => handleDeleteUser(user.id)} className="danger">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {editingUser && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <div className="form-container" style={{ maxWidth: '400px' }}>
              <h2>Edit User: {editingUser.username}</h2>
              <div className="form-group">
                <label>Role</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-actions">
                <button onClick={handleEditUser} className="success">Save</button>
                <button onClick={() => setEditingUser(null)} className="secondary">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Team;
