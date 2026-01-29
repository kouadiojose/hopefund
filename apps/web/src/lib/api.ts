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
  // Historique complet des transactions (tous comptes du client)
  getTransactions: (id: number, params?: { page?: number; limit?: number; all?: boolean }) =>
    api.get(`/clients/${id}/transactions`, { params }),
  // Historique complet des crédits avec détails de paiement
  getCreditHistory: (id: number) => api.get(`/clients/${id}/credit-history`),
};

// Accounts
export const accountsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; clientId?: number }) =>
    api.get('/accounts', { params }),
  getById: (id: number) => api.get(`/accounts/${id}`),
  getBalance: (id: number) => api.get(`/accounts/${id}/balance`),
  getTransactions: (id: number, params?: { page?: number; limit?: number; startDate?: string; endDate?: string; all?: boolean }) =>
    api.get(`/accounts/${id}/transactions`, { params }),
  block: (id: number, raison: string) => api.post(`/accounts/${id}/block`, { raison }),
  unblock: (id: number) => api.post(`/accounts/${id}/unblock`),
};

// Transactions
export const transactionsApi = {
  deposit: (data: { accountNumber: string; amount: number; description?: string }) =>
    api.post('/transactions/deposit', data),
  withdraw: (data: { accountNumber: string; amount: number; description?: string }) =>
    api.post('/transactions/withdraw', data),
  transfer: (data: { fromAccountNumber: string; toAccountNumber: string; amount: number; description?: string }) =>
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
  // Delinquent loans and schedules
  getDelinquent: (params?: { page?: number; limit?: number; daysOverdue?: number }) =>
    api.get('/loans/delinquent', { params }),
  getUpcomingSchedules: (params?: { days?: number; limit?: number }) =>
    api.get('/loans/schedule/upcoming', { params }),
  getDelinquentClients: (params?: { page?: number; limit?: number }) =>
    api.get('/loans/clients/delinquent', { params }),
  // Portfolio statistics for CEO
  getPortfolioStats: () => api.get('/loans/portfolio/stats'),
  // Generate schedule for existing loan without one
  generateSchedule: (id: number) => api.post(`/loans/${id}/generate-schedule`),
  // Mark loan as closed/paid off (for old loans without schedule)
  markClosed: (id: number, motif?: string) => api.put(`/loans/${id}/mark-closed`, { motif }),
  // Reopen a closed loan (if closed by mistake)
  reopen: (id: number, motif?: string) => api.put(`/loans/${id}/reopen`, { motif }),
};

// Reports
export const reportsApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getPortfolio: () => api.get('/reports/portfolio'),
  getClients: (months?: number) => api.get('/reports/clients', { params: { months } }),
  getTransactions: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/reports/transactions', { params }),
};

// Admin
export const adminApi = {
  // Users
  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; agencyId?: number }) =>
    api.get('/admin/users', { params }),
  getUserById: (id: number) => api.get(`/admin/users/${id}`),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: number, data: any) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  unlockUser: (id: number) => api.post(`/admin/users/${id}/unlock`),
  resetPassword: (id: number, newPassword: string) =>
    api.post(`/admin/users/${id}/reset-password`, { newPassword }),

  // Agencies
  getAgencies: () => api.get('/admin/agencies'),
  getAgencyById: (id: number) => api.get(`/admin/agencies/${id}`),
  createAgency: (data: any) => api.post('/admin/agencies', data),
  updateAgency: (id: number, data: any) => api.put(`/admin/agencies/${id}`, data),

  // Stats
  getStats: () => api.get('/admin/stats'),

  // Roles
  getRoles: () => api.get('/admin/roles'),
  createRole: (data: { code: string; label: string; description?: string; color?: string }) =>
    api.post('/admin/roles', data),
  updateRole: (code: string, data: { label?: string; description?: string; color?: string }) =>
    api.put(`/admin/roles/${code}`, data),
  deleteRole: (code: string) => api.delete(`/admin/roles/${code}`),

  // Clients management
  activateAllClients: () => api.post('/admin/clients/activate-all'),
  getDuplicates: () => api.get('/admin/clients/duplicates'),
  analyzeClient: (id: number) => api.get(`/admin/clients/${id}/full-analysis`),
  mergeClients: (sourceId: number, targetId: number) =>
    api.post('/admin/clients/merge', { sourceClientId: sourceId, targetClientId: targetId }),
};

// Permissions
export const permissionsApi = {
  // Permissions
  getAll: (params?: { module?: string; search?: string }) =>
    api.get('/permissions', { params }),
  getModules: () => api.get('/permissions/modules'),
  getById: (id: number) => api.get(`/permissions/${id}`),
  create: (data: any) => api.post('/permissions', data),
  update: (id: number, data: any) => api.put(`/permissions/${id}`, data),
  delete: (id: number) => api.delete(`/permissions/${id}`),

  // Role Permissions
  getRolePermissions: (role: string) => api.get(`/permissions/roles/${role}`),
  setRolePermissions: (role: string, permissionIds: number[]) =>
    api.put(`/permissions/roles/${role}`, { permissionIds }),
  addPermissionToRole: (role: string, permissionId: number) =>
    api.post(`/permissions/roles/${role}/add`, { permissionId }),
  removePermissionFromRole: (role: string, permissionId: number) =>
    api.delete(`/permissions/roles/${role}/remove/${permissionId}`),

  // Matrix
  getMatrix: () => api.get('/permissions/matrix'),
};

// Audit
export const auditApi = {
  getLogs: (params?: {
    page?: number;
    limit?: number;
    userId?: number;
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/audit', { params }),
  getStats: (days?: number) => api.get('/audit/stats', { params: { days } }),
  getActions: () => api.get('/audit/actions'),
  getEntities: () => api.get('/audit/entities'),
  getEntityHistory: (entity: string, id: string) => api.get(`/audit/entity/${entity}/${id}`),
  getUserActivity: (userId: number, params?: { page?: number; limit?: number }) =>
    api.get(`/audit/user/${userId}`, { params }),

  // Sessions
  getSessions: (params?: { page?: number; limit?: number; activeOnly?: boolean }) =>
    api.get('/audit/sessions', { params }),
  invalidateSession: (id: string) => api.delete(`/audit/sessions/${id}`),
  invalidateUserSessions: (userId: number) => api.delete(`/audit/sessions/user/${userId}`),
};

// Comptabilité (Accounting)
export const comptabiliteApi = {
  // Coffres forts (Vaults)
  getCoffresForts: async () => {
    const response = await api.get('/comptabilite/coffres');
    // Transform API response to expected format
    const data = response.data;
    return data.coffres?.map((c: any) => ({
      id_ag: c.id_ag,
      libel_ag: c.libelle,
      ville_ag: c.libelle,
      coffre_fort: c.solde_coffre,
    })) || [];
  },
  createTransfert: (data: any) => api.post('/comptabilite/virements', data),

  // Virements
  getVirements: async (params?: { page?: number; limit?: number; statut?: string }) => {
    const response = await api.get('/comptabilite/virements', { params });
    return response.data;
  },
  createVirement: (data: any) => api.post('/comptabilite/virements', data),
  validerVirement: (id: number) => api.post(`/comptabilite/virements/${id}/valider`),
  rejeterVirement: (id: number, motif: string) => api.post(`/comptabilite/virements/${id}/rejeter`, { motif }),

  // Plan comptable
  getPlanComptable: async () => {
    const response = await api.get('/comptabilite/plan');
    return response.data;
  },
  getCompte: (numero: string) => api.get(`/comptabilite/plan/${numero}`),
  createCompte: (data: any) => api.post('/comptabilite/plan', data),
  updateCompte: (numero: string, data: any) => api.put(`/comptabilite/plan/${numero}`, data),
  deleteCompte: (numero: string) => api.delete(`/comptabilite/plan/${numero}`),

  // Balance comptable
  getBalance: async (params?: { dateDebut?: string; dateFin?: string; agence?: string }) => {
    const response = await api.get('/comptabilite/balance', { params });
    return response.data;
  },

  // Grand livre
  getGrandLivre: async (params?: { dateDebut?: string; dateFin?: string; compte?: string; agence?: string }) => {
    const response = await api.get('/comptabilite/grand-livre', { params });
    return response.data;
  },

  // Journal comptable
  getJournal: async (params?: { dateDebut?: string; dateFin?: string; journal?: string; agence?: string }) => {
    const response = await api.get('/comptabilite/journal', { params });
    return response.data;
  },
  createEcriture: (data: any) => api.post('/comptabilite/journal', data),

  // Dépenses / Revenus
  getDepensesRevenus: async (params?: { dateDebut?: string; dateFin?: string; agence?: string; type?: string }) => {
    const response = await api.get('/comptabilite/depenses-revenus', { params });
    return response.data;
  },
  createDepense: (data: any) => api.post('/comptabilite/depense', data),
  createRevenu: (data: any) => api.post('/comptabilite/revenu', data),
};

// Caisse (Cash Management)
export const caisseApi = {
  // Session
  getCurrentSession: () => api.get('/caisse/session/current'),
  ouvrirCaisse: (decompte: any) => api.post('/caisse/session/ouvrir', { decompte }),
  fermerCaisse: (decompte: any) => api.post('/caisse/session/fermer', { decompte }),

  // Approvisionnement / Reversement
  demanderApprovisionnement: (data: { montant: number; devise?: string; decompte?: any; commentaire?: string }) =>
    api.post('/caisse/approvisionnement', data),
  demanderReversement: (data: { montant: number; devise?: string; decompte: any; commentaire?: string }) =>
    api.post('/caisse/reversement', data),

  // Validation (superviseur)
  getMouvementsPending: () => api.get('/caisse/mouvements/pending'),
  validerMouvement: (id: number) => api.post(`/caisse/mouvements/${id}/valider`),
  rejeterMouvement: (id: number, motif: string) => api.post(`/caisse/mouvements/${id}/rejeter`, { motif }),

  // Brouillard et historique
  getBrouillard: () => api.get('/caisse/brouillard'),
  getHistorique: (params?: { page?: number; limit?: number; dateDebut?: string; dateFin?: string }) =>
    api.get('/caisse/historique', { params }),

  // Caisse principale
  getCaissePrincipale: () => api.get('/caisse/principale'),
  updateCaissePrincipale: (data: any) => api.put('/caisse/principale', data),
};

export default api;
