import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import toast from 'react-hot-toast'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emailParam = searchParams.get('email') || ''
  const regIdParam = searchParams.get('regId') || ''

  const { verifyEmail, resendVerificationToken } = useAppStore()

  const [email, setEmail] = useState(emailParam)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [verified, setVerified] = useState(false)

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ]

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  // Focus first input on mount
  useEffect(() => {
    inputRefs[0].current?.focus()
  }, [])

  const handleDigitChange = (index, value) => {
    // Handle pasted 6-digit code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newCode = [...code]
      digits.forEach((d, i) => {
        if (i < 6) newCode[i] = d
      })
      setCode(newCode)
      const nextIndex = Math.min(digits.length, 5)
      inputRefs[nextIndex].current?.focus()
      return
    }

    const digit = value.replace(/\D/g, '')
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)

    if (digit && index < 5) {
      inputRefs[index + 1].current?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  const handleVerify = async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      toast.error('Please enter all 6 digits of your verification code.')
      return
    }

    setSubmitting(true)
    try {
      const res = await verifyEmail(email, fullCode, regIdParam)
      setSubmitting(false)
      if (res.ok) {
        setVerified(true)
        toast.success('Email verified successfully! 🎉')
      } else {
        toast.error(res.message || 'Verification failed. Please check the code.')
      }
    } catch (err) {
      setSubmitting(false)
      toast.error(err.message || 'Error verifying email.')
    }
  }

  const handleResend = async () => {
    if (!email) {
      toast.error('Email address is required.')
      return
    }

    setResending(true)
    try {
      const res = await resendVerificationToken(email, regIdParam)
      setResending(false)
      if (res.ok) {
        toast.success('A new 6-digit verification code was sent to your email!')
        setCooldown(30)
      } else {
        toast.error(res.message || 'Failed to resend verification code.')
      }
    } catch (err) {
      setResending(false)
      toast.error('Failed to resend verification code.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 py-8 px-4 relative flex items-center justify-center">
      <button onClick={() => navigate('/login')}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-navy hover:border-slate-300 text-xs sm:text-sm font-semibold shadow-sm z-10 transition-all">
        <i className="fas fa-arrow-left" /> Back to Login
      </button>

      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-3 shadow-lg shadow-blue-500/20"
            style={{ background: 'linear-gradient(135deg, #10b981, #1a56db)' }}>
            <i className="fas fa-envelope-circle-check" />
          </div>
          <h2 className="font-display font-extrabold text-2xl text-navy">Email Verification</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Barangay Puerto Relief Management System</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 sm:p-8 bg-white/90 backdrop-blur-md shadow-xl border border-slate-100 rounded-2xl">

          {!verified ? (
            <>
              <div className="p-4 bg-blue-50/80 border border-blue-200/60 rounded-xl text-xs text-blue-900 mb-6 flex items-start gap-3">
                <i className="fas fa-paper-plane text-blue-600 text-base mt-0.5" />
                <div>
                  We sent a <strong>6-digit verification code</strong> via Brevo to your email address:
                  <div className="font-semibold text-blue-700 font-mono mt-1 break-all">
                    {email || 'Your registered email'}
                  </div>
                </div>
              </div>

              {!emailParam && (
                <div className="form-group mb-5">
                  <label className="form-label">Registered Email Address</label>
                  <input type="email" className="form-input" value={email}
                    onChange={e => setEmail(e.target.value)} placeholder="e.g. resident@example.com" />
                </div>
              )}

              <div className="form-group mb-6 text-center">
                <label className="form-label mb-3 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Enter 6-Digit Code
                </label>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={inputRefs[index]}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={e => handleDigitChange(index, e.target.value)}
                      onKeyDown={e => handleKeyDown(index, e)}
                      className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleVerify}
                disabled={submitting}
                className="btn btn-emerald w-full justify-center py-3 text-sm font-bold shadow-md shadow-emerald-600/20 mb-4">
                {submitting ? (
                  <><i className="fas fa-spinner fa-spin mr-2" /> Verifying Code...</>
                ) : (
                  <><i className="fas fa-check-circle mr-2" /> Verify Email Address</>
                )}
              </button>

              <div className="text-center border-t border-slate-100 pt-4 flex flex-col items-center gap-2">
                <span className="text-xs text-slate-500">Didn't receive the email code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-400 flex items-center gap-1.5 transition-colors">
                  {resending ? (
                    <><i className="fas fa-spinner fa-spin" /> Sending...</>
                  ) : cooldown > 0 ? (
                    <><i className="fas fa-clock" /> Resend code in {cooldown}s</>
                  ) : (
                    <><i className="fas fa-rotate-right" /> Resend Verification Code via Brevo</>
                  )}
                </button>
              </div>
            </>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                  <i className="fas fa-circle-check" />
                </div>
                <h3 className="font-display font-extrabold text-xl text-navy mb-2">Email Verified Successfully!</h3>
                <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                  Your email address <strong className="text-slate-800 font-mono">{email}</strong> has been verified.
                  Your registration is currently under review by Barangay Puerto administrators.
                </p>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 mb-6">
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    <i className="fas fa-clock-rotate-left" /> Next Step: Admin Review
                  </div>
                  Once an authorized barangay admin reviews and approves your household registration, you can log in using your account credentials.
                </div>

                <button
                  onClick={() => navigate('/login')}
                  className="btn btn-primary w-full justify-center py-3 font-bold shadow-md shadow-blue-600/20">
                  <i className="fas fa-right-to-bracket mr-2" /> Return to Login
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>

        <div className="text-center text-[11px] text-slate-400 mt-4">
          Barangay Puerto Relief System &copy; 2026 · Powered by Brevo Transports
        </div>
      </div>
    </div>
  )
}
