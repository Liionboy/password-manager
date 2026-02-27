import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { passwords, categories, folders as foldersApi } from '../api';

function PasswordForm({ token }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const folderIdFromUrl = searchParams.get('folder_id');
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    folder_id: folderIdFromUrl || '',
    category_id: '',
    notes: ''
  });
  const [categoryList, setCategoryList] = useState([]);
  const [folderList, setFolderList] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [genOptions, setGenOptions] = useState({ length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true });
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
    loadFolders();
    if (isEdit) {
      loadPassword();
    }
  }, [id]);

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

  const loadPassword = async () => {
    try {
      const response = await passwords.getAll(null, null, null, true);
      const pwd = response.data.find(p => p.id === parseInt(id));
      if (pwd) {
        setFormData({
          title: pwd.title,
          username: pwd.username || '',
          password: pwd.password || '',
          url: pwd.url || '',
          folder_id: pwd.folder_id || '',
          category_id: pwd.category_id || '',
          notes: pwd.notes || ''
        });
      }
    } catch (err) {
      console.error('Error loading password:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.password) {
      setError('Title and password are required');
      return;
    }

    try {
      const data = {
        title: formData.title,
        username: formData.username || null,
        password: formData.password || null,
        url: formData.url || null,
        folder_id: formData.folder_id || null,
        category_id: formData.category_id || null,
        notes: formData.notes || null
      };

      if (isEdit) {
        await passwords.update(id, data);
      } else {
        await passwords.create(data);
      }

      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving password');
    }
  };

  const handleGenerate = async () => {
    try {
      const response = await passwords.generate(genOptions);
      setFormData({ ...formData, password: response.data.password });
    } catch (err) {
      console.error('Error generating password:', err);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await categories.create(newCategory);
      setNewCategory('');
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating category');
    }
  };

  return (
    <div className="container">
      <div className="form-container">
        <h1>{isEdit ? 'Edit Password' : 'Add Password'}</h1>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Gmail, Facebook"
            />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g., john@example.com"
            />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <div className="password-display">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="secondary"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid #1e293b', borderRadius: '8px' }}>
              <p style={{ marginBottom: '15px', fontWeight: '500', color: '#00f0ff', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Generate Password:</p>
              <div className="checkbox-group">
                <label style={{ color: '#94a3b8' }}>
                  <input
                    type="number"
                    value={genOptions.length}
                    onChange={(e) => setGenOptions({ ...genOptions, length: parseInt(e.target.value) })}
                    min="4"
                    max="64"
                    style={{ width: '60px', marginRight: '5px' }}
                  />
                  Length
                </label>
                <label style={{ color: '#94a3b8' }}>
                  <input
                    type="checkbox"
                    checked={genOptions.uppercase}
                    onChange={(e) => setGenOptions({ ...genOptions, uppercase: e.target.checked })}
                  /> A-Z
                </label>
                <label style={{ color: '#94a3b8' }}>
                  <input
                    type="checkbox"
                    checked={genOptions.lowercase}
                    onChange={(e) => setGenOptions({ ...genOptions, lowercase: e.target.checked })}
                  /> a-z
                </label>
                <label style={{ color: '#94a3b8' }}>
                  <input
                    type="checkbox"
                    checked={genOptions.numbers}
                    onChange={(e) => setGenOptions({ ...genOptions, numbers: e.target.checked })}
                  /> 0-9
                </label>
                <label style={{ color: '#94a3b8' }}>
                  <input
                    type="checkbox"
                    checked={genOptions.symbols}
                    onChange={(e) => setGenOptions({ ...genOptions, symbols: e.target.checked })}
                  /> !@#
                </label>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="success"
                style={{ marginTop: '15px' }}
              >
                Generate
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>URL</label>
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handle