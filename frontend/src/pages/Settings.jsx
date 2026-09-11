import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settings as settingsApi } from '../api';

function Settings({ token }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    smtp_source: 'database',
    notify_on_add: false,
    notify_on_update: false,
    notify_on_delete: false
  });
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.get();
      const data = response.data;
      setFormData({
        smtp_source: data.smtp_source || 'database',
        notify_on_add: Boolean(data.notify_on_add),
        notify_on_update: Boolean(data.notify_on_update),
        notify_on_delete: Boolean(data.notify_on_delete)
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
      // SMTP transport is managed by the server environment. Only persist
      // notification preferences from this screen.
      await settingsApi.save({
        notify_on_add: formData.notify_on_add,
        notify_on_update: formData.notify_on_update,
        notify_on_delete: formData.notify_on_delete
      });
      setMessage('Settings saved successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving settings');
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setError('');
    setMessage('');

    try {
      // The backend resolves SMTP from the server-side environment/database.
      await settingsApi.testEmail();
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
          <div className="smtp-managed-banner" role="status">
            <strong>Email server managed by administrator</strong>
            <span>
              SMTP connection details are kept securely on the server and are not editable in this application.
              {formData.smtp_source === 'environment'
                ? ' The active configuration comes from the server environment.'
                : ' Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in the server .env file.'}
            </span>
          </div>
          <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '14px' }}>
            Use the button below to verify the server-side email configuration.
          </p>

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
