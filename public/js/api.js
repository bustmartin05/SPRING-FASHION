/**
 * CLIENTE API REST CENTRALIZADO
 * Conecta el frontend con todos los endpoints del backend Express, SQLite, Supabase y dLocal Go
 */

const API = {
  TOKEN_KEY: 'sf_admin_token',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  removeToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error en la petición al servidor.');
      }
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al subir archivo');
    return data;
  },

  // Auth
  auth: {
    login: (username, password) => API.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => API.request('/api/auth/me', { method: 'GET' })
  },

  // Event & Config
  events: {
    getActive: () => API.request('/api/events/active', { method: 'GET' }),
    getAdminConfig: () => API.request('/api/events/admin-config', { method: 'GET' }),
    update: (id, data) => API.request(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggleSection: (section) => API.request(`/api/events/toggle-section/${section}`, { method: 'PUT' })
  },

  // Tickets & Sales
  tickets: {
    getTiers: () => API.request('/api/tickets/tiers', { method: 'GET' }),
    getAllTiersAdmin: () => API.request('/api/tickets/tiers/all', { method: 'GET' }),
    updateTier: (id, data) => API.request(`/api/tickets/tiers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    createTier: (data) => API.request('/api/tickets/tiers', { method: 'POST', body: JSON.stringify(data) }),
    checkout: (data) => API.request('/api/tickets/checkout', { method: 'POST', body: JSON.stringify(data) }),
    getSales: () => API.request('/api/tickets/sales', { method: 'GET' })
  },

  // dLocal Go Payments
  payments: {
    createDLocalCheckout: (data) => API.request('/api/payments/dlocal/create-checkout', { method: 'POST', body: JSON.stringify(data) })
  },

  // Promoters / Vendedores / RRPP (Split Payments)
  promoters: {
    getAll: () => API.request('/api/promoters', { method: 'GET' }),
    create: (data) => API.request('/api/promoters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => API.request(`/api/promoters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => API.request(`/api/promoters/${id}`, { method: 'DELETE' }),
    validate: (code) => API.request(`/api/promoters/validate/${encodeURIComponent(code)}`, { method: 'GET' })
  },

  // Expenses & Categories (CRUD)
  expenses: {
    getCategories: () => API.request('/api/expenses/categories', { method: 'GET' }),
    createCategory: (data) => API.request('/api/expenses/categories', { method: 'POST', body: JSON.stringify(data) }),
    getProviders: () => API.request('/api/expenses/providers', { method: 'GET' }),
    createProvider: (data) => API.request('/api/expenses/providers', { method: 'POST', body: JSON.stringify(data) }),
    updateProvider: (id, data) => API.request(`/api/expenses/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProvider: (id) => API.request(`/api/expenses/providers/${id}`, { method: 'DELETE' })
  },

  // Sponsors & B2B
  sponsors: {
    getApproved: () => API.request('/api/sponsors', { method: 'GET' }),
    getAllAdmin: () => API.request('/api/sponsors/all', { method: 'GET' }),
    apply: (data) => API.request('/api/sponsors/apply', { method: 'POST', body: JSON.stringify(data) }),
    create: (data) => API.request('/api/sponsors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => API.request(`/api/sponsors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => API.request(`/api/sponsors/${id}`, { method: 'DELETE' }),
    staffApply: (data) => API.request('/api/b2b/staff-apply', { method: 'POST', body: JSON.stringify(data) })
  },

  // Gallery
  gallery: {
    getItems: (category) => API.request(`/api/gallery${category ? `?category=${category}` : ''}`, { method: 'GET' }),
    create: (data) => API.request('/api/gallery', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => API.request(`/api/gallery/${id}`, { method: 'DELETE' })
  },

  // Roadmap
  roadmap: {
    getSteps: () => API.request('/api/roadmap', { method: 'GET' }),
    toggleStep: (id) => API.request(`/api/roadmap/${id}/toggle`, { method: 'PUT' })
  },

  // Feedback / Testimonials
  feedback: {
    getApproved: () => API.request('/api/feedback/approved', { method: 'GET' }),
    getAllAdmin: () => API.request('/api/feedback/all', { method: 'GET' }),
    submit: (data) => API.request('/api/feedback', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, is_approved) => API.request(`/api/feedback/${id}/status`, { method: 'PUT', body: JSON.stringify({ is_approved }) }),
    delete: (id) => API.request(`/api/feedback/${id}`, { method: 'DELETE' })
  },

  // Experiences
  experiences: {
    getActive: () => API.request('/api/experiences', { method: 'GET' }),
    getAllAdmin: () => API.request('/api/experiences/all', { method: 'GET' }),
    create: (data) => API.request('/api/experiences', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => API.request(`/api/experiences/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => API.request(`/api/experiences/${id}`, { method: 'DELETE' })
  },

  // Artists & Lineup
  artists: {
    getActive: () => API.request('/api/artists', { method: 'GET' }),
    getAllAdmin: () => API.request('/api/artists/all', { method: 'GET' }),
    create: (data) => API.request('/api/artists', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => API.request(`/api/artists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => API.request(`/api/artists/${id}`, { method: 'DELETE' })
  },

  // Financial Stats & Live Calculator
  stats: {
    getFinancial: () => API.request('/api/stats/financial', { method: 'GET' })
  }
};
