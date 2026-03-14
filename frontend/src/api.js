import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  let token = localStorage.getItem('token');
  if (!token) {
    token = localStorage.getItem('tempToken');
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  register: (username, password) => api.post('/auth/register', JSON.stringify({ username, password }), { headers: { 'Content-Type': 'application/json' } }),
  login: (username, password) => api.post('/auth/login', JSON.stringify({ username, password }), { headers: { 'Content-Type': 'application/json' } }),
  verify: () => api.get('/auth/verify'),
  getUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  unlockUser: (id) => api.post(`/auth/users/${id}/unlock`),
  resetUserPassword: (id, newPassword) => api.post(`/auth/users/${id}/reset-password`, { newPassword }),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  mfaSetup: (secret, otpauthUrl) => api.post('/auth/mfa/setup', { secret, otpauth_url: otpauthUrl }),
  mfaEnable: (code) => api.post('/auth/mfa/enable', { code }),
  mfaDisable: (code) => api.post('/auth/mfa/disable', { code }),
  mfaVerifyTemp: (code) => {
    const tempToken = localStorage.getItem('tempToken');
    return api.post('/auth/mfa/verify-temp', { tempToken, code });
  },
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (id) => api.post(`/auth/sessions/${id}/revoke`),
  revokeOtherSessions: (refreshToken) => api.post('/auth/sessions/revoke-others', { refreshToken }),
  forgotPassword: (username) => api.post('/auth/forgot-password', JSON.stringify({ username }), { headers: { 'Content-Type': 'application/json' } }),
  resetPassword: (data) => api.post('/auth/reset-password', JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
};

export const passwords = {
  getAll: (search, categoryId, folderId, all = false) => api.get('/passwords', { params: { search, category_id: categoryId, folder_id: folderId, all } }),
  getHealth: () => api.get('/passwords/health'),
  getHistory: (id) => api.get(`/passwords/${id}/history`),
  restoreHistory: (id, historyId) => api.post(`/passwords/${id}/restore/${historyId}`),
  create: (data) => api.post('/passwords', data),
  update: (id, data) => api.put(`/passwords/${id}`, data),
  delete: (id) => api.delete(`/passwords/${id}`),
  generate: (options) => api.post('/passwords/generate', options),
  export: () => api.get('/passwords/export'),
  import: (passwords) => api.post('/passwords/import', { passwords })
};

export const categories = {
  getAll: () => api.get('/passwords/categories'),
  create: (name, isGlobal = true) => api.post('/passwords/categories', { name, is_global: isGlobal }),
  delete: (id) => api.delete(`/passwords/categories/${id}`)
};

export const cards = {
  getAll: (search, categoryId, folderId, all = false) => api.get('/cards', { params: { search, category_id: categoryId, folder_id: folderId, all } }),
  create: (data) => api.post('/cards', data),
  update: (id, data) => api.put(`/cards/${id}`, data),
  delete: (id) => api.delete(`/cards/${id}`)
};

export const notes = {
  getAll: (search) => api.get('/notes', { params: { search } }),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`)
};

export const folders = {
  getAll: () => api.get('/folders'),
  create: (data) => api.post('/folders', data),
  update: (id, data) => api.put(`/folders/${id}`, data),
  delete: (id) => api.delete(`/folders/${id}`)
};

export const teams = {
  getAll: () => api.get('/teams'),
  getAllAdmin: () => api.get('/teams/all'),
  create: (name) => api.post('/teams', { name }),
  join: (teamId) => api.post('/teams/join', { team_id: teamId }),
  getMembers: (teamId) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId, userId, role) => api.post(`/teams/${teamId}/members`, { user_id: userId, role }),
  removeMember: (teamId, userId) => api.delete(`/teams/${teamId}/members/${userId}`),
  delete: (teamId) => api.delete(`/teams/${teamId}`)
};

export const settings = {
  get: () => api.get('/settings'),
  save: (data) => api.put('/settings', data),
  testEmail: (data) => api.post('/settings/test-email', data)
};

export const emergency = {
  getContacts: () => api.get('/emergency/contacts'),
  addContact: (contactUserId, delayHours = 168) => api.post('/emergency/contacts', { contact_user_id: contactUserId, delay_hours: delayHours }),
  removeContact: (contactUserId) => api.delete(`/emergency/contacts/${contactUserId}`),
  requestAccess: (ownerUserId) => api.post('/emergency/requests', { owner_user_id: ownerUserId }),
  getIncoming: () => api.get('/emergency/requests/incoming'),
  getOutgoing: () => api.get('/emergency/requests/outgoing'),
  approve: (id) => api.post(`/emergency/requests/${id}/approve`),
  deny: (id) => api.post(`/emergency/requests/${id}/deny`),
  revoke: (id) => api.post(`/emergency/requests/${id}/revoke`),
  finalizeAuto: (id) => api.post(`/emergency/requests/${id}/finalize-auto`)
};

export const breach = {
  listEmails: () => api.get('/breach/emails'),
  addEmail: (email) => api.post('/breach/emails', { email }),
  removeEmail: (id) => api.delete(`/breach/emails/${id}`),
  listAlerts: () => api.get('/breach/alerts'),
  checkAlerts: () => api.post('/breach/alerts/check'),
  updateAlertStatus: (id, status) => api.post(`/breach/alerts/${id}/status`, { status })
};

export default api;
