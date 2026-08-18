import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import toast from 'react-hot-toast'

const ROLES = [
  {
    key: 'admin',
    label: 'Admin',
    icon: 'fa-shield-halved',
    color: '#1a56db',
    gradient: 'radial-gradient(circle at 50% 35%, #1d54c4 0%, #0f3482 60%, #0a2052 100%)',
  },
  {
    key: 'staff',
    label: 'Staff',
    icon: 'fa-id-badge',
    color: '#10b981',
    gradient: 'radial-gradient(circle at 50% 35%, #059669 0%, #046c4b 60%, #034834 100%)',
  },
  {
    key: 'beneficiary',
    label: 'Beneficiary',
    icon: 'fa-house-user',
    color: '#f59e0b',
    gradient: 'radial-gradient(circle at 50% 35%, #fcd34d 0%, #f59e0b 55%, #ea580c 100%)',
  },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAppStore()
  const [role, setRole] = useState('admin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [errors, setErrors] = useState({})
  const passwordRef = useRef(null)

  const selected = ROLES.find(r => r.key === role)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('brgy_remembered_user')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.username) setUsername(parsed.username)
        if (parsed.password) setPassword(parsed.password)
        if (parsed.role) setRole(parsed.role)
        setRememberMe(true)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleLogin = async (e) => {
    e?.preventDefault()
    const errs = {}
    if (!username.trim()) errs.username = 'Please enter your username.'
    if (!password) errs.password = 'Please enter your password.'

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setShake(true)
      setTimeout(() => setShake(false), 600)
      if (errs.username) {
        toast.error('Please enter your username.')
      } else if (errs.password) {
        passwordRef.current?.focus()
        toast.error('Please enter your password.')
      }
      return
    }

    setErrors({})
    setLoading(true)
    try {
      const ok = await login(username, password, role, rememberMe)
      setLoading(false)
      if (!ok) {
        setShake(true)
        setTimeout(() => setShake(false), 600)
        toast.error('Invalid credentials. Check username, password and role.')
        return
      }

      if (rememberMe) {
        localStorage.setItem('brgy_remembered_user', JSON.stringify({ username, password, role }))
      } else {
        localStorage.removeItem('brgy_remembered_user')
      }

      toast.success('Welcome back!')
      if (role === 'admin') navigate('/admin')
      else if (role === 'staff') navigate('/staff')
      else navigate('/beneficiary')
    } catch (err) {
      setLoading(false)
      setShake(true)
      setTimeout(() => setShake(false), 600)
      toast.error(err.message || 'Login failed. Check server status.')
    }
  }

  return (
    <div className="min-h-screen flex">
      <AnimatePresence mode="wait">
        <motion.div key={role}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          className="hidden lg:flex flex-col items-center justify-center flex-1 relative overflow-hidden"
          style={{ background: selected.gradient }}>
          {[200, 140, 100].map((s, i) => (
            <div key={i} className="hero-float absolute rounded-full"
              style={{
                width: s, height: s,
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.08)',
                top: `${20 + i * 25}%`, left: `${5 + i * 10}%`,
                animationDelay: `${i * 0.5}s`,
              }} />
          ))}
          <div className="relative z-10 text-center px-10 max-w-sm">
            <motion.div key={role + '-icon'}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' }}
              className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-6 shadow-2xl border-2 border-white/20 bg-transparent">
              <img src="/logo.png" alt="Barangay Puerto Seal" className="w-full h-full object-cover rounded-full" />
            </motion.div>
            <h2 className="font-display font-extrabold text-2xl text-white mb-3">Barangay Puerto<br />Relief System</h2>
            <p className="text-white/60 text-sm">Cagayan de Oro City, Misamis Oriental 9000</p>
            <p className="text-white/40 text-xs mt-6">Secure access for authorized personnel and registered beneficiaries.</p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="w-full lg:w-[460px] bg-white flex flex-col items-center justify-center px-6 sm:px-8 py-12 relative">
        <button onClick={() => navigate('/')}
          className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm">
          <i className="fas fa-chevron-left" /> Home
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <h3 className="font-display font-extrabold text-2xl text-navy mb-1">Welcome Back</h3>
          <p className="text-slate-500 text-sm mb-6">Sign in to continue.</p>

          <div className="mb-5">
            <label className="form-label">Login as</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button key={r.key} type="button" onClick={() => setRole(r.key)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${role === r.key ? 'shadow-md' : ''}`}
                  style={{
                    borderColor: role === r.key ? r.color : '#e2e8f0',
                    background: role === r.key ? r.color + '10' : 'white',
                  }}>
                  <i className={`fas ${r.icon} text-lg mb-1 block`}
                    style={{ color: role === r.key ? r.color : '#94a3b8' }} />
                  <div className="text-xs font-bold font-display"
                    style={{ color: role === r.key ? r.color : '#94a3b8' }}>{r.label}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div className="relative">
                <i className="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input className={`form-input pl-9 ${errors.username ? 'error' : ''}`} placeholder="Enter username" autoComplete="username"
                  value={username} onChange={e => { setUsername(e.target.value); setErrors(prev => ({ ...prev, username: null })); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (!password) {
                        e.preventDefault()
                        passwordRef.current?.focus()
                        setErrors(prev => ({ ...prev, password: 'Please enter your password.' }))
                        toast.error('Please enter your password.')
                      }
                    }
                  }} />
              </div>
              {errors.username && <div className="text-red-500 text-xs mt-1">{errors.username}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="relative">
                <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input ref={passwordRef} className={`form-input pl-9 pr-10 ${errors.password ? 'error' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  value={password} onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: null })); }} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
              {errors.password && <div className="text-red-500 text-xs mt-1">{errors.password}</div>}
            </div>

            <motion.button type="submit" disabled={loading}
              animate={shake ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
              className="btn w-full justify-center py-3 text-white font-bold"
              style={{ background: selected.color }}>
              {loading
                ? <><i className="fas fa-spinner fa-spin" /> Signing in...</>
                : <><i className="fas fa-right-to-bracket" /> Sign In</>}
            </motion.button>
          </form>

          <div className="flex items-center justify-between mt-3">
            <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              Remember me
            </label>
            <button onClick={() => navigate('/forgot-password')}
              className="text-sm text-blue-600 hover:underline font-semibold">
              Forgot password?
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <button onClick={() => navigate('/register')}
              className="text-blue-600 font-semibold hover:underline">
              Register
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
