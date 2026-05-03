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
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    if ((status === 401 || status === 403) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('unauthorized', { detail: { status, message } }));
    }
    return Promise.reject(new Error(message));
  }
);

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
};

export const ordersApi = {
  create: (data) => api.post('/orders', data),
  getByClient: (clientId, params) => api.get(`/orders/client/${clientId}`, { params }),
  getAll: (params) => api.get('/orders', { params }),
  confirm: (id) => api.post(`/orders/${id}/confirm`),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  invoiceLogistique: () => api.post('/orders/logistique/invoice'),
};

export default api;