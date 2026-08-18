import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useAuthStore = create(persist(
  (set, get) => ({
    user: null,
    token: null,
    rememberMe: false,
    setAuth: (user, token, rememberMe = false) => set({ user, token, rememberMe }),
    setUser: (user) => set({ user }),
    setRememberMe: (rememberMe) => set({ rememberMe }),
    clearUser: () => {
      set({ user: null, token: null })
      if (!get().rememberMe) {
        localStorage.removeItem('brgy_remembered_user')
      }
    },
  }),
  {
    name: 'brgy-auth',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ user: state.user, token: state.token, rememberMe: state.rememberMe }),
  }
))
