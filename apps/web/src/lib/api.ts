import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const authData = localStorage.getItem('auth-storage');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        const token = parsed?.state?.accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          const refreshToken = parsed?.state?.refreshToken;

          if (refreshToken) {
            const response = await axios.post(
              `${api.defaults.baseURL}/auth/refresh`,
              { refreshToken }
            );

            const { accessToken, refreshToken: newRefreshToken } = response.data;

            // Update stored tokens
            parsed.state.accessToken = accessToken;
            parsed.state.refreshToken = newRefreshToken;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return api(originalRequest);
          }
        } catch (e) {
          // Clear auth data on refresh failure
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
};

// Clients
export const clientsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/clients', { params }),
  getById: (id: number) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: number, data: any) => api.put(`/clients/${id}`, data),
  getAccounts: (id: number) => api.get(`/clients/${id}/accounts`),
  getLoans: (id: number) => api.get(`/clients/${id}/loans`),
};

// Accounts
export const accountsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; clientId?: number }) =>
    api.get('/accounts', { params }),
  getById: (id: number) => api.get(`/accounts/${id}`),
  getBalance: (id: number) => api.get(`/accounts/${id}/balance`),
  getTransactions: (id: number, params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) =>
    api.get(`/accounts/${id}/transactions`, { params }),
  block: (id: number, raison: string) => api.post(`/accounts/${id}/block`, { raison }),
  unblock: (id: number) => api.post(`/accounts/${id}/unblock`),
};

// Transactions
export const transactionsApi = {
  deposit: (data: { accountId: number; amount: number; description?: string }) =>
    api.post('/transactions/deposit', data),
  withdraw: (data: { accountId: number; amount: number; description?: string }) =>
    api.post('/transactions/withdraw', data),
  transfer: (data: { fromAccountId: number; toAccountId: number; amount: number; description?: string }) =>
    api.post('/transactions/transfer', data),
};

// Loans
export const loansApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string; clientId?: number; search?: string }) =>
    api.get('/loans', { params }),
  getById: (id: number) => api.get(`/loans/${id}`),
  getSchedule: (id: number) => api.get(`/loans/${id}/schedule`),
  create: (data: any) => api.post('/loans', data),
  approve: (id: number, data: any) => api.put(`/loans/${id}/approve`, data),
  reject: (id: number, data: { motif: number; commentaire?: string }) =>
    api.put(`/loans/${id}/reject`, data),
  disburse: (id: number, accountId: number) =>
    api.put(`/loans/${id}/disburse`, { accountId }),
};

// Reports
export const reportsApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getPortfolio: () => api.get('/reports/portfolio'),
  getClients: (months?: number) => api.get('/reports/clients', { params: { months } }),
  getTransactions: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/reports/transactions', { params }),
};

export default api;
