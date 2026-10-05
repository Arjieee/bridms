import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { fuzzyMatch } from '../../utils/fuzzySearch'
import { exportToCsv } from '../../utils/csvExport'
import { formatFormalName } from '../../utils/nameFormatter'
import toast from 'react-hot-toast'

const normalizeSectors = (sectors) => {
  if (Array.isArray(sectors)) return sectors
  if (typeof sectors === 'string' && sectors.trim()) {
    try {
      const parsed = JSON.parse(sectors)
      if (Array.isArray(parsed)) return parsed
    } catch (_) {}
    return [sectors.trim()]
  }
  return []
}

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
  const [sortOrder, setSortOrder] = useState('name_asc') // 'name_asc' | 'name_desc' | 'code'
  const [expanded, setExpanded] = useState({})
  const [memberDetail, setMemberDetail] = useState(null)
  const [statusModal, setStatusModal] = useState(null)
  const [newStatus, setNewStatus] = useState('active')
  const [statusRemarks, setStatusRemarks] = useState('')

  const activeCycle = cycles.find(c => c.is_active)

  const totalHouseholdsCount = households.length
  const totalResidentsCount = households.reduce((sum, hh) => sum + (hh.members?.length || 0), 0)

  const filtered = useMemo(() => {
    return households
      .filter(hh => {
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
          const memberFormalNames = (hh.members || []).map(m => formatFormalName(m))
          const memberFullNames = (hh.members || []).map(m => `${m.fname} ${m.mname || ''} ${m.lname}`)
          const purokName = puroks.find(p => p.id === hh.purok_id)?.name || ''
          const targetFields = [
            hh.hh_code,
            head ? formatFormalName(head) : '',
            head ? `${head.fname} ${head.lname}` : '',
            ...memberFormalNames,
            ...memberFullNames,
            purokName,
          ]
          if (!fuzzyMatch(targetFields, search)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'code') {
          return (a.hh_code || '').localeCompare(b.hh_code || '', undefined, { numeric: true })
        }

        const headA = a.members?.find(m => m.is_head) || a.members?.[0]
        const headB = b.members?.find(m => m.is_head) || b.members?.[0]

        // Sort alphabetically by Household Head's Last Name, then First Name
        const nameA = headA
          ? `${(headA.lname || '').trim()} ${(headA.fname || '').trim()}`.toLowerCase()
          : (a.hh_code || '').toLowerCase()
        const nameB = headB
          ? `${(headB.lname || '').trim()} ${(headB.fname || '').trim()}`.toLowerCase()
          : (b.hh_code || '').toLowerCase()

        if (sortOrder === 'name_desc') {
          return nameB.localeCompare(nameA)
        }
        return nameA.localeCompare(nameB)
      })
  }, [households, purokFilter, sectorFilter, statusFilter, search, puroks, sortOrder])

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
        return `${formatFormalName(m)} (${m.age || 'N/A'}${sec}${stat})`
      }).join('; ')

      return {
        hh_code: hh.hh_code,
        head_name: head ? formatFormalName(head) : 'N/A',
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

      {/* Top Header Metrics & Action Bar */}
      <div className="flex items-center justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <div className="bg-white border border-slate-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0">
              <i className="fas fa-house-user" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Households</div>
              <div className="font-display font-extrabold text-sm text-navy leading-tight">{totalHouseholdsCount}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
              <i className="fas fa-users" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Residents</div>
              <div className="font-display font-extrabold text-sm text-navy leading-tight">{totalResidentsCount}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-600 hover:text-emerald-700 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
            title={`Export Masterlist to CSV (${filtered.length} households)`}
            aria-label="Export Masterlist to CSV"
          >
            <i className="fas fa-file-csv text-emerald-600 text-base" />
          </button>
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

      {/* Consolidated Single-Row Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 mb-3.5 shadow-2xs space-y-2">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0 md:min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, HH code, or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input text-xs pl-8 pr-7 py-2 w-full rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search query"
              >
                <i className="fas fa-xmark text-xs" />
              </button>
            )}
            {isStaff && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 badge badge-pending text-[9px] py-0.5 px-1.5">
                <i className="fas fa-eye mr-1" />View only
              </span>
            )}
          </div>

          {/* 4 Filter & Sort Dropdowns: 2x2 grid on mobile, inline flex row on desktop */}
          <div className="grid grid-cols-2 md:flex md:flex-row items-center gap-2 w-full md:w-auto">
            {/* Purok Filter Dropdown */}
            <div className="relative min-w-0 md:min-w-[130px] sm:md:min-w-[150px]">
              <select
                value={purokFilter}
                onChange={e => setPurok(e.target.value)}
                className={`form-input text-xs py-2 pl-2.5 pr-6 rounded-xl font-medium cursor-pointer w-full transition-all ${
                  purokFilter
                    ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="">📍 All Puroks</option>
                {(puroks || []).filter(p => !p.is_archived).map(p => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Sector Filter Dropdown */}
            <div className="relative min-w-0 md:min-w-[130px] sm:md:min-w-[150px]">
              <select
                value={sectorFilter}
                onChange={e => setSector(e.target.value)}
                className={`form-input text-xs py-2 pl-2.5 pr-6 rounded-xl font-medium cursor-pointer w-full transition-all ${
                  sectorFilter
                    ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="">👥 All Sectors</option>
                {sectors.map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Member Status Dropdown */}
            <div className="relative min-w-0 md:min-w-[125px] sm:md:min-w-[140px]">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className={`form-input text-xs py-2 pl-2.5 pr-6 rounded-xl font-medium cursor-pointer w-full transition-all ${
                  statusFilter !== 'all'
                    ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">🏷️ All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="deceased">Deceased</option>
              </select>
            </div>

            {/* Sort Order Dropdown */}
            <div className="relative min-w-0 md:min-w-[120px] sm:md:min-w-[135px]">
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="form-input text-xs py-2 pl-2.5 pr-6 rounded-xl font-medium cursor-pointer w-full bg-white border-slate-200 text-slate-700"
                title="Sort Beneficiaries Masterlist"
              >
                <option value="name_asc">🔤 Name (A–Z)</option>
                <option value="name_desc">🔤 Name (Z–A)</option>
                <option value="code">🔢 HH Code</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips (Only shown when filters or search query are active) */}
        {(purokFilter || sectorFilter || statusFilter !== 'all' || search) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Active:</span>

            {purokFilter && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                <span>Purok: {puroks.find(p => String(p.id) === String(purokFilter))?.name || 'Selected'}</span>
                <button type="button" onClick={() => setPurok('')} className="hover:text-blue-900 cursor-pointer">
                  <i className="fas fa-xmark text-[10px]" />
                </button>
              </span>
            )}

            {sectorFilter && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                <span>Sector: {sectors.find(s => s.code === sectorFilter)?.name || sectorFilter}</span>
                <button type="button" onClick={() => setSector('')} className="hover:text-blue-900 cursor-pointer">
                  <i className="fas fa-xmark text-[10px]" />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold capitalize">
                <span>Status: {statusFilter}</span>
                <button type="button" onClick={() => setStatusFilter('all')} className="hover:text-blue-900 cursor-pointer">
                  <i className="fas fa-xmark text-[10px]" />
                </button>
              </span>
            )}

            {search && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">
                <span>"{search}"</span>
                <button type="button" onClick={() => setSearch('')} className="hover:text-slate-900 cursor-pointer">
                  <i className="fas fa-xmark text-[10px]" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setPurok('')
                setSector('')
                setStatusFilter('all')
                setSearch('')
              }}
              className="text-[11px] text-red-600 hover:text-red-800 font-semibold underline ml-1 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        )}
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
                      <span className="font-display font-bold text-sm text-navy">{head ? formatFormalName(head) : 'N/A'}</span>
                      <span className="badge badge-approved">Approved</span>
                      {hhQR?.is_claimed && <span className="badge badge-claimed">Claimed</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {hh.hh_code} · {hh.purok_name}
                      {hh.house_no_street && ` · ${hh.house_no_street}`}
                    </div>
                    {normalizeSectors(head?.sectors).length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {normalizeSectors(head?.sectors).map(s => <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>)}
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
                        {([...(hh.members || [])].sort((a, b) => {
                          if (a.is_head) return -1
                          if (b.is_head) return 1
                          const nA = `${(a.lname || '').trim()} ${(a.fname || '').trim()}`.toLowerCase()
                          const nB = `${(b.lname || '').trim()} ${(b.fname || '').trim()}`.toLowerCase()
                          return nA.localeCompare(nB)
                        })).map(m => (
                          <div key={m.id} className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm text-navy">{formatFormalName(m)}</span>
                                {m.is_head && <span className="badge badge-approved">Head</span>}
                                <span className={`badge badge-${m.status}`}>{m.status}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {m.age}y · {m.sex} · {m.relationship}
                              </div>
                              {normalizeSectors(m.sectors).length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {normalizeSectors(m.sectors).map(s => <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>)}
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
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold mx-auto mb-2">
                {memberDetail.fname?.[0]}{memberDetail.lname?.[0]}
              </div>
              <div className="text-center mb-4">
                <div className="font-display font-extrabold text-base text-navy">
                  {formatFormalName(memberDetail)}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Official Formal Format (LGU Masterlist)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['First Name', memberDetail.fname],
                  ['Middle Name', memberDetail.mname || '—'],
                  ['Last Name', memberDetail.lname],
                  ['Relationship', memberDetail.relationship || '—'],
                  ['Age & Group', `${memberDetail.age}y · ${memberDetail.age_group || 'adult'}`],
                  ['Sex', memberDetail.sex || '—'],
                  ['Contact', memberDetail.contact || '—'],
                  ['Email', memberDetail.email || '—'],
                  ['Status', memberDetail.status],
                  ['HH Code', memberDetail.hh_code],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 p-2.5 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{k}</div>
                    <div className="text-xs font-semibold text-navy capitalize truncate" title={v}>{v}</div>
                  </div>
                ))}
              </div>
              {normalizeSectors(memberDetail.sectors).length > 0 && (
                <div className="mt-3 bg-blue-50 p-3 rounded-xl">
                  <div className="text-[10px] font-bold text-blue-600 uppercase mb-1.5">Sectors</div>
                  <div className="flex flex-wrap gap-1.5">
                    {normalizeSectors(memberDetail.sectors).map(s => (
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
                  <label className="form-label mb-0">
                    Remarks {newStatus !== 'active' && <span className="text-red-500 font-bold">*</span>}
                  </label>
                  {newStatus === 'active' && (
                    <span className="text-[11px] font-semibold text-slate-400">
                      Optional
                    </span>
                  )}
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
