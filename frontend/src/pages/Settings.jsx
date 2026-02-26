import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settings as settingsApi } from '../api';

function Settings({ token }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from: '',
    notify_on_add: false,
    notify_on_update: false,
    notify_on_delete: false,
    is_global: false
  });
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [role, setRole] = useState(localStorage.getItem('role'));

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.get();
      const data = response.data;
      setFormData({
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || '',
        smtp_password: data.smtp_password || '',
        smtp_from: data.smtp_from || '',
        notify_on_add: Boolean(data.notify_on_add),
        notify_on_update: Boolean(data.notify_on_update),
        notify_on_delete: Boolean(data.notify_on_delete),
        is_global: data.is_global || false
      });
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await settingsApi.save(formData);
      setMessage('Settings saved successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving settings');
    }
  };

  const handleTestEmail = async () => {
    if (!formData.smtp_host || !formData.smtp_user || !formData.smtp_password || !formData.smtp_from) {
      setError('Please fill in all SMTP fields before testing');
      return;
    }

    setTesting(true);
    setError('');
    setMessage('');

    try {
      await settingsApi.testEmail({
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_user: formData.smtp_user,
        smtp_password: formData.smtp_password,
        smtp_from: formData.smtp_from
      });
      setMessage('Test email sent! Check your inbox.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container">
      <div className="form-container">
        <h1>Settings</h1>
        
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <h2>SMTP Email Settings</h2>
          <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '14px' }}>
            Configure your SMTP server to receive email notifications when passwords or cards are added, updated, or deleted.
          </p>

          <div className="form-group">
            <label>SMTP Host</label>
            <input
              type="text"
              name="smtp_host"
              value={formData.smtp_host}
              onChange={handleChange}
              placeholder="smtp.gmail.com"
            />
          </div>

          <div className="form-group">
            <label>SMTP Port</label>
            <input
              type="number"
              name="smtp_port"
              value={formData.smtp_port}
              onChange={handleChange}
              placeholder="587"
              style={{ width: '100px' }}
            />
          </div>

          <div className="form-group">
            <label>SMTP Username / Email</label>
            <input
              type="text"
              name="smtp_user"
              value={formData.smtp_user}
              onChange={handleChange}
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label>SMTP Password / App Password</label>
            <input
              type="password"
              name="smtp_password"
              value={formData.smtp_password}
              onChange={handleChange}
              placeholder="Your app password"
            />
            <small style={{ color: '#64748b', fontSize: '12px' }}>For Gmail, use an App Password (16 characters)</small>
          </div>

          <div className="form-group">
            <label>From Email Address</label>
            <input
              type="email"
              name="smtp_from"
              value={formData.smtp_from}
              onChange={handleChange}
              placeholder="Password Manager <your@email.com>"
            />
          </div>

          {role === 'admin' && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="is_global"
                  checked={formData.is_global}
                  onChange={handleChange}
                />
                <strong>Global SMTP</strong> - Use for all users (recommended)
              </label>
              <small style={{ color: '#64748b', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                When enabled, this SMTP configuration will be used for email notifications for all users
              </small>
            </div>
          )}

          <div className="form-group">
            <button type="button" onClick={handleTestEmail} className="secondary" disabled={testing}>
              {testing ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>

          <h2 style={{ marginTop: '30px' }}>Email Notifications</h2>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="notify_on_add"
                checked={formData.notify_on_add}
                onChange={handleChange}
              />
              Notify when password/card is added
            </label>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="notify_on_update"
                checked={formData.notify_on_update}
                onChange={handleChange}
              />
              Notify when password/card is updated
            </label>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="notify_on_delete"
                checked={formData.notify_on_delete}
                onChange={handleChange}
              />
              Notify when password/card is deleted
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="success">Save Settings</button>
            <button type="button" onClick={() => navigate('/')} className="secondary">Back</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings;
