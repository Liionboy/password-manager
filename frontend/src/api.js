import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  register: (username, password) => api.post('/auth/register', { username, password }),
  login: (username, password) => api.post('/auth/login', { username, password }),
  verify: () => api.get('/auth/verify')
};

export const passwords = {
  getAll: (search, categoryId) => api.get('/passwords', { params: { search, category_id: categoryId } }),
  create: (data) => api.post('/passwords', data),
  update: (id, data) => api.put(`/passwords/${id}`, data),
  delete: (id) => api.delete(`/passwords/${id}`),
  generate: (options) => api.post('/passwords/generate', options),
  export: () => api.get('/passwords/export'),
  import: (passwords) => api.post('/passwords/import', { passwords })
};

export const categories = {
  getAll: () => api.get('/passwords/categories'),
  create: (name) => api.post('/passwords/categories', { name }),
  delete: (id) => api.delete(`/passwords/categories/${id}`)
};

export const cards = {
  getAll: (search, categoryId) => api.get('/cards', { params: { search, category_id: categoryId } }),
  create: (data) => api.post('/cards', data),
  update: (id, data) => api.put(`/cards/${id}`, data),
  delete: (id) => api.delete(`/cards/${id}`)
};

export default api;
