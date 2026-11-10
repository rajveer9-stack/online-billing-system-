
(function (global) {
  'use strict';
  const loc = global.location;
  const isLocalHost = ['localhost', '127.0.0.1', '[::1]', ''].includes(loc.hostname); 
  const servedByBackend =
    loc.port === '4000' || loc.protocol === 'https:' || (!isLocalHost && (loc.port === '' || loc.port === '80'));
  const API_BASE = global.ZENZY_API_BASE || (servedByBackend ? '/api' : 'http://localhost:4000/api');

  const TOKEN_KEY = 'zenzy.token';
  const USER_KEY = 'zenzy.user';

  class ApiError extends Error {
    constructor(message, { status = 0, code = 'NETWORK_ERROR', details } = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  const session = {
    getToken: () => localStorage.getItem(TOKEN_KEY),
    getUser: () => {
      try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    },
    isLoggedIn: () => Boolean(localStorage.getItem(TOKEN_KEY)),
    save(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  };

  function buildQuery(params) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      qs.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
  }

  async function request(path, { method = 'GET', query, body, headers = {}, auth = true } = {}) {
    const finalHeaders = { Accept: 'application/json', ...headers };
    if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
    if (auth && session.getToken()) finalHeaders.Authorization = `Bearer ${session.getToken()}`;

    let res;
    try {
      res = await fetch(API_BASE + path + buildQuery(query), {
        method,
        headers: finalHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('Cannot reach the server. Is the backend running (npm run dev)?');
    }

    if (res.ok && res.status === 204) return { data: null, meta: undefined }; 
    let json = null;
    try { json = await res.json(); } catch { }

    if (!res.ok || !json || json.success === false) {
      const err = new ApiError(json?.message || `Request failed (${res.status})`, {
        status: res.status,
        code: json?.code || 'REQUEST_FAILED',
        details: json?.details,
      });
      
      if (res.status === 401 && auth && path !== '/auth/login') {
        session.clear();
        global.dispatchEvent(new CustomEvent('zenzy:unauthorized'));
      }
      throw err;
    }
    return { data: json.data, meta: json.meta };
  }

  const unwrap = async (promise) => (await promise).data;

  const ZenzyAPI = {
    API_BASE,
    ApiError,
    session,

    auth: {
      async login(email, password) {
        const data = await unwrap(request('/auth/login', { method: 'POST', body: { email, password }, auth: false }));
        session.save(data.token, data.user);
        return data.user;
      },
      async register(payload) {
        const data = await unwrap(request('/auth/register', { method: 'POST', body: payload, auth: false }));
        session.save(data.token, data.user);
        return data.user;
      },
      async me() {
        const data = await unwrap(request('/auth/me'));
        return data.user;
      },
      logout: () => session.clear(),
    },

    products: {
     
      async list(params = {}) {
        const { data, meta } = await request('/products', { query: params, auth: false });
        return { items: data, meta };
      },
     
      async listAll(params = {}) {
        const all = [];
        let page = 1;
        for (;;) {
          const { items, meta } = await ZenzyAPI.products.list({ ...params, page, limit: 100 });
          all.push(...items);
          if (page >= meta.totalPages) return all;
          page += 1;
        }
      },
      get: (idOrCode) => unwrap(request(`/products/${encodeURIComponent(idOrCode)}`, { auth: false })),
      categories: () => unwrap(request('/products/categories', { auth: false })),
    },

    delivery: {
      
      estimate: ({ pincode, items, shippingMethod }) =>
        unwrap(request('/delivery/estimate', { query: { pincode, items, shippingMethod }, auth: false })),
    },

    orders: {
      
      quote: (body) => unwrap(request('/orders/quote', { method: 'POST', body })),
     
      create: (body, { idempotencyKey } = {}) =>
        unwrap(request('/orders', { method: 'POST', body, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} })),
      mine: (params) => request('/orders/mine', { query: params }).then((r) => ({ items: r.data, meta: r.meta })),
      get: (idOrNumber) => unwrap(request(`/orders/${encodeURIComponent(idOrNumber)}`)),
    },

    admin: {
      orders: (params) => request('/admin/orders', { query: params }).then((r) => ({ items: r.data, meta: r.meta })),
      updateOrderStatus: (id, status, note) =>
        unwrap(request(`/admin/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status, note } })),
      analytics: (params) => unwrap(request('/admin/analytics', { query: params })),
      createProduct: (body) => unwrap(request('/admin/products', { method: 'POST', body })),
      updateProduct: (id, body) => unwrap(request(`/admin/products/${id}`, { method: 'PATCH', body })),
      deleteProduct: (id) => unwrap(request(`/admin/products/${id}`, { method: 'DELETE' })),
     
      updateInventory: (updates) => unwrap(request('/admin/inventory', { method: 'PATCH', body: { updates } })),
      createUser: (body) => unwrap(request('/admin/users', { method: 'POST', body })),
    },
  };

  global.ZenzyAPI = ZenzyAPI;
})(window);
