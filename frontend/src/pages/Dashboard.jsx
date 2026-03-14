import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as OTPAuth from 'otpauth';
import { passwords, categories, cards, notes, emergency, folders as foldersApi, teams, auth } from '../api';

function Dashboard({ token, setToken, role = 'user' }) {
  const [activeTab, setActiveTab] = useState('passwords');
  const [passwordList, setPasswordList] = useState([]);
  const [cardList, setCardList] = useState([]);
  const [noteList, setNoteList] = useState([]);
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
  const [sessionList, setSessionList] = useState([]);
  const [currentSessionJti, setCurrentSessionJti] = useState('');
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [emergencyIncoming, setEmergencyIncoming] = useState([]);
  const [emergencyOutgoing, setEmergencyOutgoing] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [emergencyForm, setEmergencyForm] = useState({ contactUserId: '', delayHours: 168, ownerUserId: '' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importData, setImportData] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [newFolder, setNewFolder] = useState({ name: '', parent_id: '', team_id: '' });
  const [editFolder, setEditFolder] = useState({ id: '', name: '', parent_id: '', team_id: '' });
  const [notifications, setNotifications] = useState([]);
  const [passwordHealth, setPasswordHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthFilter, setHealthFilter] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedPasswordForHistory, setSelectedPasswordForHistory] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({ title: '', content: '' });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
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
    loadNotes();
    loadCategories();
    loadFolders();
    if (role === 'admin') loadTeams();
  }, [search, selectedCategory, selectedFolder, activeTab, role]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

  const loadPasswordHealth = async () => {
    try {
      setHealthLoading(true);
      const response = await passwords.getHealth();
      setPasswordHealth(response.data);
    } catch (err) {
      console.error('Error loading password health:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'passwords') {
      loadPasswordHealth();
    }
  }, [activeTab, passwordList.length]);

  const loadCards = async () => {
    try {
      const folderParam = selectedFolder ? selectedFolder : undefined;
      const response = await cards.getAll(search, selectedCategory || null, folderParam);
      setCardList(response.data);
    } catch (err) {
      console.error('Error loading cards:', err);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await notes.getAll(search || undefined);
      setNoteList(response.data);
    } catch (err) {
      console.error('Error loading notes:', err);
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

  const openCreateNoteModal = () => {
    setEditingNote(null);
    setNoteForm({ title: '', content: '' });
    setShowNoteModal(true);
  };

  const openEditNoteModal = (note) => {
    setEditingNote(note);
    setNoteForm({ title: note.title || '', content: note.content || '' });
    setShowNoteModal(true);
  };

  const handleSaveNote = async () => {
    try {
      if (!noteForm.title.trim() || !noteForm.content.trim()) {
        showNotification('Title and content are required', 'error');
        return;
      }

      if (editingNote) {
        await notes.update(editingNote.id, { title: noteForm.title, content: noteForm.content });
        showNotification('Note updated successfully!');
      } else {
        await notes.create({ title: noteForm.title, content: noteForm.content });
        showNotification('Note created successfully!');
      }

      setShowNoteModal(false);
      setEditingNote(null);
      setNoteForm({ title: '', content: '' });
      loadNotes();
    } catch (err) {
      showNotification('Error saving note: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await notes.delete(id);
      showNotification('Note deleted successfully!');
      loadNotes();
    } catch (err) {
      showNotification('Error deleting note: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const paletteEntries = [
    ...passwordList.map(p => ({
      type: 'password',
      id: p.id,
      title: p.title,
      subtitle: p.username || '',
      onOpen: () => navigate(`/edit/${p.id}`),
      onCopy: () => handleCopy(p.password || '')
    })),
    ...cardList.map(c => ({
      type: 'card',
      id: c.id,
      title: c.title,
      subtitle: c.cardholder_name || '',
      onOpen: () => navigate(`/edit-card/${c.id}`),
      onCopy: () => handleCopy(c.card_number || '')
    })),
    ...noteList.map(n => ({
      type: 'note',
      id: n.id,
      title: n.title,
      subtitle: (n.content || '').slice(0, 40),
      onOpen: () => { setActiveTab('notes'); },
      onCopy: () => handleCopy(n.content || '')
    }))
  ];

  const filteredPaletteEntries = paletteEntries
    .filter(item => {
      if (!commandQuery.trim()) return true;
      const q = commandQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q) || item.type.includes(q);
    })
    .slice(0, 20);

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

  const handleOpenHistory = async (passwordItem) => {
    try {
      setHistoryLoading(true);
      setSelectedPasswordForHistory(passwordItem);
      const response = await passwords.getHistory(passwordItem.id);
      setHistoryList(response.data || []);
      setShowHistoryModal(true);
    } catch (err) {
      showNotification('Error loading history: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRestoreHistory = async (historyId) => {
    if (!selectedPasswordForHistory) return;
    if (!window.confirm('Restore this version? Current version will be saved in history.')) return;

    try {
      await passwords.restoreHistory(selectedPasswordForHistory.id, historyId);
      showNotification('Version restored successfully!');
      setShowHistoryModal(false);
      await loadPasswords();
      await loadPasswordHealth();
    } catch (err) {
      showNotification('Error restoring version: ' + (err.response?.data?.error || err.message), 'error');
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

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const payload = JSON.parse(atob(refreshToken.split('.')[1]));
          setCurrentSessionJti(payload?.jti || '');
        } catch {
          setCurrentSessionJti('');
        }
      }

      const sessionsRes = await auth.getSessions();
      setSessionList(sessionsRes.data || []);

      const [contactsRes, incomingRes, outgoingRes] = await Promise.all([
        emergency.getContacts(),
        emergency.getIncoming(),
        emergency.getOutgoing()
      ]);
      setEmergencyContacts(contactsRes.data || []);
      setEmergencyIncoming(incomingRes.data || []);
      setEmergencyOutgoing(outgoingRes.data || []);

      try {
        const usersRes = await auth.getUsers();
        setAllUsers(usersRes.data || []);
      } catch {
        setAllUsers([]);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm('Revoke this session?')) return;
    try {
      await auth.revokeSession(sessionId);
      showNotification('Session revoked successfully!');
      await loadProfile();
    } catch (err) {
      showNotification('Error revoking session: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm('Revoke all sessions except current device?')) return;
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await auth.revokeOtherSessions(refreshToken);
      showNotification('All other sessions revoked!');
      await loadProfile();
    } catch (err) {
      showNotification('Error revoking other sessions: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleAddEmergencyContact = async () => {
    try {
      await emergency.addContact(Number(emergencyForm.contactUserId), Number(emergencyForm.delayHours || 168));
      showNotification('Emergency contact saved!');
      setEmergencyForm(prev => ({ ...prev, contactUserId: '' }));
      await loadProfile();
    } catch (err) {
      showNotification('Error adding emergency contact: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleRequestEmergencyAccess = async () => {
    try {
      await emergency.requestAccess(Number(emergencyForm.ownerUserId));
      showNotification('Emergency access request submitted!');
      setEmergencyForm(prev => ({ ...prev, ownerUserId: '' }));
      await loadProfile();
    } catch (err) {
      showNotification('Error requesting emergency access: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleEmergencyAction = async (action, requestId) => {
    try {
      if (action === 'approve') await emergency.approve(requestId);
      if (action === 'deny') await emergency.deny(requestId);
      if (action === 'revoke') await emergency.revoke(requestId);
      if (action === 'finalize') await emergency.finalizeAuto(requestId);
      showNotification(`Emergency request ${action}d successfully!`);
      await loadProfile();
    } catch (err) {
      showNotification('Error on emergency action: ' + (err.response?.data?.error || err.message), 'error');
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
      const userId = localStorage.getItem('userId') || localStorage.getItem('username');
      const totp = new OTPAuth.TOTP({
        issuer: 'PasswordManager',
        label: userId,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: new OTPAuth.Secret({ size: 20 })
      });
      const secret = totp.secret.base32;
      const otpauthUrl = totp.toString();
      const response = await auth.mfaSetup(secret, otpauthUrl);
      setMfaSetupData({ qrCode: response.data.qrCode, secret: secret });
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

  const activeHealthIds = healthFilter && passwordHealth?.byCategory?.[healthFilter]
    ? new Set(passwordHealth.byCategory[healthFilter].map(item => item.id))
    : null;

  const displayedPasswords = activeHealthIds
    ? passwordList.filter(p => activeHealthIds.has(p.id))
    : passwordList;

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
            <button
              className={activeTab === 'notes' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('notes')}
            >
              Notes
            </button>
          </div>

          <div className="actions-bar">
            <div>
              {activeTab === 'passwords' ? (
                <Link to={selectedFolder ? `/add?folder_id=${selectedFolder}` : `/add`}>
                  <button className="success">+ Add Password</button>
                </Link>
              ) : activeTab === 'cards' ? (
                <Link to={selectedFolder ? `/add-card?folder_id=${selectedFolder}` : `/add-card`}>
                  <button className="success">+ Add Card</button>
                </Link>
              ) : (
                <button className="success" onClick={openCreateNoteModal}>+ Add Note</button>
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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))',
              gap: '10px',
              marginBottom: '16px'
            }}>
              <div style={{ background: 'rgba(0, 240, 255, 0.08)', border: '1px solid rgba(0, 240, 255, 0.25)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Health Score</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#00f0ff' }}>
                  {healthLoading ? '...' : (passwordHealth?.summary?.score ?? 0)}
                </div>
              </div>

              {[
                { key: 'weak', label: 'Weak', color: '#f59e0b' },
                { key: 'reused', label: 'Reused', color: '#ef4444' },
                { key: 'old', label: 'Old (>180d)', color: '#f97316' }
              ].map(metric => (
                <button
                  key={metric.key}
                  onClick={() => setHealthFilter(prev => prev === metric.key ? '' : metric.key)}
                  style={{
                    textAlign: 'left',
                    background: healthFilter === metric.key ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${metric.color}55`,
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{metric.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: metric.color }}>
                    {healthLoading ? '...' : (passwordHealth?.summary?.[metric.key] ?? 0)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'passwords' && (
            displayedPasswords.length === 0 ? (
              <div className="empty-state">
                <p>{healthFilter ? 'No passwords match this health filter.' : 'No passwords found. Add your first password!'}</p>
              </div>
            ) : (
              <div className="password-list">
                {displayedPasswords.map(pwd => (
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
                      <button onClick={() => handleOpenHistory(pwd)} className="secondary">History</button>
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

          {activeTab === 'notes' && (
            noteList.length === 0 ? (
              <div className="empty-state">
                <p>No notes found. Add your first secure note!</p>
              </div>
            ) : (
              <div className="password-list">
                {noteList.map(note => (
                  <div key={note.id} className="password-card">
                    <div className="password-info">
                      <h3>{note.title}</h3>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{note.content}</p>
                    </div>
                    <div className="password-actions">
                      <button onClick={() => handleCopy(note.content)} className="secondary">Copy</button>
                      <button onClick={() => openEditNoteModal(note)} className="secondary">Edit</button>
                      <button onClick={() => handleDeleteNote(note.id)} className="danger">Delete</button>
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
                  {mfaSetupData.secret && (
                    <div style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', marginTop: '15px', wordBreak: 'break-all' }}>
                      <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>Or enter this secret manually:</p>
                      <strong style={{ color: '#00f0ff', fontSize: '14px' }}>{mfaSetupData.secret}</strong>
                    </div>
                  )}
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

            <div style={{ marginTop: '20px', padding: '15px', background: '#1a1a2e', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Active Sessions</h3>
                <button onClick={handleRevokeOthers} className="danger">Revoke all except current</button>
              </div>

              {sessionList.length === 0 ? (
                <p style={{ color: '#94a3b8', marginTop: '10px' }}>No active sessions found.</p>
              ) : (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sessionList.map(s => {
                    const isCurrent = currentSessionJti && s.token_jti === currentSessionJti && !s.revoked_at;
                    return (
                      <div key={s.id} style={{ border: '1px solid #334155', borderRadius: '8px', padding: '10px', background: 'rgba(15,23,42,0.6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <div>
                            <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                              {isCurrent ? '🟢 Current device' : 'Device session'}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                              {s.user_agent || 'Unknown agent'}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>
                              IP: {s.ip_address || '-'} • Created: {new Date(s.created_at).toLocaleString()}
                            </div>
                          </div>
                          {!isCurrent && !s.revoked_at && (
                            <button onClick={() => handleRevokeSession(s.id)} className="secondary">Revoke</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', padding: '15px', background: '#1a1a2e', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>Emergency Access</h3>

              <div className="form-group">
                <label>Add trusted contact (User ID)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={emergencyForm.contactUserId}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, contactUserId: e.target.value })}
                  >
                    <option value="">Select contact user</option>
                    {allUsers
                      .filter(u => Number(u.id) !== Number(localStorage.getItem('userId')))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.username} (#{u.id})</option>
                      ))}
                  </select>
                  <input
                    type="number"
                    value={emergencyForm.delayHours}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, delayHours: e.target.value })}
                    placeholder="Delay hours"
                    style={{ maxWidth: '140px' }}
                  />
                  <button onClick={handleAddEmergencyContact} className="success">Save</button>
                </div>
              </div>

              <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>Configured contacts:</div>
              {emergencyContacts.length === 0 ? (
                <p style={{ color: '#64748b' }}>No emergency contacts configured.</p>
              ) : (
                emergencyContacts.map(c => (
                  <div key={`${c.owner_user_id}-${c.contact_user_id}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>{c.contact_username} (id: {c.contact_user_id}) • delay: {c.delay_hours}h</span>
                    <button className="danger" onClick={async () => { await emergency.removeContact(c.contact_user_id); await loadProfile(); }}>Remove</button>
                  </div>
                ))
              )}

              <hr style={{ borderColor: '#334155', margin: '14px 0' }} />

              <div className="form-group">
                <label>Request access to owner (User ID)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={emergencyForm.ownerUserId}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, ownerUserId: e.target.value })}
                  >
                    <option value="">Select owner user</option>
                    {allUsers
                      .filter(u => Number(u.id) !== Number(localStorage.getItem('userId')))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.username} (#{u.id})</option>
                      ))}
                  </select>
                  <button onClick={handleRequestEmergencyAccess} className="secondary">Request</button>
                </div>
              </div>

              <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '8px' }}>Incoming requests:</div>
              {(emergencyIncoming || []).map(r => (
                <div key={`in-${r.id}`} style={{ border: '1px solid #334155', borderRadius: '8px', padding: '8px', marginTop: '6px' }}>
                  <div style={{ fontSize: '13px' }}>From: {r.contact_username} • status: {r.status}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    {r.status === 'pending' && <button className="success" onClick={() => handleEmergencyAction('approve', r.id)}>Approve</button>}
                    {r.status === 'pending' && <button className="secondary" onClick={() => handleEmergencyAction('deny', r.id)}>Deny</button>}
                    {(r.status === 'approved' || r.status === 'auto_granted') && <button className="danger" onClick={() => handleEmergencyAction('revoke', r.id)}>Revoke</button>}
                    {r.status === 'pending' && <button className="secondary" onClick={() => handleEmergencyAction('finalize', r.id)}>Finalize if ready</button>}
                  </div>
                </div>
              ))}

              <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '10px' }}>Your outgoing requests:</div>
              {(emergencyOutgoing || []).map(r => (
                <div key={`out-${r.id}`} style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  To owner {r.owner_username} • status: {r.status} • grant after: {r.grant_after ? new Date(r.grant_after).toLocaleString() : '-'}
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button onClick={handleUpdateProfile} className="success">Save</button>
              <button onClick={() => { setShowProfileModal(false); setMfaSetupData(null); setMfaCode(''); }} className="secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', zIndex: 3000
        }}>
          <div className="form-container" style={{ maxWidth: '760px', width: '95%', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2>Password History {selectedPasswordForHistory ? `- ${selectedPasswordForHistory.title}` : ''}</h2>

            {historyLoading ? (
              <p style={{ color: '#94a3b8' }}>Loading history...</p>
            ) : historyList.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No history versions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {historyList.map(version => (
                  <div key={version.id} style={{
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    padding: '12px',
                    background: 'rgba(15, 23, 42, 0.6)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{version.title}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(version.version_created_at).toLocaleString()} • {version.username || 'no username'}
                        </div>
                      </div>
                      <button onClick={() => handleRestoreHistory(version.id)} className="success">Restore</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '16px' }}>
              <button onClick={() => setShowHistoryModal(false)} className="secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', zIndex: 3000
        }}>
          <div className="form-container" style={{ maxWidth: '600px', width: '95%' }}>
            <h2>{editingNote ? 'Edit Note' : 'Add Secure Note'}</h2>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                placeholder="e.g., Recovery Codes"
              />
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="Write your secure note here..."
                style={{ minHeight: '160px' }}
              />
            </div>
            <div className="form-actions">
              <button onClick={handleSaveNote} className="success">{editingNote ? 'Save Changes' : 'Create Note'}</button>
              <button onClick={() => setShowNoteModal(false)} className="secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showCommandPalette && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', zIndex: 4000
        }} onClick={() => setShowCommandPalette(false)}>
          <div className="form-container" style={{ width: '720px', maxWidth: '95%' }} onClick={(e) => e.stopPropagation()}>
            <h2>Command Palette</h2>
            <input
              autoFocus
              type="text"
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              placeholder="Search passwords, cards, notes..."
            />
            <div style={{ marginTop: '12px', maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredPaletteEntries.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No results.</p>
              ) : filteredPaletteEntries.map(item => (
                <div key={`${item.type}-${item.id}`} style={{ border: '1px solid #334155', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{item.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>{item.type} • {item.subtitle}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="secondary" onClick={() => { item.onCopy(); setShowCommandPalette(false); }}>Copy</button>
                    <button className="success" onClick={() => { item.onOpen(); setShowCommandPalette(false); }}>Open</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="form-actions" style={{ marginTop: '12px' }}>
              <button className="secondary" onClick={() => setShowCommandPalette(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
