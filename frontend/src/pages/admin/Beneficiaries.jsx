import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { fuzzyMatch } from '../../utils/fuzzySearch'
import { exportToCsv } from '../../utils/csvExport'
import toast from 'react-hot-toast'

export default function AdminBeneficiaries() {
  const { user } = useAuthStore()
  const { households, puroks, sectors, qrCodes, cycles, proposeMemberStatusChange,
    pendingMemberStatusChanges, pendingMemberAdditions, approveMemberAddition, rejectMemberAddition } = useAppStore()
  const isStaff = user?.role === 'staff'
  const isAdmin = user?.role === 'admin'
  const [search, setSearch] = useState('')
  const [purokFilter, setPurok] = useState('')
  const [sectorFilter, setSector] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive' | 'deceased'
  const [expanded, setExpanded] = useState({})
  const [memberDetail, setMemberDetail] = useState(null)
  const [statusModal, setStatusModal] = useState(null)
  const [newStatus, setNewStatus] = useState('active')
  const [statusRemarks, setStatusRemarks] = useState('')

  const activeCycle = cycles.find(c => c.is_active)

  const totalHouseholdsCount = households.length
  const totalResidentsCount = households.reduce((sum, hh) => sum + (hh.members?.length || 0), 0)

  const filtered = households.filter(hh => {
    if (purokFilter && String(hh.purok_id) !== purokFilter) return false
    if (sectorFilter) {
      const hasSector = hh.members?.some(m => m.sectors?.includes(sectorFilter))
      if (!hasSector) return false
    }
    if (statusFilter !== 'all') {
      const hasStatusMember = hh.members?.some(m => {
        const mStatus = m.status || 'active';
        return mStatus === statusFilter;
      });
      if (!hasStatusMember) return false;
    }
    if (search) {
      const head = hh.members?.find(m => m.is_head)
      const memberNames = (hh.members || []).map(m => `${m.fname} ${m.lname}`)
      const purokName = puroks.find(p => p.id === hh.purok_id)?.name || ''
      const targetFields = [
        hh.hh_code,
        head ? `${head.fname} ${head.lname}` : '',
        ...memberNames,
        purokName,
      ]
      if (!fuzzyMatch(targetFields, search)) return false
    }
    return true
  })

  const filteredResidentsCount = filtered.reduce((sum, hh) => sum + (hh.members?.length || 0), 0)

  const handleStatusUpdate = async () => {
    if (newStatus !== 'active' && !statusRemarks.trim()) {
      toast.error('Please provide a reason for the status change.')
      return
    }
    const result = await proposeMemberStatusChange(statusModal.hh_id, statusModal.member.id, newStatus, statusRemarks)
    if (result?.ok) {
      if (result.applied) {
        toast.success('Member status restored to active.')
      } else {
        toast.success('Status change sent to beneficiary for confirmation.')
      }
    } else {
      toast.error(result?.message || 'Failed to submit status change.')
    }
    setStatusModal(null)
    setStatusRemarks('')
    setNewStatus('active')
  }

  const handleExportCSV = () => {
    const headers = [
      { label: 'Household Code', key: 'hh_code' },
      { label: 'Head of Household', key: 'head_name' },
      { label: 'Purok', key: 'purok_name' },
      { label: 'Address / Street', key: 'address' },
      { label: 'Total Members', key: 'total_members' },
      { label: 'Contact Number', key: 'contact' },
      { label: 'Email Address', key: 'email' },
      { label: 'All Members (Age/Sector/Status)', key: 'members_summary' },
      { label: 'Registration Date', key: 'reg_date' },
      { label: 'Status', key: 'status' },
    ]
    const rows = filtered.map(hh => {
      const head = hh.members?.find(m => m.is_head)
      const purokName = puroks.find(p => p.id === hh.purok_id)?.name || hh.purok_name || 'Unknown'
      const membersSummary = (hh.members || []).map(m => {
        const sec = m.sectors?.length > 0 ? ` [${m.sectors.join('/')}]` : ''
        const stat = m.status && m.status !== 'active' ? ` (${m.status.toUpperCase()})` : ''
        return `${m.fname} ${m.lname} (${m.age || 'N/A'}${sec}${stat})`
      }).join('; ')

      return {
        hh_code: hh.hh_code,
        head_name: head ? `${head.fname} ${head.lname}` : 'N/A',
        purok_name: purokName,
        address: hh.house_no_street || 'Barangay Puerto',
        total_members: hh.members?.length || 0,
        contact: head?.contact || hh.contact || 'N/A',
        email: head?.email || hh.email || 'N/A',
        members_summary: membersSummary,
        reg_date: hh.reg_date || 'N/A',
        status: hh.status || 'approved',
      }
    })
    exportToCsv('Beneficiaries_Masterlist', headers, rows)
  }

  return (
    <div>

      {/* Compact Leveled Summary Cards & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mb-3.5 items-stretch">
        <div className="card px-3 py-2 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs flex-shrink-0">
            <i className="fas fa-house-user" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 font-semibold leading-tight truncate">Total Households:</div>
            <div className="font-display font-extrabold text-sm text-navy leading-tight">{totalHouseholdsCount}</div>
          </div>
        </div>
        <div className="card px-3 py-2 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs flex-shrink-0">
            <i className="fas fa-users" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 font-semibold leading-tight truncate">Total Residents:</div>
            <div className="font-display font-extrabold text-sm text-navy leading-tight">{totalResidentsCount}</div>
          </div>
        </div>
        <div className="relative w-full h-full min-h-[40px] flex items-center sm:col-span-2 md:col-span-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs z-10 pointer-events-none" />
          <input className="form-input w-full h-full min-h-[40px] bg-white border border-slate-200/90 rounded-xl shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-medium"
            style={{ paddingLeft: '38px', paddingRight: isStaff ? '90px' : '14px' }}
            placeholder="Search by name or HH code..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {isStaff && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 badge badge-pending text-[9px] py-0.5 px-1.5">
              <i className="fas fa-eye mr-1" />View only
            </span>
          )}
        </div>
      </div>

      {/* Pending Member Addition Requests */}
      {isAdmin && (pendingMemberAdditions || []).filter(r => r.status === 'pending').length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-blue-500 bg-blue-50/30">
          <div className="font-display font-bold text-sm text-navy mb-3 flex items-center justify-between">
            <span>
              <i className="fas fa-user-clock text-blue-600 mr-2" />
              Pending Member Addition Requests ({(pendingMemberAdditions || []).filter(r => r.status === 'pending').length})
            </span>
            <span className="badge badge-eligible">Requires Admin Approval</span>
          </div>
          <div className="space-y-2">
            {(pendingMemberAdditions || []).filter(r => r.status === 'pending').map(req => (
              <div key={req.id} className="bg-white rounded-xl p-3 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-navy">{req.member_name}</div>
                  <div className="text-xs text-slate-500">
                    Household: <strong className="text-navy">{req.hh_code}</strong> ({req.purok_name}) · Head: {req.head_name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Age: {req.member_data?.age} · Sex: {req.member_data?.sex} · Relationship: {req.member_data?.relationship}
                    {req.member_data?.sectors?.length > 0 && ` · Sectors: ${req.member_data.sectors.join(', ')}`}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={async () => {
                    const res = await approveMemberAddition(req.id);
                    if (res?.ok) toast.success(`Approved ${req.member_name}!`);
                    else toast.error(res?.message || 'Failed to approve member.');
                  }} className="btn btn-primary btn-xs">
                    <i className="fas fa-check" /> Approve Member
                  </button>
                  <button onClick={async () => {
                    const res = await rejectMemberAddition(req.id);
                    if (res?.ok) toast.error(`Declined ${req.member_name}.`);
                    else toast.error(res?.message || 'Failed to decline member.');
                  }} className="btn btn-outline btn-xs text-red-600 border-red-200 hover:bg-red-50">
                    <i className="fas fa-xmark" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status changes awaiting beneficiary confirmation */}
      {isAdmin && (pendingMemberStatusChanges || []).filter(r => r.status === 'pending').length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-amber-500 bg-amber-50/30">
          <div className="font-display font-bold text-sm text-amber-800 mb-3">
            <i className="fas fa-clock mr-2" />
            Awaiting Beneficiary Confirmation ({(pendingMemberStatusChanges || []).filter(r => r.status === 'pending').length})
          </div>
          <div className="space-y-2">
            {(pendingMemberStatusChanges || []).filter(r => r.status === 'pending').map(req => (
              <div key={req.id} className="bg-white rounded-xl p-3 border border-amber-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-navy">{req.member_name}</div>
                    <div className="text-[11px] text-slate-500">
                      {req.hh_code} · You proposed: <strong className="capitalize">{req.current_status}</strong> → <strong className="capitalize text-amber-700">{req.new_status}</strong>
                    </div>
                    {req.remarks && (
                      <div className="text-xs text-slate-600 mt-1 italic">"{req.remarks}"</div>
                    )}
                  </div>
                  <span className="badge badge-pending flex-shrink-0">
                    <i className="fas fa-clock mr-1" />Awaiting
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4 mb-4 space-y-3">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Filter by Purok</div>
          <div className="tab-scroll">
            <div className={`purok-tab ${!purokFilter ? 'active' : ''}`} onClick={() => setPurok('')}>All</div>
            {puroks.map(p => (
              <div key={p.id} className={`purok-tab ${purokFilter === String(p.id) ? 'active' : ''}`}
                onClick={() => setPurok(String(p.id))}>{p.name}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Filter by Sector</div>
          <div className="tab-scroll">
            <div className={`purok-tab ${!sectorFilter ? 'active' : ''}`} onClick={() => setSector('')}>All</div>
            {sectors.map(s => (
              <div key={s.code} className={`purok-tab ${sectorFilter === s.code ? 'active' : ''}`}
                onClick={() => setSector(s.code)}>{s.name}</div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Filter by Member Status</div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
              {[
                { key: 'all', label: 'All Statuses', icon: 'fa-users' },
                { key: 'active', label: 'Active', icon: 'fa-circle-check text-emerald-600' },
                { key: 'inactive', label: 'Inactive', icon: 'fa-user-slash text-amber-600' },
                { key: 'deceased', label: 'Deceased', icon: 'fa-ribbon text-slate-500' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-white text-navy shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <i className={`fas ${tab.icon} mr-1.5`} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleExportCSV} className="btn btn-gray btn-sm cursor-pointer self-stretch sm:self-auto" title="Export Filtered Beneficiaries to CSV">
            <i className="fas fa-file-csv text-emerald-600 text-sm" /> <span>Export Masterlist CSV ({filtered.length})</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          <i className="fas fa-users-slash text-4xl mb-3 block text-slate-300" />
          <div className="text-sm font-semibold">No households found</div>
          <div className="text-xs mt-1">Try adjusting your filters.</div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(hh => {
          const head = hh.members?.find(m => m.is_head)
          const hhQR = qrCodes.find(q => q.household_id === hh.id && q.cycle_id === activeCycle?.id && q.type === 'household')
          const memberCount = hh.members?.length || 0

          return (
            <div key={hh.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-sm text-navy">{head?.fname} {head?.lname}</span>
                      <span className="badge badge-approved">Approved</span>
                      {hhQR?.is_claimed && <span className="badge badge-claimed">Claimed</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {hh.hh_code} · {hh.purok_name}
                      {hh.house_no_street && ` · ${hh.house_no_street}`}
                    </div>
                    {head?.sectors?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {head.sectors.map(s => <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-sm font-bold text-navy">{memberCount}</div>
                      <div className="text-[10px] text-slate-400">members</div>
                    </div>
                    <button onClick={() => setExpanded(p => ({ ...p, [hh.id]: !p[hh.id] }))}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${expanded[hh.id] ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      <i className={`fas fa-chevron-${expanded[hh.id] ? 'up' : 'down'} text-xs`} />
                    </button>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expanded[hh.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-100 bg-slate-50 overflow-hidden">
                    <div className="p-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">
                        Household Members ({memberCount})
                      </div>
                      <div className="space-y-2">
                        {hh.members?.map(m => (
                          <div key={m.id} className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm text-navy">{m.fname} {m.lname}</span>
                                {m.is_head && <span className="badge badge-approved">Head</span>}
                                <span className={`badge badge-${m.status}`}>{m.status}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {m.age}y · {m.sex} · {m.relationship}
                              </div>
                              {m.sectors?.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {m.sectors.map(s => <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>)}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button onClick={() => setMemberDetail({ ...m, hh_code: hh.hh_code, purok_name: hh.purok_name })}
                                className="btn btn-gray btn-xs">
                                <i className="fas fa-eye" />
                              </button>
                              {isAdmin && (
                                <button onClick={() => { setStatusModal({ hh_id: hh.id, member: m }); setNewStatus(m.status); setStatusRemarks(m.status_remarks || '') }}
                                  className="btn btn-outline btn-xs">
                                  <i className="fas fa-edit" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {hh.emergency_receiver?.receiver_name && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                          <div className="text-[11px] font-bold text-amber-700 mb-1">
                            <i className="fas fa-user-shield mr-1" />Emergency Receiver
                          </div>
                          <div className="text-sm text-amber-900 font-semibold">{hh.emergency_receiver.receiver_name}</div>
                          <div className="text-xs text-amber-700">{hh.emergency_receiver.receiver_contact} · {hh.emergency_receiver.relationship}</div>
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

      {memberDetail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMemberDetail(null)}>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Member Details</h3>
              <button onClick={() => setMemberDetail(null)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold mx-auto mb-4">
                {memberDetail.fname?.[0]}{memberDetail.lname?.[0]}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Full Name', `${memberDetail.fname} ${memberDetail.lname}`],
                  ['Age', `${memberDetail.age}y · ${memberDetail.age_group}`],
                  ['Sex', memberDetail.sex],
                  ['Relationship', memberDetail.relationship],
                  ['Contact', memberDetail.contact || '—'],
                  ['Email', memberDetail.email || '—'],
                  ['Status', memberDetail.status],
                  ['HH Code', memberDetail.hh_code],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 p-3 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{k}</div>
                    <div className="text-sm font-semibold text-navy capitalize">{v}</div>
                  </div>
                ))}
              </div>
              {memberDetail.sectors?.length > 0 && (
                <div className="mt-3 bg-blue-50 p-3 rounded-xl">
                  <div className="text-[10px] font-bold text-blue-600 uppercase mb-1.5">Sectors</div>
                  <div className="flex flex-wrap gap-1.5">
                    {memberDetail.sectors.map(s => (
                      <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              )}
              {memberDetail.status_remarks && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">Status Remarks</div>
                  <div className="text-sm text-amber-800">{memberDetail.status_remarks}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setMemberDetail(null)} className="btn btn-gray">Close</button>
            </div>
          </motion.div>
        </div>
      )}

      {statusModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStatusModal(null)}>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Update Member Status</h3>
              <button onClick={() => setStatusModal(null)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="text-sm text-slate-600 mb-4">
                Member: <strong className="text-navy">{statusModal.member.fname} {statusModal.member.lname}</strong>
              </div>
              <div className="form-group">
                <label className="form-label">New Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {['active', 'inactive', 'deceased'].map(s => {
                    const isActive = newStatus === s
                    const cls = s === 'active' ? 'emerald' : s === 'inactive' ? 'amber' : 'red'
                    return (
                      <button key={s} onClick={() => setNewStatus(s)}
                        className={`py-3 rounded-xl border-2 text-sm font-bold capitalize transition-all ${isActive ? `border-${cls}-500 bg-${cls}-50 text-${cls}-700` : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        style={isActive
                          ? { borderColor: cls === 'emerald' ? '#10b981' : cls === 'amber' ? '#f59e0b' : '#ef4444',
                              background:   cls === 'emerald' ? '#ecfdf5' : cls === 'amber' ? '#fef3c7' : '#fee2e2',
                              color:        cls === 'emerald' ? '#047857' : cls === 'amber' ? '#92400e' : '#b91c1c' }
                          : {}}>
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="form-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="form-label mb-0">Remarks</label>
                  <span className={`text-[11px] font-semibold ${newStatus !== 'active' ? 'text-red-500' : 'text-slate-400'}`}>
                    {newStatus !== 'active' ? 'Required *' : 'Optional'}
                  </span>
                </div>
                <textarea className="form-input" rows={3} value={statusRemarks}
                  onChange={e => setStatusRemarks(e.target.value)}
                  placeholder={newStatus === 'deceased' ? 'e.g. Date of death, cause...' : newStatus === 'inactive' ? 'e.g. Moved out of Barangay Puerto...' : 'Optional remarks'} />
                <div className="min-h-[20px] mt-1 text-xs">
                  {newStatus !== 'active' && !statusRemarks.trim() ? (
                    <span className="text-red-500 flex items-center">
                      <i className="fas fa-circle-exclamation mr-1.5 flex-shrink-0" />
                      Remarks are required for inactive/deceased status.
                    </span>
                  ) : (
                    <span className="text-slate-400">Optional notes for active status.</span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setStatusModal(null)} className="btn btn-gray">Cancel</button>
              <button onClick={handleStatusUpdate} className="btn btn-primary">
                <i className="fas fa-save" /> Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
