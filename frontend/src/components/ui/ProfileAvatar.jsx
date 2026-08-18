import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { apiFetch } from '../../api/client'
import PasswordStrengthMeter, { checkStrength } from './PasswordStrengthMeter'
import LogoutConfirm from './LogoutConfirm'
import toast from 'react-hot-toast'

const ROLE_COLOR = {
  admin:       { bg: '#1a56db', tint: '#dbeafe', dark: '#1e40af' },
  staff:       { bg: '#10b981', tint: '#d1fae5', dark: '#047857' },
  beneficiary: { bg: '#f59e0b', tint: '#fef3c7', dark: '#b45309' },
}

export default function ProfileAvatar() {
  const navigate = useNavigate()
  const { user, setUser, setAuth } = useAuthStore()
  const { updateMyProfile, changeMyPassword, logout } = useAppStore()
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [tab, setTab] = useState('profile')
  const [terminating, setTerminating] = useState(false)
  const dropdownRef = useRef(null)

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    contact: user?.contact || '',
    address: user?.address || '',
    bio: user?.bio || '',
    photo: user?.photo || null,
  })
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [showPw, setShowPw] = useState({ curr: false, new: false, conf: false })
  const fileInputRef = useRef(null)

  const color = ROLE_COLOR[user?.role] || ROLE_COLOR.beneficiary
  const initial = user?.full_name?.[0]?.toUpperCase() || '?'

  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  useEffect(() => {
    if (showModal && user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        contact: user.contact || '',
        address: user.address || '',
        bio: user.bio || '',
        photo: user.photo || null,
      })
    }
  }, [showModal, user])

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      toast.error('Photo must be under 1MB.')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setForm(f => ({ ...f, photo: ev.target.result }))
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async () => {
    if (!form.full_name.trim()) { toast.error('Name is required.'); return }
    const ok = await updateMyProfile(form)
    if (ok) toast.success('Profile updated successfully.')
    else toast.error('Failed to update profile.')
  }

  const handleChangePassword = async () => {
    if (!pwForm.current_password) { toast.error('Enter your current password.'); return }
    if (pwForm.new_password !== pwForm.confirm) { toast.error('New passwords do not match.'); return }
    if (checkStrength(pwForm.new_password).score < 3) { toast.error('Password is too weak.'); return }
    const result = await changeMyPassword(pwForm.current_password, pwForm.new_password)
    if (result?.ok) {
      toast.success('Password changed successfully.')
    } else {
      toast.error(result?.message || 'Password update failed.')
    }
  }

  const handleTerminateOtherSessions = async () => {
    setTerminating(true)
    try {
      const res = await apiFetch('/accounts/terminate-sessions', { method: 'POST' })
      if (res.ok) {
        if (res.token && res.user) {
          setAuth(res.user, res.token)
        }
        toast.success('All other active device sessions have been terminated. Single session refreshed!')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to terminate other sessions.')
    } finally {
      setTerminating(false)
    }
  }

  const handleDoLogout = () => {
    setShowLogoutModal(false)
    logout()
    window.scrollTo({ top: 0, behavior: 'instant' })
    navigate('/')
    toast.success('Logged out successfully.')
  }

  if (!user) return null

  const sessionInfo = user.current_session || {}

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-10 h-10 rounded-xl overflow-hidden border-2 border-slate-200 hover:border-slate-300 transition-all flex items-center justify-center text-white font-bold text-sm flex-shrink-0 cursor-pointer"
          style={{ background: user.photo ? '#fff' : color.bg }}
          aria-label="Profile">
          {user.photo ? (
            <img src={user.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-12 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
              style={{ width: 'min(280px, calc(100vw - 32px))' }}>
              <div className="p-4 border-b border-slate-100" style={{ background: color.tint }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: user.photo ? '#fff' : color.bg }}>
                    {user.photo ? <img src={user.photo} alt="" className="w-full h-full object-cover" /> : initial}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-navy truncate">{user.full_name}</div>
                    <div className="text-[11px] capitalize" style={{ color: color.dark }}>
                      <i className="fas fa-circle text-[6px] mr-1" />{user.role}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-0.5">
                <button
                  onClick={() => { setShowModal(true); setOpen(false); setTab('profile') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors text-sm cursor-pointer">
                  <i className="fas fa-user-gear text-slate-400 w-4" />
                  <span className="text-navy font-semibold">Account Settings</span>
                </button>
                <button
                  onClick={() => { setOpen(false); setShowLogoutModal(true) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-red-50 text-red-600 transition-colors text-sm font-semibold cursor-pointer">
                  <i className="fas fa-right-from-bracket text-red-500 w-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showModal && createPortal(
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="modal-box max-w-md max-h-[88vh] flex flex-col overflow-hidden p-0 rounded-2xl"
            >
              {/* Header Bar */}
              <div className="relative px-4 py-3.5 flex justify-between items-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${color.dark}, ${color.bg})` }}>
                <div className="font-display font-bold text-sm text-white">
                  Account Settings & Security
                </div>
                <button onClick={() => setShowModal(false)}
                  className="w-6 h-6 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                  <i className="fas fa-xmark" />
                </button>
              </div>

              {/* Profile Avatar & Primary Info Card */}
              <div className="p-4 bg-white relative flex-1 flex flex-col overflow-y-auto">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 shadow-xs flex items-center justify-center text-white text-base font-bold font-display"
                        style={{ background: form.photo ? '#fff' : color.bg }}>
                        {form.photo
                          ? <img src={form.photo} alt="" className="w-full h-full object-cover" />
                          : (form.full_name?.[0]?.toUpperCase() || '?')}
                      </div>
                      <button onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-navy text-white flex items-center justify-center shadow-xs hover:bg-blue-700 border border-white transition-colors cursor-pointer"
                        title="Update photo">
                        <i className="fas fa-camera text-[8px]" />
                      </button>
                      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </div>

                    <div className="min-w-0">
                      <div className="font-display font-bold text-xs sm:text-sm text-navy truncate">{user.full_name}</div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className="badge font-bold text-[9px] capitalize px-1.5 py-0.5" style={{ background: color.tint, color: color.dark }}>
                          <i className="fas fa-user-shield text-[8px] mr-1" />{user.role}
                        </span>
                        <span className="badge badge-approved text-[9px] px-1.5 py-0.5">
                          <i className="fas fa-shield-halved text-[8px] mr-1" />Protected
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Tab Switches */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg w-full sm:w-auto flex-shrink-0">
                    <button onClick={() => setTab('profile')}
                      className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md text-[11px] font-bold font-display transition-all cursor-pointer ${
                        tab === 'profile' ? 'bg-white text-navy shadow-xs' : 'text-slate-500'
                      }`}>
                      <i className="fas fa-id-card mr-1" />Profile
                    </button>
                    <button onClick={() => setTab('password')}
                      className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md text-[11px] font-bold font-display transition-all cursor-pointer ${
                        tab === 'password' ? 'bg-white text-navy shadow-xs' : 'text-slate-500'
                      }`}>
                      <i className="fas fa-lock mr-1" />Password
                    </button>
                    <button onClick={() => setTab('sessions')}
                      className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md text-[11px] font-bold font-display transition-all cursor-pointer ${
                        tab === 'sessions' ? 'bg-white text-navy shadow-xs' : 'text-slate-500'
                      }`}>
                      <i className="fas fa-laptop mr-1" />Session
                    </button>
                  </div>
                </div>

                {/* TAB 1: PROFILE */}
                {tab === 'profile' && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="space-y-3 pb-2">
                      {/* Role Specific Modern Detail Summary */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                        <div className="font-bold text-navy uppercase text-[9px] tracking-wide flex items-center justify-between">
                          <span>Account Role Summary</span>
                          <i className="fas fa-circle-info text-blue-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 text-[11px]">
                          <div><span className="text-slate-400">Username:</span> <strong className="text-navy">@{user.username}</strong></div>
                          <div><span className="text-slate-400">Role:</span> <strong className="text-navy capitalize">{user.role}</strong></div>
                          {user.role === 'beneficiary' && (
                            <>
                              <div><span className="text-slate-400">Household:</span> <strong className="text-navy font-mono">HH-{user.id * 1234 || '393357'}</strong></div>
                              <div><span className="text-slate-400">Location:</span> <strong className="text-navy">Purok 2 · Puerto</strong></div>
                            </>
                          )}
                          {user.role === 'admin' && (
                            <>
                              <div><span className="text-slate-400">Office:</span> <strong className="text-navy">Barangay Admin</strong></div>
                              <div><span className="text-slate-400">Access:</span> <strong className="text-navy">Full Administrator</strong></div>
                            </>
                          )}
                          {user.role === 'staff' && (
                            <>
                              <div><span className="text-slate-400">Office:</span> <strong className="text-navy">Relief Operations</strong></div>
                              <div><span className="text-slate-400">Access:</span> <strong className="text-navy">Verification & Scan</strong></div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Contact & Personal Editable Fields */}
                      <div className="space-y-2.5">
                        <div className="form-group">
                          <label className="form-label text-xs">Display Name *</label>
                          <input className="form-input text-xs py-1.5" value={form.full_name}
                            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="form-group">
                            <label className="form-label text-xs">Email Address</label>
                            <input type="email" className="form-input text-xs py-1.5" value={form.email}
                              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                              placeholder="email@example.com" />
                          </div>
                          <div className="form-group">
                            <label className="form-label text-xs">Contact Number</label>
                            <input className="form-input text-xs py-1.5" value={form.contact}
                              onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                              placeholder="09XXXXXXXXX" maxLength={11} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label text-xs">Address</label>
                          <input className="form-input text-xs py-1.5" value={form.address}
                            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                            placeholder="House No., Street, Barangay Puerto" />
                        </div>
                      </div>
                    </div>

                    <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-100 flex justify-end gap-2 z-10">
                      <button onClick={() => setShowModal(false)} className="btn btn-gray btn-sm">Close</button>
                      <button onClick={handleSaveProfile} className="btn btn-primary btn-sm">
                        <i className="fas fa-check" /> Save Profile
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: PASSWORD */}
                {tab === 'password' && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="space-y-3 pb-2">
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
                        <i className="fas fa-shield-halved mr-1.5" />
                        Update your login password below. Use a strong password to protect your account.
                      </div>
                      <div className="form-group">
                        <label className="form-label">Current Password *</label>
                        <div className="relative">
                          <input type={showPw.curr ? 'text' : 'password'}
                            className="form-input pr-10" value={pwForm.current_password}
                            onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
                          <button type="button" onClick={() => setShowPw(s => ({ ...s, curr: !s.curr }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <i className={`fas ${showPw.curr ? 'fa-eye-slash' : 'fa-eye'}`} />
                          </button>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">New Password *</label>
                        <div className="relative">
                          <input type={showPw.new ? 'text' : 'password'}
                            className="form-input pr-10" value={pwForm.new_password}
                            onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
                          <button type="button" onClick={() => setShowPw(s => ({ ...s, new: !s.new }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <i className={`fas ${showPw.new ? 'fa-eye-slash' : 'fa-eye'}`} />
                          </button>
                        </div>
                        <PasswordStrengthMeter password={pwForm.new_password} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Confirm New Password *</label>
                        <div className="relative">
                          <input type={showPw.conf ? 'text' : 'password'}
                            className="form-input pr-10" value={pwForm.confirm}
                            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
                          <button type="button" onClick={() => setShowPw(s => ({ ...s, conf: !s.conf }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <i className={`fas ${showPw.conf ? 'fa-eye-slash' : 'fa-eye'}`} />
                          </button>
                        </div>
                        {pwForm.confirm && (
                          <div className={`text-xs mt-1 ${pwForm.new_password === pwForm.confirm ? 'text-emerald-600' : 'text-red-500'}`}>
                            <i className={`fas ${pwForm.new_password === pwForm.confirm ? 'fa-circle-check' : 'fa-circle-xmark'} mr-1`} />
                            {pwForm.new_password === pwForm.confirm ? 'Passwords match' : 'Passwords do not match'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-100 flex justify-end gap-2 z-10">
                      <button onClick={() => setShowModal(false)} className="btn btn-gray btn-sm">Close</button>
                      <button onClick={handleChangePassword}
                        disabled={!pwForm.current_password || !pwForm.new_password}
                        className="btn btn-primary btn-sm">
                        <i className="fas fa-lock" /> Update Password
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: ACTIVE SESSIONS & DEVICE MANAGEMENT */}
                {tab === 'sessions' && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="space-y-3 pb-2">
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800">
                        <div className="flex items-center gap-1.5 font-bold mb-1">
                          <i className="fas fa-shield-halved text-emerald-600" />
                          <span>Single-Session Security Active</span>
                        </div>
                        <div>
                          Only 1 active device session is permitted at a time. If you log in on another device, this session is automatically invalidated.
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Device Session</span>
                          <span className="badge badge-approved text-[9px] px-2 py-0.5">
                            <i className="fas fa-circle-dot text-[7px] mr-1 animate-pulse" />Active Now
                          </span>
                        </div>

                        <div className="flex items-start gap-3 pt-1">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 text-lg flex-shrink-0 shadow-xs">
                            <i className={sessionInfo.device_type === 'Mobile' ? 'fas fa-mobile-screen' : 'fas fa-laptop'} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-display font-bold text-xs text-navy">
                              {sessionInfo.browser || 'Web Browser'} on {sessionInfo.os || 'Current Operating System'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Device: <strong className="text-slate-700">{sessionInfo.device_type || 'Desktop Device'}</strong>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Logged in: {new Date(sessionInfo.login_at || user.last_login_at || Date.now()).toLocaleString('en-PH')}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                        <div className="text-xs font-semibold text-navy">Need to kick off other devices?</div>
                        <div className="text-[11px] text-slate-500 leading-relaxed">
                          Click below to reset your active session token. Any unauthorized logins on other computers or phones will be immediately logged out.
                        </div>
                        <button
                          type="button"
                          disabled={terminating}
                          onClick={handleTerminateOtherSessions}
                          className="btn btn-gray btn-sm w-full mt-1 cursor-pointer"
                        >
                          <i className={`fas ${terminating ? 'fa-spinner fa-spin' : 'fa-arrow-rotate-right'} text-red-500`} />
                          <span>{terminating ? 'Resetting Sessions...' : 'Invalidate All Other Sessions'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-100 flex justify-end gap-2 z-10">
                      <button onClick={() => setShowModal(false)} className="btn btn-gray btn-sm">Close</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <LogoutConfirm
          onCancel={() => setShowLogoutModal(false)}
          onConfirm={handleDoLogout}
        />
      )}
    </>
  )
}
