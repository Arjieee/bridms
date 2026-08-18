import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import SectorPicker from '../../components/ui/SectorPicker'
import toast from 'react-hot-toast'

export default function BeneficiaryDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { households, qrCodes, cycles, distributions, pendingMemberStatusChanges,
    confirmMemberStatusChange, disputeMemberStatusChange, requestMemberReactivation, addHouseholdMember, updateHouseholdMember } = useAppStore()
  const [expandedMember, setExpandedMember] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [editForm, setEditForm] = useState({
    fname: '', lname: '', age: '', sex: '', relationship: '',
    contact: '', email: '', sectors: [],
  })
  const [memberForm, setMemberForm] = useState({
    fname: '', lname: '', age: '', sex: '', relationship: '',
    contact: '', email: '', sectors: [],
  })
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeFor, setDisputeFor] = useState(null)

  const hh = households.find(h => h.account_id === user?.id)
  const activeCycles = cycles.filter(c => c.is_active)

  const handleRequestReactivation = async () => {
    const inactiveMember = hh?.members?.find(m => m.status === 'inactive')
    if (!inactiveMember) return
    const res = await requestMemberReactivation(inactiveMember.id, 'Requesting account/member reactivation.')
    if (res?.ok) {
      toast.success('Reactivation request sent to barangay admin!')
    } else {
      toast.error(res?.message || 'Failed to send reactivation request.')
    }
  }

  // Distribution history for my household
  const myDistributions = distributions
    .filter(d => d.household_id === hh?.id)
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))

  // Status change proposals from admin awaiting MY confirmation
  const myStatusProposals = (pendingMemberStatusChanges || []).filter(r =>
    r.hh_id === hh?.id && r.status === 'pending'
  )

  const myQRs = qrCodes
    .filter(q => q.household_id === hh?.id && activeCycles.some(c => c.id === q.cycle_id))
    .map(q => ({ ...q, cycle: activeCycles.find(c => c.id === q.cycle_id) }))

  const householdQRs = myQRs.filter(q => q.type === 'household')
  const memberQRs = (memberId) => myQRs.filter(q => q.type === 'member' && q.member_id === memberId)

  const downloadQR = (token, name) => {
    const svg = document.getElementById(`qr-svg-${token}`)
    if (!svg) { toast.error('Could not generate download.'); return }
    const data = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 400, 400)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 50, 50, 300, 300)
      const a = document.createElement('a')
      a.download = `QR-${name}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
      toast.success('QR downloaded!')
    }
    img.onerror = () => toast.error('Download failed.')
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)))
  }

  const handleAddMember = async () => {
    if (!memberForm.fname.trim() || !memberForm.lname.trim()) {
      toast.error('Name is required.')
      return
    }
    if (!memberForm.age || parseInt(memberForm.age) < 0) {
      toast.error('Valid age is required.')
      return
    }
    if (!memberForm.sex || !memberForm.relationship) {
      toast.error('Sex and relationship are required.')
      return
    }
    if (memberForm.sectors?.length > 0) {
      if (!/^09\d{9}$/.test(memberForm.contact)) {
        toast.error('Contact required for sector members (09XXXXXXXXX).')
        return
      }
      if (!memberForm.email || !/\S+@\S+\.\S+/.test(memberForm.email)) {
        toast.error('Valid email required for sector members.')
        return
      }
    }
    const result = await addHouseholdMember(hh.id, memberForm)
    if (result?.ok) {
      toast.success(result.message || `${memberForm.fname} ${memberForm.lname} addition request submitted!`)
      setShowAddMember(false)
      setMemberForm({ fname:'', lname:'', age:'', sex:'', relationship:'', contact:'', email:'', sectors:[] })
    } else {
      toast.error(result?.message || 'Failed to submit member addition request.')
    }
  }

  const handleConfirm = async (req) => {
    if (window.confirm(`Confirm that ${req.member_name} should be marked as "${req.new_status}"?`)) {
      const res = await confirmMemberStatusChange(req.id)
      if (res?.ok) toast.success('Status change confirmed.')
      else toast.error(res?.message || 'Failed to confirm status change.')
    }
  }

  const startEditMember = (m) => {
    setEditingMember(m)
    setEditForm({
      fname: m.fname || '',
      lname: m.lname || '',
      age: m.age !== undefined ? String(m.age) : '',
      sex: m.sex || '',
      relationship: m.relationship || '',
      contact: m.contact || '',
      email: m.email || '',
      sectors: m.sectors || [],
    })
  }

  const handleUpdateMember = async () => {
    if (!editForm.fname.trim() || !editForm.lname.trim()) {
      toast.error('First name and last name are required.')
      return
    }
    if (editForm.contact && !/^09\d{9}$/.test(editForm.contact)) {
      toast.error('Contact format must be 09XXXXXXXXX.')
      return
    }
    if (editForm.email && !/\S+@\S+\.\S+/.test(editForm.email)) {
      toast.error('Please enter a valid email address.')
      return
    }
    const res = await updateHouseholdMember(hh.id, editingMember.id, editForm)
    if (res?.ok) {
      toast.success(`Updated info for ${editForm.fname} ${editForm.lname}!`)
      setEditingMember(null)
    } else {
      toast.error(res?.message || 'Failed to update member.')
    }
  }

  const handleDispute = async () => {
    const res = await disputeMemberStatusChange(disputeFor.id, disputeReason)
    if (res?.ok) toast.success('Status change disputed.')
    else toast.error(res?.message || 'Failed to dispute status change.')
    setDisputeFor(null)
    setDisputeReason('')
  }

  if (!hh) {
    return (
      <div className="card p-8 text-center text-slate-400">
        <i className="fas fa-house-circle-exclamation text-4xl mb-3 block text-slate-300" />
        <div className="text-sm font-semibold">No household linked</div>
        <div className="text-xs mt-1">Contact admin if you believe this is an error.</div>
      </div>
    )
  }

  const head = hh.members?.find(m => m.is_head)

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="card p-5 text-white" style={{ background: 'linear-gradient(135deg, #0a1f47, #1a56db)' }}>
          <div className="text-white/60 text-[10px] font-bold uppercase tracking-wide">My Household</div>
          <div className="font-display font-bold text-lg mt-1">{head?.fname} {head?.lname}</div>
          <div className="text-white/70 text-sm mt-1">
            <i className="fas fa-map-marker-alt mr-1" />{hh.purok_name}
            {hh.house_no_street && ` · ${hh.house_no_street}`}
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase">HH Code</div>
              <div className="font-mono text-sm text-white">{hh.hh_code}</div>
            </div>
            <span className="badge badge-approved ml-auto">Approved</span>
          </div>
        </motion.div>

        {/* Status change proposals awaiting my confirmation */}
        {myStatusProposals.length > 0 && (
          <div className="card p-4 border-l-4 border-amber-500 bg-amber-50/30">
            <div className="font-display font-bold text-sm text-amber-800 mb-2">
              <i className="fas fa-circle-exclamation mr-2 animate-pulse" />
              Action Required: Confirm Member Status
            </div>
            <div className="space-y-2">
              {myStatusProposals.map(req => (
                <div key={req.id} className="bg-white rounded-xl p-3 border border-amber-200">
                  <div className="text-sm text-navy font-semibold">{req.member_name}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Admin <strong>{req.proposed_by_name}</strong> proposes status change:
                  </div>
                  <div className="text-xs text-slate-700 mt-1">
                    <span className="capitalize">{req.current_status}</span>
                    <i className="fas fa-arrow-right text-slate-400 mx-2" />
                    <strong className="capitalize text-amber-700">{req.new_status}</strong>
                  </div>
                  {req.remarks && (
                    <div className="text-xs text-slate-600 mt-1 italic">"{req.remarks}"</div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleConfirm(req)} className="btn btn-success btn-xs flex-1 justify-center">
                      <i className="fas fa-check" /> Confirm
                    </button>
                    <button onClick={() => { setDisputeFor(req); setDisputeReason('') }} className="btn btn-danger btn-xs flex-1 justify-center">
                      <i className="fas fa-xmark" /> Dispute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inactive Member Reactivation Banner */}
        {hh?.members?.some(m => m.status === 'inactive') && (
          <div className="card p-4 border-l-4 border-amber-500 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="font-display font-bold text-sm text-amber-900">
                <i className="fas fa-user-slash mr-2 text-amber-600" />
                Member Inactive Status Notice
              </div>
              <div className="text-xs text-amber-700 mt-1">
                One or more household members are currently marked as inactive. Inactive members cannot receive QR passes for relief distributions. You can request account reactivation from the admin.
              </div>
            </div>
            <button
              onClick={handleRequestReactivation}
              className="btn btn-warning btn-xs flex-shrink-0 self-start sm:self-center"
            >
              <i className="fas fa-rotate-left mr-1" /> Request Reactivation
            </button>
          </div>
        )}

        {/* Household-level QR codes */}
        {householdQRs.length > 0 && (
          <div className="space-y-3">
            {householdQRs.map(qr => (
              <div key={qr.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-navy truncate">{qr.cycle?.name}</div>
                    <div className="text-xs text-slate-400 capitalize mt-0.5">{qr.cycle?.type} cycle</div>
                  </div>
                  <span className={`badge flex-shrink-0 ${qr.is_claimed ? 'badge-claimed' : 'badge-eligible'}`}>
                    {qr.is_claimed ? 'Claimed' : 'Eligible'}
                  </span>
                </div>

                {/* Distribution Schedule & Claim Location Details */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-3 space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-semibold text-navy">
                    <i className="fas fa-calendar-day text-blue-600 w-4 text-center" />
                    <span>Claim Date: <strong>{qr.cycle?.distribution_date || 'Schedule Announced Soon'}</strong> ({qr.cycle?.distribution_time || '8:00 AM - 5:00 PM'})</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fas fa-location-dot text-emerald-600 w-4 text-center mt-0.5" />
                    <span>Claim Venue: <strong>{qr.cycle?.claim_address || 'Barangay Puerto Covered Court'}</strong></span>
                  </div>
                  {qr.cycle?.contact_person && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <i className="fas fa-user-tie text-purple-600 w-4 text-center" />
                      <span>Contact Person: <strong>{qr.cycle.contact_person}</strong></span>
                    </div>
                  )}
                </div>

                {!qr.is_claimed ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <QRCodeSVG id={`qr-svg-${qr.qr_token}`} value={`BPR-SECURED::${qr.qr_token}`} size={180} level="H" />
                    </div>
                    <button onClick={() => downloadQR(qr.qr_token, hh.hh_code)}
                      className="btn btn-primary btn-sm w-full justify-center">
                      <i className="fas fa-download" /> Download QR Code
                    </button>
                    <div className="text-[11px] text-slate-400 text-center">
                      Present this QR during distribution to claim relief.
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-3 text-emerald-600 text-sm font-semibold">
                    <i className="fas fa-circle-check text-lg mb-1 block" />Already received
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {householdQRs.length === 0 && myQRs.length === 0 && (
          <div className="card p-6 text-center text-slate-400">
            <i className="fas fa-qrcode text-4xl mb-3 block text-slate-200" />
            <div className="text-sm font-semibold">No active QR codes</div>
            <div className="text-xs mt-1">Your QR will appear here when a cycle is activated.</div>
          </div>
        )}

        {/* Emergency receiver */}
        {hh.emergency_receiver?.receiver_name && (
          <div className="card p-4">
            <div className="font-display font-bold text-sm text-navy mb-2">
              <i className="fas fa-user-shield mr-2 text-amber-500" />Emergency Receiver
            </div>
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <div className="font-semibold text-sm text-amber-900">{hh.emergency_receiver.receiver_name}</div>
              <div className="text-xs text-amber-700 mt-0.5">
                {hh.emergency_receiver.receiver_contact} · {hh.emergency_receiver.relationship}
              </div>
            </div>
          </div>
        )}

        {/* Members */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-bold text-sm text-navy">
              <i className="fas fa-users mr-2 text-blue-500" />Household Members ({hh.members?.length || 0})
            </div>
            <button onClick={() => setShowAddMember(true)} className="btn btn-outline btn-xs">
              <i className="fas fa-plus" /> Add Member
            </button>
          </div>
        <div className="space-y-2">
          {hh.members?.map(m => {
            const isExpanded = expandedMember === m.id
            const myMemberQRs = memberQRs(m.id)
            const hasUnclaimedQR = myMemberQRs.some(q => !q.is_claimed)

            return (
              <div key={m.id} className="border border-slate-100 rounded-xl overflow-hidden">
                <div onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                      {m.fname?.[0]}{m.lname?.[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-navy flex items-center gap-1.5 flex-wrap">
                        {m.fname} {m.lname}
                        {m.is_head && <span className="badge badge-approved">Head</span>}
                      </div>
                      <div className="text-[11px] text-slate-400">{m.age}y · {m.sex} · {m.relationship}</div>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {m.approval_status === 'pending' ? (
                          <span className="badge badge-pending">
                            <i className="fas fa-clock mr-1" />Awaiting Admin Approval
                          </span>
                        ) : (
                          <span className={`badge badge-${m.status}`}>{m.status}</span>
                        )}
                        {m.sectors?.map(s => <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasUnclaimedQR && <i className="fas fa-qrcode text-blue-500 text-sm" title="Has active QR" />}
                    <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-400 text-xs`} />
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-100 overflow-hidden">
                      <div className="p-3 bg-slate-50 space-y-2">
                        {m.approval_status === 'pending' && (
                          <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center font-medium">
                            <i className="fas fa-hourglass-half mr-1.5" />
                            Member addition requested. QR codes and relief benefits will be activated once approved by Barangay Admin.
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          {[['Contact', m.contact || '—'], ['Email', m.email || '—']].map(([k, v]) => (
                            <div key={k} className="bg-white p-2.5 rounded-xl">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">{k}</div>
                              <div className="text-xs font-semibold text-navy mt-0.5 truncate">{v}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end pt-1">
                          <button onClick={(e) => { e.stopPropagation(); startEditMember(m) }}
                            className="btn btn-outline btn-xs flex items-center gap-1 text-xs text-blue-700 border-blue-200 hover:bg-blue-50">
                            <i className="fas fa-pen text-[10px] mr-1" /> Update Contact & Info
                          </button>
                        </div>

                        {myMemberQRs.map(qr => (
                          <div key={qr.id} className="bg-white p-3 rounded-xl border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-bold text-blue-700">
                                <i className="fas fa-qrcode mr-1" />{qr.cycle?.name}
                              </div>
                              <span className={`badge ${qr.is_claimed ? 'badge-claimed' : 'badge-eligible'}`}>
                                {qr.is_claimed ? 'Claimed' : 'Active'}
                              </span>
                            </div>
                            {!qr.is_claimed && (
                              <div className="flex flex-col items-center gap-2">
                                <QRCodeSVG id={`qr-svg-${qr.qr_token}`} value={`BPR-SECURED::${qr.qr_token}`} size={140} level="H" />
                                <button onClick={() => downloadQR(qr.qr_token, `${m.fname}-${m.lname}`)}
                                  className="btn btn-primary btn-xs w-full justify-center">
                                  <i className="fas fa-download" /> Download
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {m.sectors?.length > 0 && myMemberQRs.length === 0 && (
                          <div className="text-[11px] text-slate-400 text-center bg-white p-2.5 rounded-xl">
                            <i className="fas fa-clock mr-1" />No active sector cycle yet
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddMember && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddMember(false)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
              <div className="modal-header">
                <h3 className="font-display font-bold text-base text-navy">
                  <i className="fas fa-user-plus text-blue-500 mr-2" />Add New Household Member
                </h3>
                <button onClick={() => setShowAddMember(false)} className="btn btn-gray btn-xs">
                  <i className="fas fa-xmark" />
                </button>
              </div>
              <div className="modal-body">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 mb-4">
                  <i className="fas fa-circle-info mr-1" />
                  Add a new member (e.g. newborn baby, relative who moved in). If the member is eligible for an active sector cycle, a QR code will be auto-generated.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className="form-input" value={memberForm.fname}
                      onChange={e => setMemberForm(f => ({ ...f, fname: e.target.value }))} autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className="form-input" value={memberForm.lname}
                      onChange={e => setMemberForm(f => ({ ...f, lname: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Age *</label>
                    <input type="number" min="0" className="form-input" value={memberForm.age}
                      onChange={e => setMemberForm(f => ({ ...f, age: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sex *</label>
                    <select className="form-input" value={memberForm.sex}
                      onChange={e => setMemberForm(f => ({ ...f, sex: e.target.value }))}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Prefer not to say</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Relationship to Head *</label>
                  <select className="form-input" value={memberForm.relationship}
                    onChange={e => setMemberForm(f => ({ ...f, relationship: e.target.value }))}>
                    <option value="">Select</option>
                    {['Spouse','Son','Daughter','Parent','Sibling','Grandparent','Grandchild','Relative','Other'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Sector Affiliation</label>
                  <SectorPicker selected={memberForm.sectors}
                    onChange={v => setMemberForm(f => ({ ...f, sectors: v }))} />
                </div>
                <AnimatePresence>
                  {memberForm.sectors?.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden">
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="text-[11px] font-bold text-blue-700 mb-2">
                          <i className="fas fa-circle-info mr-1" />Required for sector members
                        </div>
                        <div className="form-group">
                          <label className="form-label">Contact Number *</label>
                          <input className="form-input" value={memberForm.contact}
                            onChange={e => setMemberForm(f => ({ ...f, contact: e.target.value }))}
                            placeholder="09XXXXXXXXX" maxLength={11} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Email Address *</label>
                          <input type="email" className="form-input" value={memberForm.email}
                            onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowAddMember(false)} className="btn btn-gray">Cancel</button>
                <button onClick={handleAddMember} className="btn btn-primary">
                  <i className="fas fa-user-plus" /> Add Member
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dispute Modal */}
      <AnimatePresence>
        {disputeFor && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDisputeFor(null)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
              <div className="modal-header">
                <h3 className="font-display font-bold text-base text-navy">Dispute Status Change</h3>
                <button onClick={() => setDisputeFor(null)} className="btn btn-gray btn-xs">
                  <i className="fas fa-xmark" />
                </button>
              </div>
              <div className="modal-body">
                <div className="text-sm text-slate-600 mb-3">
                  Disputing proposed change: <strong className="text-navy">{disputeFor.member_name}</strong> →{' '}
                  <span className="capitalize text-amber-700">{disputeFor.new_status}</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason for dispute (optional)</label>
                  <textarea className="form-input" rows={3} value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                    placeholder="Why do you disagree with this status change?" />
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={() => setDisputeFor(null)} className="btn btn-gray">Cancel</button>
                <button onClick={handleDispute} className="btn btn-danger">
                  <i className="fas fa-flag" /> Submit Dispute
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Update Member Modal */}
      <AnimatePresence>
        {editingMember && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingMember(null)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
              <div className="modal-header">
                <h3 className="font-display font-bold text-base text-navy">
                  <i className="fas fa-user-pen text-blue-500 mr-2" />Update Member Information
                </h3>
                <button onClick={() => setEditingMember(null)} className="btn btn-gray btn-xs">
                  <i className="fas fa-xmark" />
                </button>
              </div>
              <div className="modal-body space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className="form-input" value={editForm.fname}
                      onChange={e => setEditForm(f => ({ ...f, fname: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className="form-input" value={editForm.lname}
                      onChange={e => setEditForm(f => ({ ...f, lname: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Age</label>
                    <input type="number" min="0" className="form-input" value={editForm.age}
                      onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sex</label>
                    <select className="form-input" value={editForm.sex}
                      onChange={e => setEditForm(f => ({ ...f, sex: e.target.value }))}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Prefer not to say</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number (09XXXXXXXXX)</label>
                  <input className="form-input" value={editForm.contact}
                    onChange={e => setEditForm(f => ({ ...f, contact: e.target.value }))}
                    placeholder="09XXXXXXXXX" maxLength={11} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address / Gmail</label>
                  <input type="email" className="form-input" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="member@gmail.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Relationship to Head</label>
                  <select className="form-input" value={editForm.relationship}
                    onChange={e => setEditForm(f => ({ ...f, relationship: e.target.value }))}>
                    <option value="">Select</option>
                    {['Head', 'Spouse', 'Son', 'Daughter', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Relative', 'Other'].map(r =>
                      <option key={r}>{r}</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Sector Affiliation</label>
                  <SectorPicker selected={editForm.sectors} onChange={v => setEditForm(f => ({ ...f, sectors: v }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={() => setEditingMember(null)} className="btn btn-gray">Cancel</button>
                <button onClick={handleUpdateMember} className="btn btn-primary">
                  <i className="fas fa-save" /> Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
