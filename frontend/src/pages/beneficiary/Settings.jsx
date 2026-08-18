import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import PasswordStrengthMeter, { checkStrength } from '../../components/ui/PasswordStrengthMeter'
import toast from 'react-hot-toast'

export default function BeneficiarySettings() {
  const { user } = useAuthStore()
  const { updateMyProfile, changeMyPassword, households } = useAppStore()
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    contact: user?.contact || '',
  })
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [showPw, setShowPw] = useState({ curr: false, new: false, conf: false })

  const myHH = households.find((h) => h.account_id === user?.id)

  const handleProfile = async () => {
    if (!form.full_name?.trim()) {
      toast.error('Name required.')
      return
    }
    const ok = await updateMyProfile(form)
    if (ok) {
      toast.success('Profile updated.')
    } else {
      toast.error('Failed to update profile.')
    }
  }

  const handlePassword = async () => {
    if (!pwForm.current_password) {
      toast.error('Enter current password.')
      return
    }
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('New passwords do not match.')
      return
    }
    if (checkStrength(pwForm.new_password).score < 3) {
      toast.error('Password too weak.')
      return
    }
    const result = await changeMyPassword(pwForm.current_password, pwForm.new_password)
    if (result?.ok) {
      toast.success('Password changed successfully.')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } else {
      toast.error(result?.message || 'Password update failed.')
    }
  }

  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff'
  const headerColor = isAdmin ? '#1a56db' : isStaff ? '#10b981' : '#f59e0b'
  const headerDark = isAdmin ? '#1e40af' : isStaff ? '#047857' : '#b45309'
  const headerTint = isAdmin ? '#dbeafe' : isStaff ? '#d1fae5' : '#fef3c7'

  return (
    <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto px-2 sm:px-4">
      <div className="card overflow-hidden p-0 shadow-lg border border-slate-200/80 rounded-2xl">
        {/* Header Bar */}
        <div
          className="relative px-4 sm:px-6 py-3.5 flex justify-between items-center transition-all"
          style={{ background: `linear-gradient(135deg, ${headerDark}, ${headerColor})` }}
        >
          <div className="font-display font-extrabold text-base sm:text-lg text-white">
            Account & Profile Settings
          </div>
        </div>

        {/* Header Avatar & Profile Intro */}
        <div className="p-4 sm:p-6 bg-white relative">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left flex-1 min-w-0">
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-200 shadow-xs flex items-center justify-center text-white text-xl font-bold font-display flex-shrink-0"
                style={{ background: headerColor }}
              >
                {user?.full_name?.[0]?.toUpperCase() || '?'}
              </div>

              <div className="min-w-0">
                <div className="font-display font-extrabold text-base sm:text-lg text-navy truncate">
                  {user?.full_name}
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 flex-wrap">
                  <span
                    className="badge font-bold text-[10px] sm:text-xs capitalize px-2.5 py-0.5"
                    style={{ background: headerTint, color: headerDark }}
                  >
                    <i className="fas fa-user-shield text-[9px] sm:text-[10px] mr-1" />
                    {user?.role}
                  </span>
                  <span className="badge badge-approved text-[10px] sm:text-xs px-2.5 py-0.5">
                    <i className="fas fa-circle-check text-[9px] sm:text-[10px] mr-1" />
                    Active Account
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tab Switches */}
            <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setTab('profile')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold font-display transition-all ${
                  tab === 'profile' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className="fas fa-id-card mr-1.5" />
                Profile
              </button>
              <button
                onClick={() => setTab('password')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold font-display transition-all ${
                  tab === 'password' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className="fas fa-lock mr-1.5" />
                Security
              </button>
            </div>
          </div>

          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {tab === 'profile' && (
              <div className="flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  {/* Household & Account Detail Summary Cards */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="font-bold text-navy uppercase text-[10px] tracking-wider flex items-center justify-between">
                      <span>Role & Household Summary</span>
                      <i className="fas fa-circle-info text-blue-500" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-600 text-xs pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Username</span>
                        <strong className="text-navy truncate block">@{user?.username}</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Account Role</span>
                        <strong className="text-navy capitalize block">{user?.role}</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Household ID</span>
                        <strong className="text-navy font-mono block">{myHH?.hh_code || 'HH-PUERTO'}</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Location</span>
                        <strong className="text-navy truncate block">{myHH?.purok_name || 'Barangay Puerto'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Personal & Contact Details Form */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-display font-bold text-sm text-navy flex items-center gap-1.5">
                      <i className="fas fa-user text-blue-600" /> Personal Details
                    </h4>
                    <div className="form-group">
                      <label className="form-label text-xs">Display Name *</label>
                      <input
                        className="form-input text-xs py-2"
                        value={form.full_name}
                        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="form-group">
                        <label className="form-label text-xs">Email Address</label>
                        <input
                          type="email"
                          className="form-input text-xs py-2"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Contact Number</label>
                        <input
                          className="form-input text-xs py-2"
                          value={form.contact}
                          onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                          placeholder="09XXXXXXXXX"
                          maxLength={11}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button onClick={handleProfile} className="btn btn-primary btn-sm w-full sm:w-auto px-6">
                    <i className="fas fa-save" /> Save Profile Changes
                  </button>
                </div>
              </div>
            )}

            {tab === 'password' && (
              <div className="flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-800 flex items-start gap-2.5">
                    <i className="fas fa-shield-halved text-base text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block mb-0.5 font-bold">Account Security Notice</strong>
                      Update your login password below. Make sure to use a strong password with letters, numbers, and symbols to protect your account.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:gap-4 max-w-xl">
                    <div className="form-group">
                      <label className="form-label text-xs">Current Password *</label>
                      <div className="relative">
                        <input
                          type={showPw.curr ? 'text' : 'password'}
                          className="form-input text-xs py-2 pr-10"
                          value={pwForm.current_password}
                          onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((s) => ({ ...s, curr: !s.curr }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <i className={`fas ${showPw.curr ? 'fa-eye-slash' : 'fa-eye'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">New Password *</label>
                      <div className="relative">
                        <input
                          type={showPw.new ? 'text' : 'password'}
                          className="form-input text-xs py-2 pr-10"
                          value={pwForm.new_password}
                          onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((s) => ({ ...s, new: !s.new }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <i className={`fas ${showPw.new ? 'fa-eye-slash' : 'fa-eye'}`} />
                        </button>
                      </div>
                      <PasswordStrengthMeter password={pwForm.new_password} />
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">Confirm New Password *</label>
                      <div className="relative">
                        <input
                          type={showPw.conf ? 'text' : 'password'}
                          className="form-input text-xs py-2 pr-10"
                          value={pwForm.confirm}
                          onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((s) => ({ ...s, conf: !s.conf }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <i className={`fas ${showPw.conf ? 'fa-eye-slash' : 'fa-eye'}`} />
                        </button>
                      </div>
                      {pwForm.confirm && (
                        <div
                          className={`text-xs mt-1 font-semibold ${
                            pwForm.new_password === pwForm.confirm ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          <i
                            className={`fas ${
                              pwForm.new_password === pwForm.confirm ? 'fa-circle-check' : 'fa-circle-xmark'
                            } mr-1`}
                          />
                          {pwForm.new_password === pwForm.confirm ? 'Passwords match' : 'Passwords do not match'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    onClick={handlePassword}
                    disabled={!pwForm.current_password || !pwForm.new_password}
                    className="btn btn-primary btn-sm w-full sm:w-auto px-6"
                  >
                    <i className="fas fa-lock" /> Update Password
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
