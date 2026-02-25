import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { passwords, categories, cards } from '../api';

function Dashboard({ token, setToken }) {
  const [activeTab, setActiveTab] = useState('passwords');
  const [passwordList, setPasswordList] = useState([]);
  const [cardList, setCardList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadPasswords();
    loadCards();
    loadCategories();
  }, [search, selectedCategory, activeTab]);

  const loadPasswords = async () => {
    try {
      const response = await passwords.getAll(search, selectedCategory || null);
      setPasswordList(response.data);
    } catch (err) {
      console.error('Error loading passwords:', err);
    }
  };

  const loadCards = async () => {
    try {
      const response = await cards.getAll(search, selectedCategory || null);
      setCardList(response.data);
    } catch (err) {
      console.error('Error loading cards:', err);
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

  const handleDeletePassword = async (id) => {
    if (!window.confirm('Are you sure you want to delete this password?')) return;
    
    try {
      await passwords.delete(id);
      loadPasswords();
    } catch (err) {
      console.error('Error deleting password:', err);
    }
  };

  const handleDeleteCard = async (id) => {
    if (!window.confirm('Are you sure you want to delete this card?')) return;
    
    try {
      await cards.delete(id);
      loadCards();
    } catch (err) {
      console.error('Error deleting card:', err);
    }
  };

  const handleCopy = async (text) => {
    try {
      if (window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Copied to clipboard!');
      }
    } catch (err) {
      console.error('Error copying:', err);
      alert('Failed to copy to clipboard');
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
      if (!Array.isArray(data) && !(data.items && Array.isArray(data.items))) {
        alert('Invalid format. Expected an array of passwords or Bitwarden export.');
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

  const maskCardNumber = (number) => {
    if (!number) return '';
    return '**** **** **** ' + number.slice(-4);
  };

  return (
    <div>
      <div className="header">
        <div className="header-content">
          <h1>Password Manager</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/settings">
              <button className="secondary">Settings</button>
            </Link>
            <button onClick={handleLogout} className="secondary">Logout</button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="tabs">
          <button 
            className={activeTab === 'passwords' ? 'tab active' : 'tab'} 
            onClick={() => setActiveTab('passwords')}
          >
            Passwords
          </button>
          <button 
            className={activeTab === 'cards' ? 'tab active' : 'tab'} 
            onClick={() => setActiveTab('cards')}
          >
            Cards
          </button>
        </div>

        <div className="actions-bar">
          <div>
            {activeTab === 'passwords' ? (
              <Link to="/add">
                <button className="success">+ Add Password</button>
              </Link>
            ) : (
              <Link to="/add-card">
                <button className="success">+ Add Card</button>
              </Link>
            )}
            {activeTab === 'passwords' && (
              <>
                <button onClick={() => setShowImportModal(true)}>Import</button>
                <button onClick={() => setShowExportModal(true)}>Export</button>
              </>
            )}
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
            placeholder={activeTab === 'passwords' ? "Search passwords..." : "Search cards..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {activeTab === 'passwords' && (
          passwordList.length === 0 ? (
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
                    <button onClick={() => handleDeletePassword(pwd.id)} className="danger">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'cards' && (
          cardList.length === 0 ? (
            <div className="empty-state">
              <p>No cards found. Add your first card!</p>
            </div>
          ) : (
            <div className="password-list">
              {cardList.map(card => (
                <div key={card.id} className="password-card">
                  <div className="password-info">
                    <h3>{card.title}</h3>
                    <p>Cardholder: {card.cardholder_name || '-'}</p>
                    <p>Card Number: {maskCardNumber(card.card_number)}</p>
                    <p>Expires: {card.expiry_month}/{card.expiry_year}</p>
                    {card.brand && <p>Brand: {card.brand}</p>}
                    {card.category_name && (
                      <span className="category-tag">{card.category_name}</span>
                    )}
                  </div>
                  <div className="password-actions">
                    <button onClick={() => handleCopy(card.card_number)} className="secondary">
                      Copy Number
                    </button>
                    <Link to={`/edit-card/${card.id}`}>
                      <button className="secondary">Edit</button>
                    </Link>
                    <button onClick={() => handleDeleteCard(card.id)} className="danger">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
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
