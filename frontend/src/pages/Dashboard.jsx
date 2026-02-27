import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import speakeasy from 'speakeasy';
import { passwords, categories, cards, folders as foldersApi, teams, auth } from '../api';

function Dashboard({ token, setToken, role = 'user' }) {
  const [activeTab, setActiveTab] = useState('passwords');
  const [passwordList, setPasswordList] = useState([]);
  const [cardList, setCardList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [folderList, setFolderList] = useState([]);
  const [teamList, setTeamList] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({ email: '', mfa_enabled: false });
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importData, setImportData] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [newFolder, setNewFolder] = useState({ name: '', parent_id: '', team_id: '' });
  const [editFolder, setEditFolder] = useState({ id: '', name: '', parent_id: '', team_id: '' });
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const showNotification = (message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  useEffect(() => {
    console.log('useEffect triggered, selectedFolder:', selectedFolder);
    loadPasswords();
    loadCards();
    loadCategories();
    loadFolders();
    if (role === 'admin') loadTeams();
  }, [search, selectedCategory, selectedFolder, activeTab, role]);

  const loadTeams = async () => {
    try {
      const response = await teams.getAllAdmin();
      setTeamList(response.data);
    } catch (err) {
      console.error('Error loading teams:', err);
    }
  };

  const loadPasswords = async () => {
    try {
      console.log('Loading passwords, selectedFolder:', selectedFolder);
      const folderParam = selectedFolder ? selectedFolder : undefined;
      const response = await passwords.getAll(search, selectedCategory || null, folderParam);
      setPasswordList(response.data);
    } catch (err) {
      console.error('Error loading passwords:', err);
    }
  };

  const loadCards = async () => {
    try {
      const folderParam = selectedFolder ? selectedFolder : undefined;
      const response = await cards.getAll(search, selectedCategory || null, folderParam);
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

  const loadFolders = async () => {
    try {
      const response = await foldersApi.getAll();
      setFolderList(response.data);
    } catch (err) {
      console.error('Error loading folders:', err);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolder.name.trim()) return;
    try {
      await foldersApi.create({
        name: newFolder.name,
        parent_id: newFolder.parent_id || null,
        team_id: newFolder.team_id || null
      });
      setNewFolder({ name: '', parent_id: '', team_id: '' });
      setShowFolderModal(false);
      loadFolders();
      showNotification('Folder created successfully!');
    } catch (err) {
      showNotification('Error creating folder: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDeleteFolder = async (id) => {
    if (!window.confirm('Delete this folder? Items inside will be moved to root.')) return;
    try {
      await foldersApi.delete(id);
      if (selectedFolder === id) setSelectedFolder('');
      loadFolders();
      loadPasswords();
      showNotification('Folder deleted successfully!');
    } catch (err) {
      showNotification('Error deleting folder: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleEditFolderClick = (folder) => {
    setEditFolder({
      id: folder.id,
      name: folder.name,
      parent_id: folder.parent_id || '',
      team_id: folder.team_id || ''
    });
    setShowEditFolderModal(true);
  };

  const handleUpdateFolder = async () => {
    if (!editFolder.name.trim()) return;
    try {
      await foldersApi.update(editFolder.id, {
        name: editFolder.name,
        parent_id: editFolder.parent_id || null,
        team_id: editFolder.team_id || null
      });
      setShowEditFolderModal(false);
      loadFolders();
      showNotification('Folder updated successfully!');
    } catch (err) {
      showNotification('Error updating folder: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderFolderTree = (items, level = 0) => {
    return items.map(folder => (
      <div key={folder.id} style={{ paddingLeft: level * 15 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '10px 12px',
          cursor: 'pointer',
          background: selectedFolder === folder.id ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
          border: selectedFolder === folder.id ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid transparent',
          borderRadius: '8px',
          gap: '8px',
          marginBottom: '4px',
          color: selectedFolder === folder.id ? '#00f0ff' : '#94a3b8',
          transition: 'all 0.3s ease'
        }}>
          {folder.children && folder.children.length > 0 && (
            <span onClick={() => toggleFolder(folder.id)} style={{ cursor: 'pointer', width: '16px', color: '#00f0ff' }}>
              {expandedFolders[folder.id] ? '▼' : '▶'}
            </span>
          )}
          {!folder.children?.length && <span style={{ width: '16px' }}></span>}
          <span onClick={() => setSelectedFolder(folder.id)} style={{ flex: 1 }}>
            📁 {folder.name}
          </span>
          <button 
            onClick={() => handleEditFolderClick(folder)} 
            style={{ padding: '4px 8px', fontSize: '10px', background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', border: '1px solid rgba(0, 240, 255, 0.3)', borderRadius: '4px', cursor: 'pointer', marginRight: '4px' }}
          >
            ✏️
          </button>
          <button 
            onClick={() => handleDeleteFolder(folder.id)} 
            style={{ padding: '4px 8px', fontSize: '10px', background: 'rgba(220, 38, 38, 0.2)', color: '#f87171', border: '1px solid rgba(220, 38, 38, 0.3)', borderRadius: '4px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        {expandedFolders[folder.id] && folder.children?.length > 0 && (
          renderFolderTree(folder.children, level + 1)
        )}
      </div>
    ));
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
        showNotification('Copied to clipboard!');
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
        showNotification('Copied to clipboard!');
      }
    } catch (err) {
      console.error('Error copying:', err);
      showNotification('Failed to copy to clipboard', 'error');
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
        showNotification('Invalid format. Expected an array of passwords or Bitwarden export.', 'error');
        return;
      }
      await passwords.import(data);
      setShowImportModal(false);
      setImportData('');
      loadPasswords();
      loadFolders();
      showNotification('Import successful!');
    } catch (err) {
      showNotification('Error importing: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  const loadProfile = async () => {
    try {
      const response = await auth.getProfile();
      setProfileData({ email: response.data.email || '', mfa_enabled: response.data.mfa_enabled || false });
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleProfileClick = () => {
    loadProfile();
    setShowProfileModal(true);
  };

  const handleUpdateProfile = async () => {
    try {
      const data = { email: profileData.email };
      
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          showNotification('Passwords do not match!', 'error');
          return;
        }
        if (newPassword.length < 8) {
          showNotification('Password must be at least 8 characters!', 'error');
          return;
        }
        data.password = newPassword;
      }
      
      await auth.updateProfile(data);
      showNotification('Profile updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setShowProfileModal(false);
    } catch (err) {
      showNotification('Error updating profile: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleMfaSetup = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const secret = speakeasy.generateSecret({ name: `PasswordManager-${userId}` });
      const response = await auth.mfaSetup(secret.base32, secret.otpauth_url);
      setMfaSetupData({ qrCode: response.data.qrCode, secret: secret.base32 });
    } catch (err) {
      showNotification('Error setting up MFA: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleMfaEnable = async () => {
    try {
      await auth.mfaEnable(mfaCode);
      showNotification('MFA enabled successfully!');
      setMfaSetupData(null);
      setMfaCode('');
      loadProfile();
    } catch (err) {
      showNotification('Error enabling MFA: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleMfaDisable = async () => {
    if (!window.confirm('Are you sure you want to disable MFA?')) return;
    try {
      await auth.mfaDisable(mfaCode);
      showNotification('MFA disabled successfully!');
      setMfaCode('');
      loadProfile();
    } catch (err) {
      showNotification('Error disabling MFA: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const maskCardNumber = (number) => {
    if (!number) return '';
    return '**** **** **** ' + number.slice(-4);
  };

  return (
    <div>
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            background: n.type === 'error' ? '#dc3545' : '#28a745',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '6px',
            marginBottom: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '14px',
            animation: 'slideIn 0.3s ease'
          }}>
            {n.message}
          </div>
        ))}
      </div>
      <div className="header">
        <div className="header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="36" height="36">
              <rect width="64" height="64" rx="12" fill="#0066cc"/>
              <rect x="8" y="28" width="48" height="32" rx="4" fill="#ffffff"/>
              <path d="M20 28V20C20 14.4772 24.4772 10 30 10C35.5228 10 40 14.4772 40 20V28" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
              <circle cx="30" cy="38" r="6" fill="#0066cc"/>
              <rect x="28" y="38" width="4" height="10" rx="2" fill="#0066cc"/>
              <rect x="26" y="44" width="8" height="3" rx="1.5" fill="#0066cc"/>
            </svg>
            <h1>Password Manager</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleProfileClick} className="secondary">Profile</button>
            <Link to="/teams">
              <button className="secondary">Teams</button>
            </Link>
            {role === 'admin' && (
              <>
                <Link to="/team">
                  <button className="secondary">Users</button>
                </Link>
                <Link to="/settings">
                  <button className="secondary">Settings</button>
                </Link>
              </>
            )}
            <button onClick={handleLogout} className="secondary">Logout</button>
            <span style={{ color: '#fff', fontSize: '14px', marginLeft: '10px', background: '#374151', padding: '5px 10px', borderRadius: '4px' }}>
              👤 {localStorage.getItem('username')}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 80px)' }}>
        <div style={{ 
          width: '260px', 
          background: 'rgba(17, 24, 39, 0.6)', 
          borderRight: '1px solid #1e293b',
          padding: '20px', 
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#00f0ff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Folders</h3>
            <button onClick={() => setShowFolderModal(true)} style={{ padding: '6px 12px', fontSize: '12px' }}>+</button>
          </div>
          <div 
            onClick={() => setSelectedFolder('')}
            style={{ 
              padding: '10px 12px', 
              cursor: 'pointer', 
              background: selectedFolder === '' ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
              border: selectedFolder === '' ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid transparent',
              borderRadius: '8px',
              marginBottom: '8px',
              color: selectedFolder === '' ? '#00f0ff' : '#94a3b8',
              transition: 'all 0.3s ease'
            }}
          >
            📋 All Items
          </div>
          {renderFolderTree(folderList)}
        </div>

        <div style={{ flex: 1, padding: '20px' }}>
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
                <Link to={selectedFolder ? `/add?folder_id=${selectedFolder}` : `/add`}>
                  <button className="success">+ Add Password</button>
                </Link>
              ) : (
                <Link to={selectedFolder ? `/add-card?folder_id=${selectedFolder}` : `/add-card`}>
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
                      <h3>
                        {pwd.title}
                        {pwd.is_shared === 1 && (
                          <span style={{ 
                            marginLeft: '10px', 
                            fontSize: '12px', 
                            color: '#00f0ff',
                            background: 'rgba(0, 240, 255, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            Shared by {pwd.owner_username}
                          </span>
                        )}
                      </h3>
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
                      {pwd.folder_name && (
                        <span className="category-tag" style={{ background: '#0066cc' }}>📁 {pwd.folder_name}</span>
                      )}
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
      </div>

      {showFolderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="form-container">
            <h2>Create Folder</h2>
            <div className="form-group">
              <label>Folder Name</label>
              <input
                type="text"
                value={newFolder.name}
                onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
                placeholder="e.g., Google, Facebook"
              />
            </div>
            <div className="form-group">
              <label>Parent Folder (optional)</label>
              <select
                value={newFolder.parent_id}
                onChange={(e) => setNewFolder({ ...newFolder, parent_id: e.target.value })}
              >
                <option value="">None (Root)</option>
                {folderList.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {role === 'admin' && (
              <div className="form-group">
                <label>Team (optional)</label>
                <select
                  value={newFolder.team_id}
                  onChange={(e) => setNewFolder({ ...newFolder, team_id: e.target.value })}
                >
                  <option value="">Personal (no team)</option>
                  {teamList.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-actions">
              <button onClick={handleCreateFolder} className="success">Create</button>
              <button onClick={() => setShowFolderModal(false)} className="secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showEditFolderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="form-container">
            <h2>Edit Folder</h2>
            <div className="form-group">
              <label>Folder Name</label>
              <input
                type="text"
                value={editFolder.name}
                onChange={(e) => setEditFolder({ ...editFolder, name: e.target.value })}
                placeholder="Folder name"
              />
            </div>
            <div className="form-group">
              <label>Parent Folder</label>
              <select
                value={editFolder.parent_id}
                onChange={(e) => setEditFolder({ ...editFolder, parent_id: e.target.value })}
              >
                <option value="">None (Root)</option>
                {folderList.filter(f => f.id !== editFolder.id).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {role === 'admin' && (
              <div className="form-group">
                <label>Team</label>
                <select
                  value={editFolder.team_id}
                  onChange={(e) => setEditFolder({ ...editFolder, team_id: e.target.value })}
                >
                  <option value="">Personal (no team)</option>
                  {teamList.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-actions">
              <button onClick={handleUpdateFolder} className="success">Save</button>
              <button onClick={() => setShowEditFolderModal(false)} className="secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="form-container">
            <h2>Export Passwords</h2>
            <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Download all your passwords as a JSON file?</p>
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
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="form-container">
            <h2>Import Passwords</h2>
            <p style={{ color: '#94a3b8', marginBottom: '15px' }}>Paste JSON array of passwords:</p>
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

      {showProfileModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', zIndex: 2000
        }}>
          <div className="form-container" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>My Profile</h2>
            <div className="form-group">
              <label>Notification Email</label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                placeholder="your@email.com"
              />
              <small style={{ color: '#64748b', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                Receive email notifications for password changes at this address
              </small>
            </div>

            <div style={{ marginTop: '20px', padding: '15px', background: '#1a1a2e', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>Change Password</h3>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '15px', background: '#1a1a2e', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>Two-Factor Authentication</h3>
              
              {!mfaSetupData && !profileData.mfa_enabled && (
                <button onClick={handleMfaSetup} className="success">Enable 2FA</button>
              )}

              {mfaSetupData && (
                <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                  <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '15px' }}>
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  <img src={mfaSetupData.qrCode} alt="QR Code" style={{ maxWidth: '250px', display: 'block', margin: '15px auto' }} />
                  <div style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', marginTop: '15px', wordBreak: 'break-all' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>Or enter this secret manually:</p>
                    <strong style={{ color: '#00f0ff', fontSize: '14px' }}>{mfaSetupData.secret}</strong>
                  </div>
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label>Enter verification code</label>
                    <input
                      type="text"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button onClick={handleMfaEnable} className="success">Verify & Enable</button>
                    <button onClick={() => setMfaSetupData(null)} className="secondary">Cancel</button>
                  </div>
                </div>
              )}

              {profileData.mfa_enabled && (
                <>
                  <p style={{ color: '#00f0ff', fontSize: '14px' }}>✓ Two-Factor Authentication is enabled</p>
                  <div className="form-group">
                    <label>Enter code to disable</label>
                    <input
                      type="text"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                    />
                  </div>
                  <button onClick={handleMfaDisable} className="danger">Disable 2FA</button>
                </>
              )}
            </div>

            <div className="form-actions">
              <button onClick={handleUpdateProfile} className="success">Save</button>
              <button onClick={() => { setShowProfileModal(false); setMfaSetupData(null); setMfaCode(''); }} className="secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
