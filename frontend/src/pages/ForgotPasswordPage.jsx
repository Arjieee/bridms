import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import PasswordStrengthMeter, { checkStrength } from '../components/ui/PasswordStrengthMeter'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { requestPasswordReset, resetPassword } = useAppStore()
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [displayedOtp, setDisplayedOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleRequest = async () => {
    if (!username || !email) {
      toast.error('Please enter your username and registered email.')
      return
    }
    setSubmitting(true)
    try {
      const result = await requestPasswordReset(username, email)
      setSubmitting(false)
      if (result?.ok) {
        setDisplayedOtp(result.otp)
        toast.success('Reset code generated!')
        setStep(2)
      } else {
        toast.error(result?.message || 'Verification failed.')
      }
    } catch (e) {
      setSubmitting(false)
      toast.error('Verification failed.')
    }
  }

  const handleReset = async () => {
    if (!otp) { toast.error('Enter the 6-digit reset code.'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return }
    if (checkStrength(newPassword).score < 3) { toast.error('Password is too weak.'); return }
    setSubmitting(true)
    try {
      const result = await resetPassword(username, otp, newPassword)
      setSubmitting(false)
      if (result?.ok) {
        toast.success('Password reset! You can now log in.')
        setTimeout(() => navigate('/login'), 1200)
      } else {
        toast.error(result?.message || 'Password reset failed.')
      }
    } catch (e) {
      setSubmitting(false)
      toast.error('Password reset failed.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 relative">
      <button onClick={() => navigate('/login')}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-navy hover:border-slate-300 text-sm font-semibold shadow-sm z-10">
        <i className="fas fa-arrow-left" /> Back to Login
      </button>

      <div className="max-w-md mx-auto pt-12 sm:pt-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg, #0a1f47, #1a56db)' }}>
            <i className="fas fa-key" />
          </div>
          <h2 className="font-display font-extrabold text-xl text-navy">Reset Your Password</h2>
          <p className="text-slate-500 text-xs mt-1">Recover access to your account</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-6 gap-2">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`step-dot ${s < step ? 'done' : s === step ? 'active' : 'pending'}`}>
                {s < step ? <i className="fas fa-check text-xs" /> : s}
              </div>
              {s < 2 && <div className="w-12 h-0.5 mb-0" style={{ background: s < step ? '#10b981' : '#e2e8f0' }} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="card p-5 sm:p-6">

            {step === 1 && (
              <>
                <h3 className="font-display font-bold text-base text-navy mb-1">Step 1: Verify Your Identity</h3>
                <p className="text-xs text-slate-500 mb-5">Enter your account details to receive a 6-digit verification reset code.</p>

                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input className="form-input" value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Your account username" autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Registered Email or Phone Number *</label>
                  <input type="text" className="form-input" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Registered email address or contact number" />
                </div>

                <button onClick={handleRequest} disabled={submitting}
                  className="btn btn-primary w-full justify-center py-3">
                  {submitting
                    ? <><i className="fas fa-spinner fa-spin" /> Sending Verification Code...</>
                    : <><i className="fas fa-paper-plane" /> Send Reset Code</>}
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="font-display font-bold text-base text-navy mb-1">Step 2: Enter Verification Code & New Password</h3>
                <p className="text-xs text-slate-500 mb-5">Check your registered email inbox or phone for the 6-digit verification code.</p>

                <div className="form-group">
                  <label className="form-label">Reset Code *</label>
                  <input className="form-input text-center font-mono text-lg tracking-widest"
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" maxLength={6} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} className="form-input pr-10"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                  <PasswordStrengthMeter password={newPassword} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password *</label>
                  <input type="password" className="form-input"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  {confirmPassword && (
                    <div className={`text-xs mt-1 ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                      <i className={`fas ${newPassword === confirmPassword ? 'fa-circle-check' : 'fa-circle-xmark'} mr-1`} />
                      {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="btn btn-gray flex-1 justify-center">
                    <i className="fas fa-chevron-left" /> Back
                  </button>
                  <button onClick={handleReset} disabled={submitting}
                    className="btn btn-success flex-1 justify-center">
                    {submitting
                      ? <><i className="fas fa-spinner fa-spin" /> Resetting...</>
                      : <><i className="fas fa-lock" /> Reset Password</>}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="text-center text-[11px] text-slate-400 mt-4">
          Remember your password? <button onClick={() => navigate('/login')} className="text-blue-600 font-semibold hover:underline">Sign in</button>
        </div>
      </div>
    </div>
  )
}
