import { useAuthStore } from '../store/authStore';

const RAW_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export const apiFetch = async (endpoint, options = {}) => {
  const token = useAuthStore.getState().token;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        useAuthStore.getState().clearUser();
      }
      throw new Error(data.message || `Server error (${res.status})`);
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Backend server is offline or unreachable. Please start the Express server.');
    }
    throw err;
  }
};
