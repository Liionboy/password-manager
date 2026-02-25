import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { passwords, categories } from '../api';

function Dashboard({ token, setToken }) {
  const [passwordList, setPasswordList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadPasswords();
    loadCategories();
  }, [search, selectedCategory]);

  const loadPasswords = async () => {
    try {
      const response = await passwords.getAll(search, selectedCategory || null);
      setPasswordList(response.data);
    } catch (err) {
      console.error('Error loading passwords:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await categories.getAll();
      setCategoryList(response.data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this password?')) return;
    
    try {
      await passwords.delete(id);
      loadPasswords();
    } catch (err) {
      console.error('Error deleting password:', err);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Error copying:', err);
    }
  };

  const handleExport = async () => {
    try {
      const response = await passwords.export();
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'passwords-export.json';
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (err) {
      console.error('Error exporting:', err);
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importData);
      if (!Array.isArray(data)) {
        alert('Invalid format. Expected an array of passwords.');
        return;
      }
      await passwords.import(data);
      setShowImportModal(false);
      setImportData('');
      loadPasswords();
      alert('Import successful!');
    } catch (err) {
      alert('Error importing: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div>
      <div className="header">
        <div className="header-content">
          <h1>Password Manager</h1>
          <button onClick={handleLogout} className="secondary">Logout</button>
        </div>
      </div>

      <div className="container">
        <div className="actions-bar">
          <div>
            <Link to="/add">
              <button className="success">+ Add Password</button>
            </Link>
            <button onClick={() => setShowImportModal(true)}>Import</button>
            <button onClick={() => setShowExportModal(true)}>Export</button>
          </div>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="">All Categories</option>
            {categoryList.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search passwords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {passwordList.length === 0 ? (
          <div className="empty-state">
            <p>No passwords found. Add your first password!</p>
          </div>
        ) : (
          <div className="password-list">
            {passwordList.map(pwd => (
              <div key={pwd.id} className="password-card">
                <div className="password-info">
                  <h3>{pwd.title}</h3>
                  <p>Username: {pwd.username || '-'}</p>
                  <div className="password-display">
                    <input 
                      type="password" 
                      value={pwd.password || ''} 
                      readOnly 
                      style={{ width: '200px' }}
                    />
                    <button onClick={() => handleCopy(pwd.password)} className="secondary">
                      Copy
                    </button>
                  </div>
                  {pwd.url && <p>URL: {pwd.url}</p>}
                  {pwd.category_name && (
                    <span className="category-tag">{pwd.category_name}</span>
                  )}
                </div>
                <div className="password-actions">
                  <Link to={`/edit/${pwd.id}`}>
                    <button className="secondary">Edit</button>
                  </Link>
                  <button onClick={() => handleDelete(pwd.id)} className="danger">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showExportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="form-container">
            <h2>Export Passwords</h2>
            <p>Download all your passwords as a JSON file?</p>
            <div className="form-actions">
              <button onClick={handleExport} className="success">Export</button>
              <button onClick={() => setShowExportModal(false)} className="secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="form-container">
            <h2>Import Passwords</h2>
            <p>Paste JSON array of passwords:</p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder='[{"title": "Example", "username": "user", "password": "pass"}]'
              style={{ minHeight: '150px', fontFamily: 'monospace' }}
            />
            <div className="form-actions">
              <button onClick={handleImport} className="success">Import</button>
              <button onClick={() => setShowImportModal(false)} className="secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
