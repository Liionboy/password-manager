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
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  mfaSetup: () => api.post('/auth/mfa/setup'),
  mfaEnable: (code) => api.post('/auth/mfa/enable', { code }),
  mfaDisable: (code) => api.post('/auth/mfa/disable', { code }),
  mfaVerifyTemp: (code) => api.post('/auth/mfa/verify-temp', { code }),
  forgotPassword: (username) => api.post('/auth/forgot-password', JSON.stringify({ username }), { headers: { 'Content-Type': 'application/json' } }),
  resetPassword: (data) => api.post('/auth/reset-password', JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
};

export const passwords = {
  getAll: (search, categoryId, folderId) => api.get('/passwords', { params: { search, category_id: categoryId, folder_id: folderId } }),
  create: (data) => api.post('/passwords', data),
  update: (id, data) => api.put(`/passwords/${id}`, data),
  delete: (id) => api.delete(`/passwords/${id}`),
  generate: (options) => api.post('/passwords/generate', options),
  export: () => api.get('/passwords/export'),
  import: (passwords) => api.post('/passwords/import', { passwords }),
  share: (id, userId) => api.post(`/passwords/share/${id}`, { user_id: userId }),
  unshare: (id, userId) => api.delete(`/passwords/share/${id}?user_id=${userId}`),
  getShared: (id) => api.get(`/passwords/shared/${id}`)
};

export const categories = {
  getAll: () => api.get('/passwords/categories'),
  create: (name) => api.post('/passwords/categories', { name }),
  delete: (id) => api.delete(`/passwords/categories/${id}`)
};

export const cards = {
  getAll: (search, categoryId, folderId) => api.get('/cards', { params: { search, category_id: categoryId, folder_id: folderId } }),
  create: (data) => api.post('/cards', data),
  update: (id, data) => api.put(`/cards/${id}`, data),
  delete: (id) => api.delete(`/cards/${id}`)
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

export default api;
