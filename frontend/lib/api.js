import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('kounhany_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      config.headers['x-api-key'] = process.env.NEXT_PUBLIC_API_KEY || '';
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if ((status === 401 || status === 403) && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('kounhany_refresh_token');

      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (res.ok) {
            const { data } = await res.json();
            localStorage.setItem('kounhany_access_token', data.access_token);
            if (data.refresh_token) {
              localStorage.setItem('kounhany_refresh_token', data.refresh_token);
            }
            // Retry la requête originale avec le nouveau token
            error.config.headers.Authorization = `Bearer ${data.access_token}`;
            return api(error.config);
          }
        } catch {}
      }

      // Refresh échoué ou pas de refresh_token → logout
      window.dispatchEvent(new CustomEvent('unauthorized', { detail: { status, message } }));
    }

    return Promise.reject(new Error(message));
  }
);

export const kpisApi = {
  overview: (period = 'all') => api.get(`/kpis/overview?period=${period}`).then(r => r.data),
  alerts: () => api.get('/kpis/alerts').then(r => r.data),
  transactionsTrend: (days = 7) => api.get(`/kpis/transactions-trend?days=${days}`).then(r => r.data),
  recentTransactions: () => api.get('/kpis/recent-transactions').then(r => Array.isArray(r) ? r : r.data),
  allTransactions: () => api.get('/kpis/all-transactions').then(r => Array.isArray(r) ? r : r.data),
  allBalances: () => api.get('/kpis/all-balances').then(r => Array.isArray(r) ? r : r.data),
  clients: () => api.get('/clients').then(r => Array.isArray(r) ? r : r.data),
  orders: () => api.get('/orders').then(r => r?.orders || r?.data?.orders || []),
  allScores: () => api.get('/scoring').then(r => Array.isArray(r) ? r : r.data || []),
  clientScore: (clientId) => api.get(`/scoring/${clientId}`).then(r => r?.data || r),
};

export const clientsApi = {
  list: () => api.get('/clients'),
  getOne: (id) => api.get(`/clients/${id}`),
  getWallet: (id) => api.get(`/clients/${id}/wallet`),
};

export const walletApi = {
  balance: (clientId) => api.get(`/wallet/balance/${clientId}`),
  transactions: (clientId) => api.get(`/wallet/transactions/${clientId}`),
  checkAvailable: (data) => api.post('/wallet/check-available', data),
  block: (data) => api.post('/wallet/block', data),
  confirm: (data) => api.post('/wallet/confirm', data),
  pay: (data) => api.post('/wallet/pay', data),
  externalDebt: (data) => api.post('/wallet/external-debt', data),
  externalPayment: (data) => api.post('/wallet/external-payment', data),
  unblock: (data) => api.post('/wallet/unblock', data),
};

export const dolibarrApi = {
  status: () => api.get('/dolibarr/status'),
  invoices: () => api.get('/dolibarr/invoices'),
  clientInvoices: (clientId) => api.get(`/dolibarr/invoices/${clientId}`),
  sync: () => api.post('/dolibarr/sync'),
  supplierInvoices: (prestataireId) => api.get(`/dolibarr/supplier-invoices/${prestataireId}`),
};

export const ordersApi = {
  create: (data) => api.post('/orders', data),
  getByClient: (clientId, params) => api.get(`/orders/client/${clientId}`, { params }),
  getAll: (params) => api.get('/orders', { params }),
  confirm: (id) => api.post(`/orders/${id}/confirm`),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  invoiceLogistique: () => api.post('/orders/logistique/invoice'),
};

export const prestatairesApi = {
  list: () => api.get('/prestataires').then(r => Array.isArray(r) ? r : r.data || []),
  getOne: (id) => api.get(`/prestataires/${id}`).then(r => r?.data || r),
  getWallet: (id) => api.get(`/prestataires/${id}/wallet`).then(r => r?.data || r),
  getOrders: (id) => api.get(`/prestataires/${id}/orders`).then(r => Array.isArray(r) ? r : r.data || []),
  supplierInvoices: (prestataireId) => api.get(`/dolibarr/supplier-invoices/${prestataireId}`),
};

export const billingSchedulesApi = {
  list: () => api.get('/billing-schedules'),
  create: (data) => api.post('/billing-schedules', data),
  update: (id, data) => api.put(`/billing-schedules/${id}`, data),
  delete: (id) => api.delete(`/billing-schedules/${id}`),
  runNow: (id) => api.post(`/billing-schedules/${id}/run`),
};

export default api;