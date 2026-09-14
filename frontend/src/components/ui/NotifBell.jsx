import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'

const TIME_AGO = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago'
  return new Date(iso).toLocaleDateString('en-PH')
}

const TYPE_ICON = {
  registration:  { icon: 'fa-user-plus',         bg: '#dbeafe', color: '#2563eb' },
  approval:      { icon: 'fa-circle-check',      bg: '#d1fae5', color: '#059669' },
  cycle:         { icon: 'fa-rotate',            bg: '#ede9fe', color: '#7c3aed' },
  distribution:  { icon: 'fa-truck',             bg: '#d1fae5', color: '#059669' },
  donation:      { icon: 'fa-handshake',         bg: '#fef3c7', color: '#d97706' },
  stock_low:     { icon: 'fa-triangle-exclamation', bg: '#fef3c7', color: '#d97706' },
  stock_critical:{ icon: 'fa-triangle-exclamation', bg: '#fee2e2', color: '#dc2626' },
  default:       { icon: 'fa-bell',              bg: '#e2e8f0', color: '#64748b' },
}

export default function NotifBell({ accentColor = '#1a56db' }) {
  const { user } = useAuthStore()
  const { notifications, markNotifRead, markAllNotifsRead, deleteNotif } = useAppStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Filter: only this user's notifications
  const myNotifs = notifications.filter(n => n.recipient_id === user?.id)
  const unread = myNotifs.filter(n => !n.is_read).length

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const handleClick = (n) => {
    if (!n.is_read) markNotifRead(n.id)
    if (n.link) {
      let targetLink = n.link
      if (user?.role === 'staff' && targetLink.startsWith('/admin/')) {
        // Direct operational routes to staff prefix
        if (targetLink === '/admin/settings') {
          targetLink = '/staff'
        } else {
          targetLink = targetLink.replace(/^\/admin\//, '/staff/')
        }
      }
      navigate(targetLink)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
        aria-label="Notifications">
        <i className="fas fa-bell" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center"
            style={{ width: 18, height: 18 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute -right-2 sm:right-0 top-12 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
            style={{ width: 'min(340px, calc(100vw - 24px))' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
              <div>
                <div className="font-display font-bold text-sm text-navy">Notifications</div>
                {unread > 0 && <div className="text-[11px] text-slate-500">{unread} unread</div>}
              </div>
              <div className="flex gap-2 items-center">
                {unread > 0 && (
                  <button
                    onClick={() => markAllNotifsRead(user.id)}
                    className="text-[11px] text-blue-600 font-semibold hover:underline">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                  <i className="fas fa-xmark" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {myNotifs.length === 0 && (
                <div className="py-10 text-center text-slate-400">
                  <i className="fas fa-bell-slash text-3xl mb-2 block text-slate-300" />
                  <div className="text-sm font-semibold">All caught up!</div>
                  <div className="text-xs">No notifications yet.</div>
                </div>
              )}

              {myNotifs.slice(0, 30).map(n => {
                const typeInfo = TYPE_ICON[n.type] || TYPE_ICON.default
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex gap-3 p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors group ${!n.is_read ? 'bg-blue-50/40' : ''}`}>
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                      style={{ background: typeInfo.bg, color: typeInfo.color }}>
                      <i className={`fas ${typeInfo.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-bold text-navy font-display leading-tight break-words">{n.title}</div>
                        {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug break-words">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{TIME_AGO(n.created_at)}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotif(n.id) }}
                      className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 self-start flex-shrink-0">
                      <i className="fas fa-trash text-[10px]" />
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
