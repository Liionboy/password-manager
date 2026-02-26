import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { teams, auth } from '../api';

function TeamManagement({ token }) {
  const navigate = useNavigate();
  const [userTeams, setUserTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [newTeam, setNewTeam] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const teamRes = await teams.getAll();
      setUserTeams(teamRes.data);
      
      const adminRes = await auth.getUsers();
      setUsers(adminRes.data);
      
      const myUser = adminRes.data.find(u => u.username === localStorage.getItem('username'));
      if (myUser && myUser.role === 'admin') {
        setIsAdmin(true);
        const allTeamsRes = await teams.getAllAdmin();
        setAllTeams(allTeamsRes.data);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await teams.create(newTeam);
      setSuccess('Team created successfully!');
      setNewTeam('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating team');
    }
  };

  const handleJoinTeam = async (teamId) => {
    try {
      await teams.join(teamId);
      setSuccess('Joined team successfully!');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error joining team');
    }
  };

  const handleRemoveMember = async (teamId, userId) => {
    if (!window.confirm('Remove this user from team?')) return;
    
    try {
      await teams.removeMember(teamId, userId);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error removing member');
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
            <h1>Team Management</h1>
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
          <h2>Create New Team</h2>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          
          <form onSubmit={handleCreateTeam}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label>Team Name</label>
                <input
                  type="text"
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  placeholder="e.g., Marketing, IT, Finance"
                  required
                />
              </div>
              <button type="submit" className="success">Create</button>
            </div>
          </form>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h2 style={{ marginBottom: '20px' }}>Your Teams</h2>
          <div className="password-list">
            {userTeams.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>You are not in any team yet.</p>
            ) : (
              userTeams.map(team => (
                <div key={team.id} className="password-card">
                  <div className="password-info">
                    <h3>👥 {team.name}</h3>
                    <p>Your role: <span style={{ color: team.user_role === 'admin' ? '#00f0ff' : '#94a3b8' }}>{team.user_role}</span></p>
                  </div>
                  {team.user_role === 'admin' && (
                    <div className="password-actions">
                      <button onClick={async () => {
                        const members = await teams.getMembers(team.id);
                        alert(members.data.map(m => `${m.username} (${m.role})`).join('\n'));
                      }} className="secondary">View Members</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {isAdmin && allTeams.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <h2 style={{ marginBottom: '20px' }}>All Teams</h2>
            <div className="password-list">
              {allTeams.map(team => (
                <div key={team.id} className="password-card">
                  <div className="password-info">
                    <h3>👥 {team.name}</h3>
                    <p>Members: {team.member_count}</p>
                  </div>
                  <div className="password-actions">
                    <button onClick={async () => {
                      const members = await teams.getMembers(team.id);
                      alert(members.data.map(m => `${m.username} (${m.role})`).join('\n'));
                    }} className="secondary">View Members</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamManagement;
