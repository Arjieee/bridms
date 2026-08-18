import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import PasswordStrengthMeter, { checkStrength } from '../components/ui/PasswordStrengthMeter'
import SectorPicker from '../components/ui/SectorPicker'
import { checkDuplicate } from '../components/ui/duplicateCheck'
import toast from 'react-hot-toast'

const blankMember = () => ({ fname: '', lname: '', age: '', sex: '', relationship: '', contact: '', email: '', sectors: [] })

export default function RegisterPage() {
  const navigate = useNavigate()
  const { addPendingReg, puroks, pendingRegistrations, accounts, households } = useAppStore()
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(null)

  const regPasswordRef = useRef(null)
  const regConfirmPwRef = useRef(null)

  const [houseNo, setHouseNo] = useState('')
  const [purokId, setPurokId] = useState('')
  const [head, setHead] = useState({ fname: '', lname: '', age: '', sex: '', contact: '', email: '', sectors: [] })
  const [members, setMembers] = useState([])
  const [emergency, setEmergency] = useState({ receiver_name: '', receiver_contact: '', relationship: '' })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showCpw, setShowCpw] = useState(false)
  const [privacyConsent, setPrivacyConsent] = useState(false)

  const updateHead = (k, v) => setHead(h => {
    const u = { ...h, [k]: v }
    if (k === 'age' && parseInt(v) >= 60 && !u.sectors.includes('senior')) {
      u.sectors = [...u.sectors, 'senior']
    }
    return u
  })

  const addMember = () => setMembers(m => [...m, blankMember()])
  const removeMember = (i) => setMembers(m => m.filter((_, idx) => idx !== i))
  const updateMember = (i, k, v) => setMembers(m => m.map((mb, idx) => idx === i ? { ...mb, [k]: v } : mb))

  const validate1 = () => {
    const e = {}
    if (!purokId) e.purok = 'Please select your Purok.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validate2 = () => {
    const e = {}
    if (!head.fname.trim()) e.hfname = 'First name is required.'
    if (!head.lname.trim()) e.hlname = 'Last name is required.'
    if (!head.age || parseInt(head.age) < 18) e.hage = 'Must be 18 or older.'
    if (!head.sex) e.hsex = 'Please select sex.'
    if (!/^09\d{9}$/.test(head.contact)) e.hcontact = 'Format: 09XXXXXXXXX'
    if (!head.email || !/\S+@\S+\.\S+/.test(head.email)) e.hemail = 'Valid email required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validate3 = () => {
    const e = {}
    members.forEach((m, i) => {
      if (m.sectors?.length > 0) {
        if (!m.contact || !/^09\d{9}$/.test(m.contact)) {
          e[`m${i}_contact`] = 'Contact required for sector members (09XXXXXXXXX)'
        }
        if (!m.email || !/\S+@\S+\.\S+/.test(m.email)) {
          e[`m${i}_email`] = 'Valid email required for sector members'
        }
      }
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validate4 = () => {
    const e = {}
    if (username.length < 8) e.username = 'Username must be at least 8 characters.'
    if (!/^[a-zA-Z0-9_]+$/.test(username)) e.username = 'Letters, numbers, and underscores only.'
    const usernameTaken = [
      ...pendingRegistrations.filter(r => r.status !== 'rejected'),
      ...accounts
    ].find(a => a.username === username)
    if (usernameTaken) e.username = 'Username already taken.'
    if (checkStrength(password).score < 4) e.password = 'Password must be Good or Strong.'
    if (password !== confirmPw) e.confirmPw = 'Passwords do not match.'
    if (!privacyConsent) e.privacy = 'You must agree to the Data Privacy Notice before submitting.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (step === 1 && !validate1()) return
    if (step === 2) {
      if (!validate2()) return
      const dup = checkDuplicate(
        { purok_id: purokId, house_no_street: houseNo, head, username },
        households,
        pendingRegistrations
      )
      if (dup.isDuplicate) {
        setDuplicateWarning(dup)
        return
      }
    }
    if (step === 3 && !validate3()) return
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const prev = () => {
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    if (!validate4()) return
    const dup = checkDuplicate(
      { purok_id: purokId, house_no_street: houseNo, head, username },
      households,
      pendingRegistrations
    )
    if (dup.severity === 'block') {
      setDuplicateWarning(dup)
      return
    }
    setSubmitting(true)
    try {
      const res = await addPendingReg({
        purok_id: parseInt(purokId),
        house_no_street: houseNo || null,
        head: { ...head, age: parseInt(head.age) },
        members: members.map(m => ({ ...m, age: parseInt(m.age) || 0 })),
        emergency_receiver: emergency.receiver_name ? emergency : null,
        username,
        password,
      })
      setSubmitting(false)
      toast.success('Registration submitted! Verification code sent to your email.')
      const targetEmail = encodeURIComponent(head.email || '')
      const targetRegId = encodeURIComponent(res?.id || '')
      setTimeout(() => navigate(`/verify-email?email=${targetEmail}&regId=${targetRegId}`), 1000)
    } catch (err) {
      setSubmitting(false)
      toast.error(err.message || 'Registration failed. Check server status.')
    }
  }

  const STEPS = ['Household', 'Head', 'Members', 'Account']

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 relative">
      <button onClick={() => navigate('/')}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-navy hover:border-slate-300 text-xs sm:text-sm font-semibold shadow-sm z-10 transition-colors">
        <i className="fas fa-arrow-left" /> Back to Home
      </button>

      <div className="max-w-xl mx-auto pt-12 sm:pt-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-3">
            <img src="/logo.png" alt="Barangay Puerto Seal" className="w-full h-full object-contain filter drop-shadow-md" />
          </div>
          <h2 className="font-display font-extrabold text-xl text-navy">Household Registration</h2>
          <p className="text-slate-500 text-xs mt-1">Barangay Puerto, Cagayan de Oro City</p>
        </div>

        <div className="flex items-center justify-between sm:justify-center mb-6 px-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`step-dot ${i + 1 < step ? 'done' : i + 1 === step ? 'active' : 'pending'}`}>
                  {i + 1 < step ? <i className="fas fa-check text-xs" /> : i + 1}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold font-display truncate max-w-[55px] sm:max-w-none text-center"
                  style={{ color: i + 1 === step ? '#1a56db' : '#94a3b8' }}>{s}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-4 sm:w-10 md:w-14 h-0.5 mb-4 mx-1 flex-shrink"
                  style={{ background: i + 1 < step ? '#10b981' : '#e2e8f0' }} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="card p-5 sm:p-6">

            {step === 1 && (
              <>
                <h3 className="font-display font-bold text-base text-navy mb-1">Step 1: Household Information</h3>
                <p className="text-xs text-slate-500 mb-5">Where is your household located?</p>
                <div className="form-group">
                  <label className="form-label">House No. / Street <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input className="form-input" value={houseNo}
                    onChange={e => setHouseNo(e.target.value)}
                    placeholder="e.g. Blk 3 Lot 5 Mabini Street" />
                </div>
                <div className="form-group">
                  <label className="form-label">Purok *</label>
                  <select className={`form-input ${errors.purok ? 'error' : ''}`}
                    value={purokId} onChange={e => setPurokId(e.target.value)}>
                    <option value="">Select your Purok</option>
                    {puroks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {errors.purok && <div className="text-red-500 text-xs mt-1.5">{errors.purok}</div>}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="font-display font-bold text-base text-navy mb-1">Step 2: Household Head</h3>
                <p className="text-xs text-slate-500 mb-5">This person will own the account and act as primary contact.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className={`form-input ${errors.hfname ? 'error' : ''}`}
                      value={head.fname} onChange={e => updateHead('fname', e.target.value)} />
                    {errors.hfname && <div className="text-red-500 text-xs mt-1">{errors.hfname}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className={`form-input ${errors.hlname ? 'error' : ''}`}
                      value={head.lname} onChange={e => updateHead('lname', e.target.value)} />
                    {errors.hlname && <div className="text-red-500 text-xs mt-1">{errors.hlname}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Age * {parseInt(head.age) >= 60 && <span className="text-amber-500 font-normal">· Senior auto-tagged</span>}
                    </label>
                    <input type="number" min="18" className={`form-input ${errors.hage ? 'error' : ''}`}
                      value={head.age} onChange={e => updateHead('age', e.target.value)} />
                    {errors.hage && <div className="text-red-500 text-xs mt-1">{errors.hage}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sex *</label>
                    <select className={`form-input ${errors.hsex ? 'error' : ''}`}
                      value={head.sex} onChange={e => updateHead('sex', e.target.value)}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Prefer not to say</option>
                    </select>
                    {errors.hsex && <div className="text-red-500 text-xs mt-1">{errors.hsex}</div>}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number * (09XXXXXXXXX)</label>
                  <input className={`form-input ${errors.hcontact ? 'error' : ''}`}
                    value={head.contact} onChange={e => updateHead('contact', e.target.value)}
                    placeholder="09171234567" maxLength={11} />
                  {errors.hcontact && <div className="text-red-500 text-xs mt-1">{errors.hcontact}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input type="email" className={`form-input ${errors.hemail ? 'error' : ''}`}
                    value={head.email} onChange={e => updateHead('email', e.target.value)} />
                  {errors.hemail && <div className="text-red-500 text-xs mt-1">{errors.hemail}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Sector Affiliation</label>
                  <SectorPicker selected={head.sectors} onChange={v => updateHead('sectors', v)} />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display font-bold text-base text-navy">Step 3: Members</h3>
                  <button onClick={addMember} type="button" className="btn btn-outline btn-sm">
                    <i className="fas fa-plus" /> Add
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-5">Add other household members (optional).</p>

                {members.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 mb-4">
                    <i className="fas fa-users text-2xl mb-2 block" />
                    <div className="text-sm">No members added yet</div>
                    <div className="text-xs mt-1">Click "Add" above to add members</div>
                  </div>
                )}

                {members.map((m, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4 mb-3 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-display font-bold text-sm text-navy">Member #{i + 1}</div>
                      <button onClick={() => removeMember(i)} type="button"
                        className="w-7 h-7 bg-red-100 text-red-500 rounded-lg flex items-center justify-center text-xs hover:bg-red-200">
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="form-group">
                        <label className="form-label">First Name</label>
                        <input className="form-input" value={m.fname}
                          onChange={e => updateMember(i, 'fname', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Last Name</label>
                        <input className="form-input" value={m.lname}
                          onChange={e => updateMember(i, 'lname', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Age</label>
                        <input type="number" min="0" className="form-input" value={m.age}
                          onChange={e => updateMember(i, 'age', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Sex</label>
                        <select className="form-input" value={m.sex}
                          onChange={e => updateMember(i, 'sex', e.target.value)}>
                          <option value="">Select</option>
                          <option>Male</option>
                          <option>Female</option>
                          <option>Prefer not to say</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Relationship to Head</label>
                      <select className="form-input" value={m.relationship}
                        onChange={e => updateMember(i, 'relationship', e.target.value)}>
                        <option value="">Select</option>
                        {['Spouse', 'Son', 'Daughter', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Relative', 'Other'].map(r =>
                          <option key={r}>{r}</option>
                        )}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sector Affiliation</label>
                      <SectorPicker selected={m.sectors} onChange={v => updateMember(i, 'sectors', v)} />
                    </div>

                    {/* Contact + Email fields appear when sectors are selected */}
                    <AnimatePresence>
                      {m.sectors?.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden">
                          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 mt-2">
                            <div className="text-[11px] font-bold text-blue-700 mb-2">
                              <i className="fas fa-circle-info mr-1" />
                              Contact info is required for sector members (for notifications & verification)
                            </div>
                            <div className="form-group">
                              <label className="form-label">Member's Contact Number *</label>
                              <input className={`form-input ${errors[`m${i}_contact`] ? 'error' : ''}`}
                                value={m.contact}
                                onChange={e => updateMember(i, 'contact', e.target.value)}
                                placeholder="09XXXXXXXXX" maxLength={11} />
                              {errors[`m${i}_contact`] && <div className="text-red-500 text-xs mt-1">{errors[`m${i}_contact`]}</div>}
                            </div>
                            <div className="form-group">
                              <label className="form-label">Member's Email *</label>
                              <input type="email" className={`form-input ${errors[`m${i}_email`] ? 'error' : ''}`}
                                value={m.email}
                                onChange={e => updateMember(i, 'email', e.target.value)}
                                placeholder="member@example.com" />
                              {errors[`m${i}_email`] && <div className="text-red-500 text-xs mt-1">{errors[`m${i}_email`]}</div>}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}

                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="font-display font-bold text-sm text-amber-800 mb-1">
                    <i className="fas fa-user-shield mr-1" />Emergency Receiver
                  </div>
                  <div className="text-xs text-amber-700 mb-3">Trusted person who can claim relief if the head is unavailable.</div>
                  <div className="form-group">
                    <label className="form-label">Receiver Name</label>
                    <input className="form-input" value={emergency.receiver_name}
                      onChange={e => setEmergency(r => ({ ...r, receiver_name: e.target.value }))}
                      placeholder="Full name" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-group">
                      <label className="form-label">Contact</label>
                      <input className="form-input" value={emergency.receiver_contact}
                        onChange={e => setEmergency(r => ({ ...r, receiver_contact: e.target.value }))}
                        placeholder="09XXXXXXXXX" maxLength={11} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Relationship</label>
                      <select className="form-input" value={emergency.relationship}
                        onChange={e => setEmergency(r => ({ ...r, relationship: e.target.value }))}>
                        <option value="">Select</option>
                        {['Spouse', 'Son', 'Daughter', 'Parent', 'Sibling', 'Neighbor', 'Relative', 'Other'].map(r =>
                          <option key={r}>{r}</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h3 className="font-display font-bold text-base text-navy mb-1">Step 4: Account</h3>
                <p className="text-xs text-slate-500 mb-5">Create your login credentials.</p>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 mb-4">
                  <i className="fas fa-shield-halved mr-1" />After registering, an admin must approve your account before you can log in.
                </div>
                <div className="form-group">
                  <label className="form-label">Username * (8+ chars, letters/numbers/underscores)</label>
                  <input className={`form-input ${errors.username ? 'error' : ''}`}
                    value={username}
                    onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        regPasswordRef.current?.focus()
                      }
                    }}
                    placeholder="e.g. juan_delacruz_01" />
                  {errors.username && <div className="text-red-500 text-xs mt-1">{errors.username}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <div className="relative">
                    <input ref={regPasswordRef} type={showPw ? 'text' : 'password'}
                      className={`form-input pr-10 ${errors.password ? 'error' : ''}`}
                      value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          regConfirmPwRef.current?.focus()
                        }
                      }} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                  <PasswordStrengthMeter password={password} />
                  {errors.password && <div className="text-red-500 text-xs mt-1">{errors.password}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password *</label>
                  <div className="relative">
                    <input ref={regConfirmPwRef} type={showCpw ? 'text' : 'password'}
                      className={`form-input pr-10 ${errors.confirmPw ? 'error' : ''}`}
                      value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSubmit()
                        }
                      }} />
                    <button type="button" onClick={() => setShowCpw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <i className={`fas ${showCpw ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                  {confirmPw && (
                    <div className={`text-xs mt-1 ${password === confirmPw ? 'text-emerald-600' : 'text-red-500'}`}>
                      {password === confirmPw ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </div>
                  )}
                  {errors.confirmPw && <div className="text-red-500 text-xs mt-1">{errors.confirmPw}</div>}
                </div>
              </>
            )}

            <div className="flex justify-between mt-6 pt-4 border-t border-slate-100 gap-3">
              <button type="button" onClick={() => step > 1 ? prev() : navigate('/login')}
                className="btn btn-gray flex-1 sm:flex-none">
                <i className="fas fa-chevron-left" />
                {step === 1 ? 'Back to Login' : 'Previous'}
              </button>
              {step < 4 ? (
                <button type="button" onClick={next} className="btn btn-primary flex-1 sm:flex-none">
                  Next <i className="fas fa-chevron-right" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="btn btn-success flex-1 sm:flex-none">
                  {submitting ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
                  Submit
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-2.5">
          <div className="font-bold text-navy"><i className="fas fa-shield-halved mr-1" />Data Privacy Notice</div>
          <div className="leading-relaxed">
            Per the <strong>Philippine Data Privacy Act of 2012 (R.A. 10173)</strong>, your personal information will be:
            (1) used solely for relief management and verification,
            (2) accessible only to authorized barangay personnel,
            (3) never shared with third parties without your consent, and
            (4) retained only for as long as necessary.
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200 text-xs font-semibold text-navy">
            <input type="checkbox" checked={privacyConsent} onChange={e => { setPrivacyConsent(e.target.checked); if (e.target.checked) setErrors(er => ({ ...er, privacy: null })) }}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
            <span>I have read, understood, and agree to the <strong>Data Privacy Notice</strong> above. *</span>
          </label>
          {errors.privacy && <div className="text-red-500 text-xs font-semibold mt-1">{errors.privacy}</div>}
        </div>
        <div className="text-center text-[11px] text-slate-400 mt-2">
          Step {step} of 4
        </div>
      </div>

      {/* Duplicate Warning Modal */}
      <AnimatePresence>
        {duplicateWarning && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && duplicateWarning.severity !== 'block' && setDuplicateWarning(null)}>
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
              <div className="modal-header" style={{ background: duplicateWarning.severity === 'block' ? '#fee2e2' : '#fef3c7' }}>
                <h3 className="font-display font-bold text-base" style={{ color: duplicateWarning.severity === 'block' ? '#991b1b' : '#92400e' }}>
                  <i className={`fas ${duplicateWarning.severity === 'block' ? 'fa-ban' : 'fa-triangle-exclamation'} mr-2`} />
                  {duplicateWarning.severity === 'block' ? 'Duplicate Detected — Cannot Proceed' : 'Possible Duplicate'}
                </h3>
              </div>
              <div className="modal-body">
                <p className="text-sm text-slate-700 mb-3">
                  {duplicateWarning.severity === 'block'
                    ? 'The information you entered is too similar to an existing record. Please review the conflicts below and adjust your registration, or contact your barangay admin if this is an error.'
                    : 'The information you entered may match an existing record. Please review before proceeding.'}
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {duplicateWarning.conflicts.map((c, i) => (
                    <div key={i} className="p-3 rounded-xl border" style={{
                      background: duplicateWarning.severity === 'block' ? '#fef2f2' : '#fffbeb',
                      borderColor: duplicateWarning.severity === 'block' ? '#fecaca' : '#fde68a',
                    }}>
                      <div className="text-xs font-bold uppercase mb-1" style={{ color: duplicateWarning.severity === 'block' ? '#991b1b' : '#92400e' }}>
                        Match score: {c.score}%
                      </div>
                      <div className="text-sm text-slate-700">{c.message}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                {duplicateWarning.severity === 'block' ? (
                  <button onClick={() => setDuplicateWarning(null)} className="btn btn-primary">
                    <i className="fas fa-arrow-left" /> Go Back and Edit
                  </button>
                ) : (
                  <>
                    <button onClick={() => setDuplicateWarning(null)} className="btn btn-gray">
                      <i className="fas fa-arrow-left" /> Go Back and Edit
                    </button>
                    <button onClick={() => {
                      setDuplicateWarning(null)
                      setStep(s => s + 1)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }} className="btn btn-warning">
                      <i className="fas fa-check" /> Continue Anyway
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
