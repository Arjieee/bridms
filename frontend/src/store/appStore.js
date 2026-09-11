import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './authStore';
import { apiFetch } from '../api/client';

const SEED_CATEGORIES = [
  { id: 1, name: 'Food', icon: 'fa-wheat-awn', color: '#16a34a' },
  { id: 2, name: 'Non-Food', icon: 'fa-box', color: '#2563eb' },
  { id: 3, name: 'Medicine', icon: 'fa-pills', color: '#dc2626' },
  { id: 4, name: 'Hygiene', icon: 'fa-soap', color: '#7c3aed' },
  { id: 5, name: 'Clothing', icon: 'fa-shirt', color: '#d97706' },
];

const SEED_STANDARD_PACKAGES = {
  household: [
    { item_id: 1, item_name: 'Rice', quantity: 25, unit: 'kg' },
    { item_id: 2, item_name: 'Canned Sardines', quantity: 5, unit: 'cans' },
    { item_id: 3, item_name: 'Canned Corned Beef', quantity: 3, unit: 'cans' },
    { item_id: 4, item_name: 'Instant Noodles', quantity: 5, unit: 'packs' },
    { item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 6, unit: 'bottles' },
  ],
  pwd: [
    { item_id: 1, item_name: 'Rice', quantity: 12.5, unit: 'kg' },
    { item_id: 2, item_name: 'Canned Sardines', quantity: 3, unit: 'cans' },
    { item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
    { item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 6, unit: 'bottles' },
  ],
  senior: [
    { item_id: 1, item_name: 'Rice', quantity: 12.5, unit: 'kg' },
    { item_id: 9, item_name: 'Paracetamol', quantity: 1, unit: 'boxes' },
    { item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 6, unit: 'bottles' },
  ],
  osy: [
    { item_id: 1, item_name: 'Rice', quantity: 12.5, unit: 'kg' },
    { item_id: 4, item_name: 'Instant Noodles', quantity: 3, unit: 'packs' },
    { item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 6, unit: 'bottles' },
  ],
  solo_parent: [
    { item_id: 1, item_name: 'Rice', quantity: 25, unit: 'kg' },
    { item_id: 2, item_name: 'Canned Sardines', quantity: 5, unit: 'cans' },
    { item_id: 4, item_name: 'Instant Noodles', quantity: 5, unit: 'packs' },
    { item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
  ],
  teenage_mom: [
    { item_id: 1, item_name: 'Rice', quantity: 12.5, unit: 'kg' },
    { item_id: 2, item_name: 'Canned Sardines', quantity: 3, unit: 'cans' },
    { item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
  ],
  emergency: [
    { item_id: 1, item_name: 'Rice', quantity: 25, unit: 'kg' },
    { item_id: 2, item_name: 'Canned Sardines', quantity: 5, unit: 'cans' },
    { item_id: 4, item_name: 'Instant Noodles', quantity: 5, unit: 'packs' },
    { item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 12, unit: 'bottles' },
    { item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
    { item_id: 10, item_name: 'Blanket', quantity: 1, unit: 'pcs' },
  ],
};

const SEED_PUROKS = [
  { id: 1, name: 'Purok 1', is_active: true, is_archived: false },
  { id: 2, name: 'Purok 2', is_active: true, is_archived: false },
  { id: 3, name: 'Purok 3', is_active: true, is_archived: false },
  { id: 4, name: 'Purok 4', is_active: true, is_archived: false },
  { id: 5, name: 'Purok 5', is_active: true, is_archived: false },
];

// Clean up any legacy mock data cached in browser localStorage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('brgy-puerto-data-v2');
  } catch (e) {}
}

export const useAppStore = create((set, get) => ({
  accounts: [],
  puroks: SEED_PUROKS,
  sectors: [],
  categories: SEED_CATEGORIES,
  inventory: [],
  households: [],
  pendingRegistrations: [],
  cycles: [],
  qrCodes: [],
  distributions: [],
  suppliers: [],
  notifications: [],
  activityLogs: [],
  standardPackages: SEED_STANDARD_PACKAGES,
  pendingMemberStatusChanges: [],
  pendingMemberAdditions: [],
  passwordResets: [],

  // --- Sync Initial Data from Backend ---
  fetchInitialData: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      const [
        purokRes,
        sectorRes,
        invRes,
        hhRes,
        cycleRes,
        qrRes,
        distRes,
        supRes,
        notifRes,
        statusRes,
      ] = await Promise.all([
        apiFetch('/settings/puroks').catch(() => ({ puroks: [] })),
        apiFetch('/settings/sectors').catch(() => ({ sectors: [], standardPackages: SEED_STANDARD_PACKAGES })),
        apiFetch('/inventory').catch(() => ({ inventory: [] })),
        apiFetch('/households').catch(() => ({ households: [] })),
        apiFetch('/cycles').catch(() => ({ cycles: [] })),
        apiFetch('/qrcodes').catch(() => ({ qrCodes: [] })),
        apiFetch('/distributions').catch(() => ({ distributions: [] })),
        apiFetch('/suppliers').catch(() => ({ suppliers: [] })),
        apiFetch('/notifications/me').catch(() => ({ notifications: [] })),
        apiFetch('/status-changes').catch(() => ({ pendingMemberStatusChanges: [] })),
      ]);

      set((s) => ({
        puroks: Array.isArray(purokRes.puroks) ? purokRes.puroks : s.puroks,
        sectors: Array.isArray(sectorRes.sectors) ? sectorRes.sectors : s.sectors,
        standardPackages: sectorRes.standardPackages ? { ...SEED_STANDARD_PACKAGES, ...sectorRes.standardPackages } : s.standardPackages,
        inventory: Array.isArray(invRes.inventory) ? invRes.inventory : [],
        households: Array.isArray(hhRes.households) ? hhRes.households : [],
        cycles: Array.isArray(cycleRes.cycles) ? cycleRes.cycles : [],
        qrCodes: Array.isArray(qrRes.qrCodes) ? qrRes.qrCodes : [],
        distributions: Array.isArray(distRes.distributions) ? distRes.distributions : [],
        suppliers: Array.isArray(supRes.suppliers) ? supRes.suppliers : [],
        notifications: Array.isArray(notifRes.notifications) ? notifRes.notifications : [],
        pendingMemberStatusChanges: Array.isArray(statusRes.pendingMemberStatusChanges) ? statusRes.pendingMemberStatusChanges : [],
      }));

      // Fetch admin-only collections if role is admin
      if (user.role === 'admin') {
        const [accRes, pendingRes, actRes] = await Promise.all([
          apiFetch('/accounts').catch(() => ({ accounts: [] })),
          apiFetch('/households/pending').catch(() => ({ pendingRegistrations: [] })),
          apiFetch('/settings/activity').catch(() => ({ activityLogs: [] })),
        ]);

        set({
          accounts: Array.isArray(accRes.accounts) ? accRes.accounts : [],
          pendingRegistrations: Array.isArray(pendingRes.pendingRegistrations) ? pendingRes.pendingRegistrations : [],
          activityLogs: Array.isArray(actRes.activityLogs) ? actRes.activityLogs : [],
        });
      }
    } catch (err) {
      console.error('Failed to sync initial data from backend:', err);
    }
  },

      // --- Authentication ---
      login: async (username, password, role, rememberMe = false) => {
        try {
          const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password, role }),
          });

          if (data.ok && data.token && data.user) {
            useAuthStore.getState().setAuth(data.user, data.token, rememberMe);
            await get().fetchInitialData();
            return true;
          }
          return false;
        } catch (err) {
          console.error('Login API error:', err);
          throw err;
        }
      },

      logout: async () => {
        try {
          await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
        } finally {
          useAuthStore.getState().clearUser();
          set({
            accounts: [],
            households: [],
            pendingRegistrations: [],
            cycles: [],
            qrCodes: [],
            distributions: [],
            suppliers: [],
            notifications: [],
            activityLogs: [],
            pendingMemberStatusChanges: [],
          });
        }
      },

      updateMyProfile: async (data) => {
        const u = useAuthStore.getState().user;
        if (!u) return false;
        try {
          const res = await apiFetch(`/accounts/${u.id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
          });
          if (res.ok && res.account) {
            useAuthStore.getState().setUser(res.account);
            await get().fetchInitialData();
            return true;
          }
        } catch (err) {
          console.error(err);
        }
        return false;
      },

      changeMyPassword: async (currentPassword, newPassword) => {
        const u = useAuthStore.getState().user;
        if (!u) return { ok: false, message: 'Not logged in.' };
        try {
          const res = await apiFetch(`/accounts/${u.id}`, {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          if (res.ok) {
            return { ok: true };
          }
          return { ok: false, message: res.message || 'Password update failed.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      addPurok: async (data) => {
        try {
          const res = await apiFetch('/settings/puroks', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message || 'Purok added successfully.' };
          }
          return { ok: false, message: res.message || 'Failed to add purok.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      updatePurok: async (id, name) => {
        try {
          const res = await apiFetch(`/settings/puroks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message || 'Purok updated successfully.' };
          }
          return { ok: false, message: res.message || 'Failed to update purok.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      deletePurok: async (id) => {
        try {
          const res = await apiFetch(`/settings/puroks/${id}`, { method: 'DELETE' });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message || 'Purok archived successfully.' };
          }
          return { ok: false, message: res.message || 'Failed to archive purok.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      restorePurok: async (id) => {
        try {
          const res = await apiFetch(`/settings/puroks/${id}/restore`, { method: 'PUT' });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message || 'Purok restored successfully.' };
          }
          return { ok: false, message: res.message || 'Failed to restore purok.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      fetchPuroks: async () => {
        try {
          const res = await apiFetch('/settings/puroks').catch(() => ({ puroks: [] }));
          if (Array.isArray(res.puroks) && res.puroks.length > 0) {
            set({ puroks: res.puroks });
            return res.puroks;
          }
        } catch (err) {
          console.error('Failed to fetch puroks:', err);
        }
        return get().puroks;
      },

      addSector: async (data) => {
        try {
          const res = await apiFetch('/settings/sectors', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, code: res.code };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      addCategory: (data) => {
        const id = Math.max(0, ...get().categories.map((c) => c.id)) + 1;
        set((s) => ({ categories: [...s.categories, { id, ...data }] }));
      },

      // --- Inventory ---
      addInventoryItem: async (item) => {
        try {
          const res = await apiFetch('/inventory', {
            method: 'POST',
            body: JSON.stringify(item),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return res;
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      adjustStock: async (itemId, qty, type, remarks) => {
        try {
          const endpoint = type === 'in' ? `/inventory/${itemId}/stock-in` : `/inventory/${itemId}/stock-out`;
          const res = await apiFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify({ quantity: qty, remarks }),
          });
          if (res.ok) await get().fetchInitialData();
        } catch (err) {
          console.error(err);
        }
      },

      updateStandardPackage: (cycleType, items) =>
        set((s) => ({ standardPackages: { ...s.standardPackages, [cycleType]: items } })),

      // --- Households & Registration ---
      addPendingReg: async (data) => {
        try {
          const res = await apiFetch('/households', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          if (res.ok && res.registration) {
            return res.registration;
          }
          throw new Error(res.message || 'Registration failed');
        } catch (err) {
          console.error('Registration API Error:', err);
          throw err;
        }
      },

      approveRegistration: async (regId) => {
        try {
          const res = await apiFetch(`/households/${regId}/approve`, { method: 'POST' });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, household: res.household, account: res.account };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      rejectRegistration: async (regId, reason) => {
        try {
          const res = await apiFetch(`/households/${regId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message || 'Registration rejected successfully.' };
          }
          return { ok: false, message: res.message || 'Failed to reject registration.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      // --- Cycles ---
      createCycle: async (data) => {
        try {
          const res = await apiFetch('/cycles', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message, cycle: res.cycle, qrCount: res.qrCount };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      deactivateCycle: async (cycleId) => {
        try {
          const res = await apiFetch(`/cycles/${cycleId}/deactivate`, { method: 'PUT' });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message || 'Cycle deactivated.' };
          }
          return { ok: false, message: res.message || 'Failed to deactivate cycle.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      reactivateCycle: async (cycleId) => {
        try {
          const res = await apiFetch(`/cycles/${cycleId}/activate`, { method: 'PUT' });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      addStaffAccount: async (data) => {
        try {
          const res = await apiFetch('/accounts', {
            method: 'POST',
            body: JSON.stringify({ ...data, role: 'staff' }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, account: res.account };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      toggleAccountActive: async (accountId) => {
        const target = get().accounts.find((a) => a.id === accountId);
        if (!target) return;
        try {
          const res = await apiFetch(`/accounts/${accountId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: !target.is_active }),
          });
          if (res.ok) await get().fetchInitialData();
        } catch (err) {
          console.error(err);
        }
      },

      // --- QR Verification & Scanning ---
      scanQR: async (token) => {
        try {
          let cleanToken = (token || '').trim();
          if (cleanToken.startsWith('BPR-SECURED::')) {
            cleanToken = cleanToken.replace('BPR-SECURED::', '').trim();
          }
          const res = await apiFetch(`/qrcodes/${encodeURIComponent(cleanToken)}`);
          return res;
        } catch (err) {
          return { status: 'error', message: err.message };
        }
      },

      claimQR: async (qrId) => {
        try {
          const claimRes = await apiFetch(`/qrcodes/${qrId}/claim`, { method: 'PUT' });
          if (claimRes.ok) {
            await get().fetchInitialData();
            return { ok: true, message: claimRes.message, distribution: claimRes.distribution };
          }
          return { ok: false, message: claimRes.message || 'Failed to claim QR.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      addManualDistribution: async (data) => {
        try {
          const res = await apiFetch('/distributions', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, dist_code: res.dist_code };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      addSupplier: async (data) => {
        try {
          const res = await apiFetch('/suppliers', {
            method: 'POST',
            body: JSON.stringify({
              ...data,
              items: (data.items || []).map(i => ({ ...i, fulfilled: false }))
            }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, supplier: res.supplier, message: res.message || 'Supplier added successfully.' };
          }
          return { ok: false, message: res.message || 'Failed to add supplier.' };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      fulfillDonationTask: async (supplierId, itemIndex, targetItemId, addQuantity) => {
        try {
          if (targetItemId && addQuantity > 0) {
            await get().adjustStock(targetItemId, addQuantity, 'in', 'Donated item restocked into inventory');
          }
          await apiFetch(`/suppliers/${supplierId}/items/${itemIndex}/fulfill`, { method: 'PUT' }).catch(() => {});
          set((s) => ({
            suppliers: s.suppliers.map((sup) => {
              if (sup.id !== supplierId) return sup;
              const newItems = (sup.items || []).map((it, idx) =>
                idx === itemIndex ? { ...it, fulfilled: true } : it
              );
              return { ...sup, items: newItems };
            }),
          }));
          return { ok: true };
        } catch (err) {
          console.error(err);
          return { ok: false, message: err.message };
        }
      },

      // --- Notifications ---
      markNotifRead: async (id) => {
        try {
          const res = await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
          if (res.ok) await get().fetchInitialData();
        } catch (err) {
          console.error(err);
        }
      },

      markAllNotifsRead: async () => {
        const notifs = get().notifications.filter((n) => !n.is_read);
        await Promise.all(notifs.map((n) => apiFetch(`/notifications/${n.id}/read`, { method: 'PUT' }).catch(() => {})));
        await get().fetchInitialData();
      },

      deleteNotif: async (id) => {
        try {
          const res = await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
          if (res.ok) await get().fetchInitialData();
        } catch (err) {
          console.error(err);
        }
      },

      // --- Member Status Changes ---
      proposeMemberStatusChange: async (hhId, memberId, newStatus, remarks) => {
        try {
          const res = await apiFetch('/status-changes', {
            method: 'POST',
            body: JSON.stringify({ hhId, memberId, newStatus, remarks }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return res;
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      confirmMemberStatusChange: async (requestId) => {
        try {
          const res = await apiFetch(`/status-changes/${requestId}/confirm`, { method: 'PUT' });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      disputeMemberStatusChange: async (requestId, reason) => {
        try {
          const res = await apiFetch(`/status-changes/${requestId}/dispute`, {
            method: 'PUT',
            body: JSON.stringify({ reason }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      requestMemberReactivation: async (memberId, reason) => {
        try {
          const res = await apiFetch('/status-changes/request-reactivation', {
            method: 'POST',
            body: JSON.stringify({ memberId, reason }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      // --- Member Roster Management ---
      addHouseholdMember: async (hhId, memberData) => {
        try {
          const res = await apiFetch(`/households/${hhId}/members`, {
            method: 'POST',
            body: JSON.stringify(memberData),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return res;
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      updateHouseholdMember: async (hhId, memberId, updatedData) => {
        try {
          const res = await apiFetch(`/households/${hhId}/members/${memberId}`, {
            method: 'PUT',
            body: JSON.stringify(updatedData),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      approveMemberAddition: async (requestId) => {
        try {
          const res = await apiFetch(`/status-changes/additions/${requestId}/approve`, { method: 'POST' });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      rejectMemberAddition: async (requestId, reason) => {
        try {
          const res = await apiFetch(`/status-changes/additions/${requestId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      // --- Password Reset ---
      requestPasswordReset: async (username, email) => {
        try {
          const res = await apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ username, email }),
          });
          if (res.ok) {
            return { ok: true, otp: res.otp, message: res.message };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      resetPassword: async (username, otp, newPassword) => {
        try {
          const res = await apiFetch('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ username, otp, newPassword }),
          });
          if (res.ok) {
            return { ok: true, message: res.message };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      verifyEmail: async (email, token, registrationId) => {
        try {
          const res = await apiFetch('/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ email, token, registrationId }),
          });
          if (res.ok) {
            await get().fetchInitialData();
            return { ok: true, message: res.message };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },

      resendVerificationToken: async (email, registrationId) => {
        try {
          const res = await apiFetch('/auth/resend-verification', {
            method: 'POST',
            body: JSON.stringify({ email, registrationId }),
          });
          if (res.ok) {
            return { ok: true, token: res.token, message: res.message };
          }
          return { ok: false, message: res.message };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      },


      resetAllData: () => {
        useAuthStore.getState().clearUser();
        set({
          accounts: [],
          puroks: [],
          sectors: [],
          categories: SEED_CATEGORIES,
          inventory: [],
          households: [],
          pendingRegistrations: [],
          cycles: [],
          qrCodes: [],
          distributions: [],
          suppliers: [],
          notifications: [],
          activityLogs: [],
          standardPackages: SEED_STANDARD_PACKAGES,
        });
      },
    })
);
