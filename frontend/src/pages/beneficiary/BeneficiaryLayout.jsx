import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import NotifBell from '../../components/ui/NotifBell'
import ProfileAvatar from '../../components/ui/ProfileAvatar'
import CycleHeaderWidget from '../../components/ui/CycleHeaderWidget'
import LogoutConfirm from '../../components/ui/LogoutConfirm'
import { useRedDots } from '../../components/ui/useRedDots'
import { PageSkeleton } from '../../components/ui/Skeleton'
import toast from 'react-hot-toast'

const BEN_NAV = [
  { path: '/beneficiary',           icon: 'fa-house',             label: 'Dashboard' },
  { path: '/beneficiary/history',   icon: 'fa-clock-rotate-left', label: 'History' },
  { path: '/beneficiary/community', icon: 'fa-eye',               label: 'Community' },
]

export default function BeneficiaryLayout() {
  const { user } = useAuthStore()
  const { logout, fetchInitialData } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  const [showLogout, setShowLogout] = useState(false)
  const [navLoading, setNavLoading] = useState(false)
  const redDots = useRedDots()
  const mainRef = useRef(null)

  useEffect(() => {
    fetchInitialData()
    const fn = () => {
      const d = window.innerWidth >= 1024
      setIsDesktop(d)
      if (d) setSidebarOpen(false)
    }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [fetchInitialData])

  useEffect(() => {
    setNavLoading(true)
    const t = setTimeout(() => setNavLoading(false), 220)
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    return () => clearTimeout(t)
  }, [location.pathname])

  const currentNavItem = BEN_NAV.find(n => n.path === location.pathname)
  const pageLabel = currentNavItem ? currentNavItem.label : 'Dashboard'

  const doLogout = () => {
    setShowLogout(false)
    logout()
    window.scrollTo({ top: 0, behavior: 'instant' })
    navigate('/')
    toast.success('Logged out successfully.')
  }

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-slate-50">
      {/* Full-Height Flush Sidebar (100vh) */}
      <aside className={`sidebar sidebar-navy ${!isDesktop && sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[.07] flex-shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md border border-white/20">
            <img src="/logo.png" alt="Barangay Puerto Seal" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-extrabold text-[13px] text-white truncate">Barangay Puerto</div>
            <div className="text-[10px] text-white/40 truncate">Beneficiary Portal</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <div className="px-5 pb-2 text-[9px] font-bold text-white/30 uppercase tracking-widest">
            Menu
          </div>
          {BEN_NAV.map(item => (
            <div
              key={item.path}
              onClick={() => { navigate(item.path); if (!isDesktop) setSidebarOpen(false) }}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
              <span className="w-4 text-center text-[13px] flex-shrink-0">
                <i className={`fas ${item.icon}`} />
              </span>
              <span className="truncate flex-1 font-semibold">{item.label}</span>
              {redDots[item.path] > 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 animate-pulse" title={`${redDots[item.path]} pending`} />
              )}
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-white/[.07] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: user?.photo ? '#fff' : '#2563eb' }}>
              {user?.photo
                ? <img src={user.photo} alt="" className="w-full h-full object-cover" />
                : (user?.full_name?.[0] || 'B')}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.full_name || 'Beneficiary'}</div>
              <div className="text-[10px] text-white/40 truncate">Beneficiary Account</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay Backdrop */}
      {!isDesktop && sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden"
        style={isDesktop ? { marginLeft: 256 } : { marginLeft: 0 }}>
        
        {/* Sticky Desktop & Mobile Topbar */}
        <div className="topbar">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* 3-Line Hamburger Menu (☰) on Mobile View */}
            <button onClick={() => setSidebarOpen(o => !o)}
              className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-navy flex-shrink-0 lg:hidden hover:bg-slate-200 transition-colors cursor-pointer"
              title="Menu">
              <i className="fas fa-bars" />
            </button>
            <span className="font-display font-bold text-sm sm:text-base text-navy truncate">{pageLabel}</span>
          </div>

          {/* Clean Centered Flex Row for Cycle, Notification and Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            <CycleHeaderWidget />
            <NotifBell />
            <ProfileAvatar />
          </div>
        </div>

        <main ref={mainRef} className="flex-1 page-content overflow-y-auto"
          style={{ paddingBottom: isDesktop ? '24px' : 'calc(72px + env(safe-area-inset-bottom))' }}>
          {navLoading ? (
            <PageSkeleton route={location.pathname} />
          ) : (
            <motion.div key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}>
              <Outlet />
            </motion.div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="bottom-nav">
        {BEN_NAV.map(item => (
          <div key={item.path}
            className={`bottom-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}>
            <div className="relative">
              <i className={`fas ${item.icon}`} />
              {redDots[item.path] > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      {showLogout && <LogoutConfirm onCancel={() => setShowLogout(false)} onConfirm={doLogout} />}
    </div>
  )
}
