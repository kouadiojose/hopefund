import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

export interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  agenceId?: number;
  name?: string; // Computed from nom + prenom
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password,
          });

          const { user, accessToken, refreshToken } = response.data;

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Set default auth header
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || 'Erreur de connexion',
          });
          throw error;
        }
      },

      logout: async () => {
        const { refreshToken } = get();

        try {
          await axios.post(`${API_URL}/auth/logout`, { refreshToken });
        } catch (error) {
          console.error('Logout error:', error);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });

        delete axios.defaults.headers.common['Authorization'];
      },

      refresh: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          set({ isAuthenticated: false });
          return;
        }

        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;

          set({
            accessToken,
            refreshToken: newRefreshToken,
          });

          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        } catch (error) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Axios interceptor for token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip interceptor for auth endpoints (login, logout, refresh)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') ||
                           originalRequest?.url?.includes('/auth/logout') ||
                           originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        await useAuthStore.getState().refresh();
        const { accessToken } = useAuthStore.getState();
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Set initial auth header if token exists
const { accessToken } = useAuthStore.getState();
if (accessToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
}
