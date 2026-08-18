import { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'

/**
 * Returns an object with boolean red-dot indicators for each module/path.
 * Use: const dots = useRedDots(); dots['/admin/settings'] // → true if pending
 */
export function useRedDots() {
  const { user } = useAuthStore()
  const {
    pendingRegistrations, suppliers, cycles, qrCodes,
    pendingMemberStatusChanges, pendingMemberAdditions, notifications,
  } = useAppStore()

  return useMemo(() => {
    const dots = {}
    if (!user) return dots

    // Pending registrations → Admin Settings
    const pendingRegs = pendingRegistrations?.filter(r => r.status === 'pending').length || 0
    if (pendingRegs > 0) dots['/admin/settings'] = pendingRegs

    // Pending member additions awaiting admin confirmation → Admin Beneficiaries
    const pendingAdditions = (pendingMemberAdditions || []).filter(r => r.status === 'pending').length || 0
    if (pendingAdditions > 0 && user.role === 'admin') {
      dots['/admin/beneficiaries'] = pendingAdditions
    }

    // Pending donated items waiting to be added to inventory → Inventory red dot
    const pendingDonations = (suppliers || []).reduce((acc, s) => {
      const unfulfilled = (s.items || []).filter(i => !i.fulfilled).length
      return acc + unfulfilled
    }, 0)

    if (pendingDonations > 0) {
      dots['/admin/inventory'] = pendingDonations
      dots['/staff/inventory'] = pendingDonations
    }

    // Pending member status changes → Admin Beneficiaries (for admin) / Beneficiary Dashboard
    const pendingChanges = (pendingMemberStatusChanges || []).filter(r => r.status === 'pending')
    if (user.role === 'admin') {
      // For admin: count their own proposals waiting for beneficiary confirmation? Not on admin side.
    } else if (user.role === 'beneficiary') {
      // Beneficiary sees proposals from admin pending their confirmation
      const myPending = pendingChanges.filter(r => {
        // Check if any household belongs to this user
        return r.hh_id  // We'd need to cross-check against households, but easier to count notifications
      })
      // Use unread notifications for beneficiary instead — they receive a notification for each proposal
    }

    // Active cycles with unclaimed QRs → Distribution / QR Verify
    const activeCycles = (cycles || []).filter(c => c.is_active)
    if (activeCycles.length > 0) {
      const hasUnclaimed = (qrCodes || []).some(q =>
        activeCycles.find(c => c.id === q.cycle_id) && !q.is_claimed
      )
      if (hasUnclaimed) {
        dots['/admin/qr'] = activeCycles.length
        dots['/admin/distribution'] = activeCycles.length
        dots['/staff/qr'] = activeCycles.length
        dots['/staff/distribution'] = activeCycles.length
      }
    }

    // Unread notifications targeted at user → various places
    const myUnread = (notifications || []).filter(n => n.recipient_id === user.id && !n.is_read).length
    if (myUnread > 0) {
      // Beneficiary dashboard shows red dot for unread notifications relating to their household
      if (user.role === 'beneficiary') {
        // Check if any unread notif involves status change proposal
        const statusProposal = (notifications || []).some(n =>
          n.recipient_id === user.id && !n.is_read && n.title?.includes('Confirm Member Status'))
        if (statusProposal) dots['/beneficiary'] = (dots['/beneficiary'] || 0) + 1
      }
    }

    return dots
  }, [pendingRegistrations, suppliers, cycles, qrCodes, pendingMemberStatusChanges, pendingMemberAdditions, notifications, user])
}
