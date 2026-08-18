import { useState } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { fuzzyMatch } from '../../utils/fuzzySearch'
import { exportToCsv } from '../../utils/csvExport'
import PasswordStrengthMeter, { checkStrength } from '../../components/ui/PasswordStrengthMeter'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'registrations', label: 'Registrations', icon: 'fa-clipboard-check' },
  { key: 'accounts',      label: 'Accounts',      icon: 'fa-users' },
  { key: 'cycles',        label: 'Cycles',        icon: 'fa-rotate' },
  { key: 'puroks',        label: 'Puroks',        icon: 'fa-map' },
  { key: 'activity',      label: 'Activity',      icon: 'fa-list-ul' },
]

const REG_SUBTABS = ['pending', 'approved', 'rejected']

const CYCLE_TYPES = [
  { key: 'household',   label: 'Household Regular',    color: '#1a56db' },
  { key: 'pwd',         label: 'PWD Cycle',            color: '#7c3aed' },
  { key: 'senior',      label: 'Senior Citizen',       color: '#f59e0b' },
  { key: 'osy',         label: 'Out-of-School Youth',  color: '#10b981' },
  { key: 'solo_parent', label: 'Solo Parent',          color: '#ec4899' },
  { key: 'teenage_mom', label: 'Teenage Mother',       color: '#ef4444' },
  { key: 'emergency',   label: 'Emergency / Disaster', color: '#6b7280' },
]

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

export default function AdminSettings() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const initialTab = searchParams.get('tab') || location.state?.tab || 'registrations'

  const {
    pendingRegistrations, accounts, cycles, puroks, sectors, activityLogs, qrCodes, households, inventory, standardPackages,
    approveRegistration, rejectRegistration, createCycle, deactivateCycle, reactivateCycle,
    addPurok, updatePurok, deletePurok, restorePurok, addStaffAccount,
  } = useAppStore()

  const [tab, setTab] = useState(initialTab)
  const [regSubtab, setRegSubtab] = useState('pending')
  const [purokSubtab, setPurokSubtab] = useState('active') // 'active' | 'archived'
  const [accountRoleFilter, setAccountRoleFilter] = useState('staff_admin') // 'staff_admin' | 'beneficiary' | 'all'
  const [accountPurokFilter, setAccountPurokFilter] = useState('')
  const [accountSectorFilter, setAccountSectorFilter] = useState('')
  const [accountSearch, setAccountSearch] = useState('')
  const [regSearch, setRegSearch] = useState('')
  const [activitySearch, setActivitySearch] = useState('')
  const [accountPage, setAccountPage] = useState(1)
  const ACCOUNTS_PER_PAGE = 10

  const [regDetail, setRegDetail] = useState(null)
  const [showReject, setShowReject] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showAddCycle, setShowAddCycle] = useState(false)
  const [showAddPurok, setShowAddPurok] = useState(false)
  const [editPurok, setEditPurok] = useState(null)
  const [editPurokName, setEditPurokName] = useState('')
  const [confirmDeletePurok, setConfirmDeletePurok] = useState(null)
  const [confirmPurokInput, setConfirmPurokInput] = useState('')
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [staffDetail, setStaffDetail] = useState(null)

  const [cycleForm, setCycleForm] = useState({
    name: '',
    type: 'household',
    description: '',
    items: [],
    target_purok_ids: [],
    distribution_date: new Date().toISOString().split('T')[0],
    distribution_time: '8:00 AM - 5:00 PM',
    claim_address: 'Barangay Puerto Covered Court',
    contact_person: '',
  })
  const [purokForm, setPurokForm] = useState({ name: '' })
  const [selectedInvItemId, setSelectedInvItemId] = useState('')
  const [selectedInvItemQty, setSelectedInvItemQty] = useState('1')
  const [staffForm, setStaffForm] = useState({ full_name: '', username: '', password: '', confirm: '', email: '', contact: '' })

  const safeAccounts = accounts || []
  const safeHouseholds = households || []
  const safePuroks = puroks || []
  const safeSectors = sectors || []

  const staffAdminCount = safeAccounts.filter(a => a.role === 'admin' || a.role === 'staff').length
  const beneficiaryCount = safeAccounts.filter(a => a.role === 'beneficiary').length
  const totalAccountCount = safeAccounts.length

  const filteredAccounts = safeAccounts.filter(a => {
    if (accountRoleFilter === 'staff_admin' && (a.role !== 'admin' && a.role !== 'staff')) return false
    if (accountRoleFilter === 'beneficiary' && a.role !== 'beneficiary') return false

    const linkedHh = safeHouseholds.find(h => h.account_id === a.id || h.head_account_id === a.id || h.members?.some(m => m.id === a.member_id))

    if (accountPurokFilter) {
      if (!linkedHh || String(linkedHh.purok_id) !== String(accountPurokFilter)) return false
    }

    if (accountSectorFilter) {
      if (!linkedHh) return false
      const hasSector = linkedHh.members?.some(m => m.sectors?.includes(accountSectorFilter))
      if (!hasSector) return false
    }

    if (accountSearch.trim()) {
      const targetFields = [a.full_name, a.username, a.email, a.role, linkedHh?.hh_code, linkedHh?.purok_name]
      if (!fuzzyMatch(targetFields, accountSearch)) return false
    }
    return true
  })

  const totalAccountPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNTS_PER_PAGE))
  const currentAccountPage = Math.min(accountPage, totalAccountPages)
  const paginatedAccounts = filteredAccounts.slice((currentAccountPage - 1) * ACCOUNTS_PER_PAGE, currentAccountPage * ACCOUNTS_PER_PAGE)

  const totalRegsByStatus = {
    pending: (pendingRegistrations || []).filter(r => r.status === 'pending' || !r.status),
    approved: (pendingRegistrations || []).filter(r => r.status === 'approved'),
    rejected: (pendingRegistrations || []).filter(r => r.status === 'rejected'),
  }

  const filteredRegs = (pendingRegistrations || []).filter(r => {
    if (regSearch.trim()) {
      const headName = `${r.head?.fname || ''} ${r.head?.lname || ''}`
      const memberNames = (r.members || []).map(m => `${m.fname || ''} ${m.lname || ''}`)
      const purokName = safePuroks.find(p => p.id === r.purok_id)?.name || ''
      const targetFields = [headName, r.username, r.reg_code, purokName, ...memberNames]
      if (!fuzzyMatch(targetFields, regSearch)) return false
    }
    return true
  })

  const regsByStatus = {
    pending: filteredRegs.filter(r => r.status === 'pending' || !r.status),
    approved: filteredRegs.filter(r => r.status === 'approved'),
    rejected: filteredRegs.filter(r => r.status === 'rejected'),
  }

  const handleApprove = async (reg) => {
    if (!reg) return
    if (!window.confirm(`Approve registration for ${reg.head?.fname} ${reg.head?.lname}?`)) return
    const res = await approveRegistration(reg.id)
    if (res.ok) {
      toast.success(res.message || `Approved ${reg.head?.fname} ${reg.head?.lname}!`)
      if (regDetail?.id === reg.id) setRegDetail(null)
    } else {
      toast.error(res.message || 'Failed to approve registration.')
    }
  }

  const handleReject = async () => {
    if (!showReject) return
    const res = await rejectRegistration(showReject.id, rejectReason.trim())
    if (res.ok) {
      toast.success(res.message || 'Registration rejected.')
      setShowReject(null)
      setRejectReason('')
      if (regDetail?.id === showReject.id) setRegDetail(null)
    } else {
      toast.error(res.message || 'Failed to reject registration.')
    }
  }

  const loadPresetPackage = (type) => {
    const preset = standardPackages[type] || standardPackages.household || []
    setCycleForm(f => ({ ...f, items: preset.map(item => ({ ...item })) }))
    toast.success(`Loaded standard preset template for ${type.replace(/_/g, ' ')}. You can adjust quantities and items.`)
  }

  const addItemToCyclePackage = () => {
    if (!selectedInvItemId) { toast.error('Select an inventory item.'); return }
    const inv = inventory.find(i => i.id === parseInt(selectedInvItemId))
    if (!inv) { toast.error('Item not found in inventory.'); return }
    const qty = parseFloat(selectedInvItemQty)
    if (isNaN(qty) || qty <= 0) { toast.error('Valid quantity required.'); return }

    setCycleForm(f => {
      const existingIdx = (f.items || []).findIndex(i => i.item_id === inv.id)
      let newItems = [...(f.items || [])]
      if (existingIdx >= 0) {
        newItems[existingIdx] = { ...newItems[existingIdx], quantity: newItems[existingIdx].quantity + qty }
      } else {
        newItems.push({
          item_id: inv.id,
          item_name: inv.name,
          quantity: qty,
          unit: inv.unit,
        })
      }
      return { ...f, items: newItems }
    })
    setSelectedInvItemId('')
    setSelectedInvItemQty('1')
    toast.success(`Added ${qty} ${inv.unit} of ${inv.name} to package.`)
  }

  const removeItemFromCyclePackage = (index) => {
    setCycleForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
  }

  const updateCyclePackageQty = (index, qtyVal) => {
    const val = parseFloat(qtyVal)
    setCycleForm(f => ({
      ...f,
      items: f.items.map((item, i) => i === index ? { ...item, quantity: isNaN(val) ? 0 : val } : item)
    }))
  }

  const handleCreateCycle = async () => {
    if (!cycleForm.name.trim()) { toast.error('Cycle name required.'); return }
    const result = await createCycle(cycleForm)
    if (result.ok) {
      toast.success(result.message)
      setShowAddCycle(false)
      setCycleForm({ name: '', type: 'household', description: '', items: [], target_purok_ids: [] })
    } else {
      toast.error(result.message)
    }
  }

  const handleToggleCycle = async (cycle) => {
    if (cycle.is_active) {
      if (!window.confirm(`Deactivate cycle "${cycle.name}"?`)) return
      const result = await deactivateCycle(cycle.id)
      if (result?.ok) toast.success(result.message || 'Cycle deactivated.')
      else toast.error(result?.message || 'Failed to deactivate cycle.')
    } else {
      if (!window.confirm(`Reactivate cycle "${cycle.name}"? This will resume QR verification and distributions for this cycle.`)) return
      const result = await reactivateCycle(cycle.id)
      if (result?.ok) toast.success(result.message || 'Cycle reactivated.')
      else toast.error(result?.message || 'Failed to reactivate cycle.')
    }
  }

  const handleAddPurok = async () => {
    if (!purokForm.name.trim()) { toast.error('Purok name required.'); return }
    const res = await addPurok({ name: purokForm.name.trim() })
    if (res?.ok) {
      toast.success(res.message || `"${purokForm.name}" added.`)
      setShowAddPurok(false)
      setPurokForm({ name: '' })
    } else {
      toast.error(res?.message || 'Failed to add purok.')
    }
  }

  const handleUpdatePurok = async () => {
    if (!editPurokName.trim()) { toast.error('Purok name required.'); return }
    const res = await updatePurok(editPurok.id, editPurokName.trim())
    if (res?.ok) {
      toast.success(res.message || 'Purok updated.')
      setEditPurok(null)
    } else {
      toast.error(res?.message || 'Failed to update purok.')
    }
  }

  const handleDeletePurok = async (p) => {
    const res = await deletePurok(p.id)
    if (res?.ok) {
      toast.success(`"${p.name}" safely archived to Backup Vault!`)
      setConfirmDeletePurok(null)
      setConfirmPurokInput('')
    } else {
      toast.error(res?.message || 'Failed to archive purok.')
    }
  }

  const handleRestorePurok = async (p) => {
    const res = await restorePurok(p.id)
    if (res?.ok) toast.success(`"${p.name}" restored successfully.`)
    else toast.error(res?.message || 'Failed to restore purok.')
  }

  const handleAddStaff = async () => {
    if (!staffForm.full_name.trim()) { toast.error('Full name required.'); return }
    if (staffForm.username.length < 6) { toast.error('Username must be at least 6 characters.'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(staffForm.username)) { toast.error('Username: letters, numbers, underscores only.'); return }
    if (accounts.find(a => a.username === staffForm.username)) { toast.error('Username already taken.'); return }
    if (checkStrength(staffForm.password).score < 3) { toast.error('Password too weak.'); return }
    if (staffForm.password !== staffForm.confirm) { toast.error('Passwords do not match.'); return }
    const result = await addStaffAccount(staffForm)
    if (result?.ok) {
      toast.success(`Staff account "@${staffForm.username}" created.`)
      setShowAddStaff(false)
      setStaffForm({ full_name: '', username: '', password: '', confirm: '', email: '', contact: '' })
    } else {
      toast.error(result?.message || 'Failed to create staff account.')
    }
  }

  const handleTabSelect = (key) => {
    setTab(key)
    const mainEl = document.querySelector('main.page-content')
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="tab-scroll gap-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto select-none flex-1">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => handleTabSelect(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-display transition-none flex-shrink-0 ${
                tab === t.key ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <i className={`fas ${t.icon}`} />
              <span>{t.label}</span>
              {t.key === 'registrations' && regsByStatus.pending.length > 0 && (
                <span className="w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center">
                  {regsByStatus.pending.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {['cycles', 'puroks', 'accounts'].includes(tab) && (
          <div className="flex gap-2 items-center flex-shrink-0 justify-end">
            {tab === 'cycles' && (
              <button type="button" onClick={() => setShowAddCycle(true)} className="btn btn-primary btn-sm">
                <i className="fas fa-plus" /> <span className="hidden sm:inline">New Cycle</span>
              </button>
            )}
            {tab === 'puroks' && (
              <button type="button" onClick={() => setShowAddPurok(true)} className="btn btn-primary btn-sm">
                <i className="fas fa-plus" /> <span className="hidden sm:inline">Add Purok</span>
              </button>
            )}
            {tab === 'accounts' && (
              <button type="button" onClick={() => setShowAddStaff(true)} className="btn btn-primary btn-sm">
                <i className="fas fa-user-plus" /> <span className="hidden sm:inline">Add Staff</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-[600px] overflow-hidden">
        {tab === 'registrations' && (
          <div className="space-y-4 w-full">
            {/* Control Bar: Subtabs + Search Bar */}
            <div className="card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap sm:flex-nowrap flex-shrink-0">
                {REG_SUBTABS.map(s => {
                  const count = totalRegsByStatus[s].length
                  const colors = { pending: 'amber', approved: 'emerald', rejected: 'red' }
                  const c = colors[s]
                  return (
                    <button key={s} type="button" onClick={() => setRegSubtab(s)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-display capitalize transition-all flex items-center gap-1.5 ${
                        regSubtab === s ? `bg-${c}-50 text-${c}-700 shadow-sm` : 'text-slate-500 hover:bg-slate-200/60'
                      }`}
                      style={regSubtab === s ? {
                        background: c === 'amber' ? '#fef3c7' : c === 'emerald' ? '#d1fae5' : '#fee2e2',
                        color:      c === 'amber' ? '#92400e' : c === 'emerald' ? '#047857' : '#b91c1c',
                      } : {}}>
                      {s}
                      {count > 0 && (
                        <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{
                            background: regSubtab === s
                              ? (c === 'amber' ? '#f59e0b' : c === 'emerald' ? '#10b981' : '#ef4444')
                              : '#cbd5e1',
                            color: regSubtab === s ? '#fff' : '#475569',
                          }}>{count}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Search Bar on the Right Edge */}
              <div className="relative w-full sm:w-64 flex-shrink-0">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search registrations..."
                  value={regSearch}
                  onChange={e => setRegSearch(e.target.value)}
                  className="form-input text-xs pl-8 py-1.5 w-full rounded-xl"
                />
              </div>
            </div>

            {/* Registrations List */}
            <div className="space-y-3">
              {regsByStatus[regSubtab].length === 0 ? (
                <div className="card p-10 text-center text-slate-400">
                  <i className={`fas ${regSubtab === 'pending' ? 'fa-clock' : regSubtab === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'} text-4xl mb-3 block text-slate-200`} />
                  <div className="text-sm font-semibold">
                    {regSearch ? `No ${regSubtab} registrations matching "${regSearch}"` : `No ${regSubtab} registrations`}
                  </div>
                </div>
              ) : regsByStatus[regSubtab].map(reg => (
                <div key={reg.id} className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-base text-navy flex items-center gap-2 flex-wrap">
                        <span>{reg.head?.fname} {reg.head?.lname}</span>
                        <span className="text-xs font-normal text-slate-400">@{reg.username}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-2 flex-wrap">
                        <span><i className="fas fa-location-dot text-red-500 mr-1" />{puroks.find(p => p.id === reg.purok_id)?.name}</span>
                        <span>·</span>
                        <span><i className="fas fa-calendar text-slate-400 mr-1" />{reg.reg_date}</span>
                        <span>·</span>
                        <span className="font-semibold text-navy">{(reg.members?.length || 0) + 1} member(s)</span>
                      </div>
                      {normalizeSectors(reg.head?.sectors).length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {normalizeSectors(reg.head?.sectors).map(s =>
                            <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>
                          )}
                        </div>
                      )}
                      {regSubtab === 'rejected' && reg.rejection_reason && (
                        <div className="mt-2.5 p-2.5 bg-red-50 rounded-xl text-xs text-red-700 border border-red-100">
                          <strong>Reason:</strong> {reg.rejection_reason}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`badge ${reg.status === 'pending' ? 'badge-pending' : reg.status === 'approved' ? 'badge-approved' : 'badge-rejected'}`}>
                        {reg.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                        reg.is_email_verified
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        <i className={`fas ${reg.is_email_verified ? 'fa-check-circle text-emerald-600' : 'fa-clock text-amber-600'}`} />
                        {reg.is_email_verified ? 'Email Verified' : 'Unverified Email'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap pt-3 border-t border-slate-100">
                    <button onClick={() => setRegDetail(reg)} className="btn btn-outline btn-sm flex-1 justify-center">
                      <i className="fas fa-eye mr-1" /> View Details
                    </button>
                    {regSubtab === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(reg)} className="btn btn-success btn-sm flex-1 justify-center">
                          <i className="fas fa-check mr-1" /> Approve
                        </button>
                        <button onClick={() => { setShowReject(reg); setRejectReason('') }} className="btn btn-danger btn-sm flex-1 justify-center">
                          <i className="fas fa-times mr-1" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'accounts' && (
          <div className="space-y-3">
            {/* Role Filter Sub-Tabs + Search Controls Bar */}
            <div className="card p-3 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
              {/* Role Sub-Tabs */}
              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-nowrap shrink-0 overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => { setAccountRoleFilter('staff_admin'); setAccountPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display transition-all whitespace-nowrap flex items-center ${
                    accountRoleFilter === 'staff_admin' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <i className="fas fa-user-shield mr-1.5 text-blue-600" />
                  Staff & Admins
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800">
                    {staffAdminCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setAccountRoleFilter('beneficiary'); setAccountPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display transition-all whitespace-nowrap flex items-center ${
                    accountRoleFilter === 'beneficiary' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <i className="fas fa-users mr-1.5 text-amber-600" />
                  Beneficiaries
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                    {beneficiaryCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setAccountRoleFilter('all'); setAccountPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display transition-all whitespace-nowrap flex items-center ${
                    accountRoleFilter === 'all' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  All Accounts
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                    {totalAccountCount}
                  </span>
                </button>
              </div>

              {/* Purok, Sector & Search Filters */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start xl:justify-end">
                {/* Purok & Sector Filter Dropdowns (Shown only for Beneficiaries / All Accounts) */}
                {accountRoleFilter !== 'staff_admin' && (
                  <>
                    <select
                      value={accountPurokFilter}
                      onChange={e => { setAccountPurokFilter(e.target.value); setAccountPage(1); }}
                      className="form-input text-xs py-1.5 px-2.5 w-32 sm:w-36 bg-white font-medium border-slate-200 rounded-xl text-slate-700 cursor-pointer flex-shrink-0"
                    >
                      <option value="">All Puroks</option>
                      {safePuroks.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <select
                      value={accountSectorFilter}
                      onChange={e => { setAccountSectorFilter(e.target.value); setAccountPage(1); }}
                      className="form-input text-xs py-1.5 px-2.5 w-32 sm:w-36 bg-white font-medium border-slate-200 rounded-xl text-slate-700 cursor-pointer flex-shrink-0"
                    >
                      <option value="">All Sectors</option>
                      {safeSectors.map(s => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                  </>
                )}

                {/* Search Bar */}
                <div className="relative w-full sm:w-48 flex-shrink-0">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    placeholder={accountRoleFilter === 'staff_admin' ? "Search staff or admin..." : "Search account..."}
                    value={accountSearch}
                    onChange={e => { setAccountSearch(e.target.value); setAccountPage(1); }}
                    className="form-input text-xs pl-8 py-1.5 w-full rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Accounts Table */}
            <div className="card mobile-card-table">
              {paginatedAccounts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <i className="fas fa-users-slash text-3xl mb-2 block text-slate-300" />
                  No matching user accounts found.
                </div>
              ) : (
                <table className="tbl w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="w-[26%]">User</th>
                      <th className="w-[14%]">Role</th>
                      <th className="w-[24%]">Email</th>
                      <th className="w-[14%]">Status</th>
                      <th className="w-[22%]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAccounts.map(a => (
                      <tr key={a.id} className={a.role === 'staff' ? 'cursor-pointer hover:bg-slate-50' : ''}>
                        <td data-label="User" onClick={() => a.role === 'staff' && setStaffDetail(a)}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: a.photo ? '#fff' : (a.role === 'admin' ? '#1a56db' : a.role === 'staff' ? '#10b981' : '#f59e0b') }}>
                              {a.photo ? <img src={a.photo} alt="" className="w-full h-full object-cover" /> : (a.full_name?.[0] || '?')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm text-navy truncate">{a.full_name}</div>
                              <div className="text-[11px] text-slate-400 truncate">@{a.username}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Role" onClick={() => a.role === 'staff' && setStaffDetail(a)}>
                          <span className={`badge ${a.role === 'admin' ? 'badge-critical' : a.role === 'staff' ? 'badge-approved' : 'badge-pending'}`}>
                            {a.role}
                          </span>
                        </td>
                        <td data-label="Email" onClick={() => a.role === 'staff' && setStaffDetail(a)}>
                          <span className="text-xs text-slate-500 truncate block">{a.email || '—'}</span>
                        </td>
                        <td data-label="Status" onClick={() => a.role === 'staff' && setStaffDetail(a)}>
                          <span className={`badge ${a.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                            {a.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td data-label="Action">
                          {a.role === 'staff' ? (
                            <button onClick={() => setStaffDetail(a)} className="btn btn-outline btn-xs">
                              <i className="fas fa-eye mr-1" /> View Details
                            </button>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 text-xs text-slate-400 font-mono">
                              System Acc
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {totalAccountPages > 1 && (
              <div className="flex items-center justify-between px-2 pt-1 text-xs text-slate-500">
                <div>
                  Showing {((currentAccountPage - 1) * ACCOUNTS_PER_PAGE) + 1} to {Math.min(currentAccountPage * ACCOUNTS_PER_PAGE, filteredAccounts.length)} of {filteredAccounts.length} accounts
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentAccountPage <= 1}
                    onClick={() => setAccountPage(p => Math.max(1, p - 1))}
                    className="btn btn-gray btn-xs px-2.5 py-1 disabled:opacity-40"
                  >
                    <i className="fas fa-chevron-left mr-1" /> Prev
                  </button>
                  <span className="px-2 font-bold text-navy">
                    {currentAccountPage} / {totalAccountPages}
                  </span>
                  <button
                    disabled={currentAccountPage >= totalAccountPages}
                    onClick={() => setAccountPage(p => Math.min(totalAccountPages, p + 1))}
                    className="btn btn-gray btn-xs px-2.5 py-1 disabled:opacity-40"
                  >
                    Next <i className="fas fa-chevron-right ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'cycles' && (
          <div className="space-y-3">
            {cycles.length === 0 ? (
              <div className="card p-10 text-center text-slate-400">
                <i className="fas fa-rotate text-4xl mb-3 block text-slate-200" />
                <div className="text-sm font-semibold">No cycles yet</div>
              </div>
            ) : cycles.map(c => {
              const typeInfo = CYCLE_TYPES.find(t => t.key === c.type)
              const cQRs = qrCodes.filter(q => q.cycle_id === c.id)
              const claimed = cQRs.filter(q => q.is_claimed).length
              const pct = cQRs.length > 0 ? Math.round((claimed / cQRs.length) * 100) : 0
              const isCompleted = cQRs.length > 0 && claimed === cQRs.length
              return (
                <div key={c.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-sm text-navy">{c.name}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: `${typeInfo?.color}20`, color: typeInfo?.color }}>
                          {typeInfo?.label}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Created {new Date(c.created_at).toLocaleDateString('en-PH')}
                        </span>
                      </div>
                      <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <i className="fas fa-calendar-day text-blue-600 w-4 text-center" />
                          <span>Claim Date: <strong>{c.distribution_date || 'Schedule Announced Soon'}</strong> ({c.distribution_time || '8:00 AM - 5:00 PM'})</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <i className="fas fa-location-dot text-emerald-600 w-4 text-center mt-0.5" />
                          <span>Venue: <strong>{c.claim_address || 'Barangay Puerto Covered Court'}</strong></span>
                        </div>
                        {c.contact_person && (
                          <div className="flex items-center gap-2">
                            <i className="fas fa-user-tie text-purple-600 w-4 text-center" />
                            <span>Contact: <strong>{c.contact_person}</strong></span>
                          </div>
                        )}
                      </div>
                      {cQRs.length > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>{claimed} claimed</span>
                            <span>{cQRs.length} total QRs</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <span className={`badge flex-shrink-0 ${
                      isCompleted ? 'badge-approved' : c.is_active ? 'badge-approved' : 'badge-rejected'
                    }`}>
                      {isCompleted ? 'Completed' : c.is_active ? 'Active' : 'Ended'}
                    </span>
                  </div>
                  {isCompleted ? (
                    <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 text-center">
                      <i className="fas fa-circle-check mr-1" />
                      All {cQRs.length} eligible beneficiaries have claimed. Cycle is permanently closed.
                    </div>
                  ) : c.is_active ? (
                    <button onClick={() => handleToggleCycle(c)}
                      className="btn btn-sm w-full justify-center mt-3 btn-warning">
                      <i className="fas fa-pause" /> Deactivate Cycle
                    </button>
                  ) : (
                    <button onClick={() => handleToggleCycle(c)}
                      className="btn btn-sm w-full justify-center mt-3 btn-success">
                      <i className="fas fa-play" /> Reactivate Cycle
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'puroks' && (
          <div className="space-y-4">
            {/* Subtab filter: Active vs Archived Backup Vault */}
            <div className="flex items-center justify-between gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPurokSubtab('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    purokSubtab === 'active'
                      ? 'bg-white text-navy shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <i className="fas fa-map mr-1.5 text-blue-600" />
                  Active Puroks ({(puroks || []).filter(p => !p.is_archived).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPurokSubtab('archived')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    purokSubtab === 'archived'
                      ? 'bg-white text-amber-800 shadow-xs ring-1 ring-amber-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <i className="fas fa-vault mr-1.5 text-amber-600" />
                  Backup Vault ({(puroks || []).filter(p => p.is_archived).length})
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-semibold px-2 hidden sm:block">
                <i className="fas fa-shield-halved text-emerald-600 mr-1" />
                Households are 100% preserved during archiving.
              </div>
            </div>

            {purokSubtab === 'active' ? (
              <div className="card mobile-card-table">
                <table className="tbl w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="w-[30%]">Purok Name</th>
                      <th className="w-[30%]">Total Registries</th>
                      <th className="w-[18%]">Status</th>
                      <th className="w-[22%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(puroks || []).filter(p => !p.is_archived).map(p => {
                      const totalHhs = households.filter(h => h.purok_id === p.id).length
                      return (
                        <tr key={p.id}>
                          <td data-label="Name"><span className="font-semibold text-navy">{p.name}</span></td>
                          <td data-label="Total Registries">
                            <span className="font-bold text-slate-700">{totalHhs} household{totalHhs !== 1 ? 's' : ''}</span>
                          </td>
                          <td data-label="Status">
                            <span className={`badge ${p.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td data-label="Actions">
                            <div className="flex gap-1.5">
                              <button onClick={() => { setEditPurok(p); setEditPurokName(p.name) }} className="btn btn-outline btn-xs">
                                <i className="fas fa-edit" /> Edit
                              </button>
                              <button
                                onClick={() => { setConfirmDeletePurok(p); setConfirmPurokInput('') }}
                                className="btn btn-xs border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 font-medium transition-all"
                              >
                                <i className="fas fa-box-archive mr-1 text-[10px]" /> Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card mobile-card-table">
                {(puroks || []).filter(p => p.is_archived).length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <i className="fas fa-vault text-4xl text-slate-300 mb-2 block" />
                    <div className="text-sm font-bold text-slate-600">Backup Vault is Empty</div>
                    <div className="text-xs text-slate-400 mt-0.5">No archived or deleted puroks currently stored.</div>
                  </div>
                ) : (
                  <table className="tbl w-full table-fixed">
                    <thead>
                      <tr>
                        <th className="w-[30%]">Purok Name</th>
                        <th className="w-[35%]">Total Linked Households</th>
                        <th className="w-[17%]">Backup Status</th>
                        <th className="w-[18%]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(puroks || []).filter(p => p.is_archived).map(p => {
                        const totalHhs = households.filter(h => h.purok_id === p.id).length
                        return (
                          <tr key={p.id}>
                            <td data-label="Name"><span className="font-semibold text-navy">{p.name}</span></td>
                            <td data-label="Linked Households">
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {totalHhs} household{totalHhs !== 1 ? 's' : ''} preserved
                              </span>
                            </td>
                            <td data-label="Status">
                              <span className="badge badge-pending">Archived</span>
                            </td>
                            <td data-label="Action">
                              <button
                                onClick={() => handleRestorePurok(p)}
                                className="btn btn-xs bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                              >
                                <i className="fas fa-rotate-left mr-1" /> Restore Purok
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-3">
            <div className="card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-navy flex items-center gap-1.5">
                <i className="fas fa-list-ul text-blue-600" />
                Audit Trail Logs ({(activityLogs || []).length})
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative w-full sm:w-64">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    placeholder="Search logs by user, action, details..."
                    value={activitySearch}
                    onChange={e => setActivitySearch(e.target.value)}
                    className="form-input text-xs pl-8 py-1.5 w-full rounded-xl"
                  />
                </div>
                <button
                  onClick={() => {
                    const headers = [
                      { label: 'Log ID', key: 'id' },
                      { label: 'Timestamp (PST)', key: 'timestamp' },
                      { label: 'Username', key: 'username' },
                      { label: 'Role', key: 'role' },
                      { label: 'Action', key: 'action' },
                      { label: 'Details', key: 'details' },
                      { label: 'IP Address', key: 'ip_address' },
                      { label: 'User Agent / Device', key: 'user_agent' },
                    ]
                    const filteredLogs = (activityLogs || []).filter(l => {
                      if (activitySearch.trim()) {
                        const targetFields = [l.username, l.role, l.action, l.details]
                        if (!fuzzyMatch(targetFields, activitySearch)) return false
                      }
                      return true
                    })
                    const rows = filteredLogs.map(l => ({
                      id: l.id || '—',
                      timestamp: l.login_at ? new Date(l.login_at).toLocaleString('en-PH') : '—',
                      username: l.username || 'System',
                      role: l.role || '—',
                      action: (l.action || '').replace(/_/g, ' '),
                      details: l.details || '—',
                      ip_address: l.ip_address || '—',
                      user_agent: l.user_agent || '—',
                    }))
                    exportToCsv('Audit_Trail_Logs', headers, rows)
                  }}
                  className="btn btn-gray btn-sm cursor-pointer whitespace-nowrap"
                  title="Export Audit Logs to CSV"
                >
                  <i className="fas fa-file-csv text-emerald-600 text-sm" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              </div>
            </div>

            <div className="card mobile-card-table">
              <table className="tbl w-full table-fixed">
                <thead>
                  <tr>
                    <th className="w-[20%]">User</th>
                    <th className="w-[14%]">Role</th>
                    <th className="w-[14%]">Action</th>
                    <th className="w-[34%]">Details</th>
                    <th className="w-[18%]">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(activityLogs || []).filter(l => {
                    if (activitySearch.trim()) {
                      const targetFields = [l.username, l.role, l.action, l.details]
                      if (!fuzzyMatch(targetFields, activitySearch)) return false
                    }
                    return true
                  }).length === 0 ? (
                    <tr><td colSpan={5}>
                      <div className="py-8 text-center text-slate-400 text-sm">
                        <i className="fas fa-list-ul text-3xl mb-2 block text-slate-300" />
                        No matching activity logs found
                      </div>
                    </td></tr>
                  ) : (activityLogs || []).filter(l => {
                    if (activitySearch.trim()) {
                      const targetFields = [l.username, l.role, l.action, l.details]
                      if (!fuzzyMatch(targetFields, activitySearch)) return false
                    }
                    return true
                  }).slice(0, 100).map(l => (
                    <tr key={l.id}>
                      <td data-label="User"><div className="font-semibold text-sm">{l.username}</div></td>
                      <td data-label="Role">
                        <span className={`badge ${l.role === 'admin' ? 'badge-critical' : l.role === 'staff' ? 'badge-approved' : 'badge-pending'}`}>
                          {l.role}
                        </span>
                      </td>
                      <td data-label="Action"><span className="chip">{l.action.replace(/_/g, ' ')}</span></td>
                      <td data-label="Details">
                        <span className="text-xs text-slate-600">{l.details || '—'}</span>
                      </td>
                      <td data-label="Time">
                        <span className="text-xs text-slate-500">{new Date(l.login_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Registration Detail Modal ── */}
      {regDetail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRegDetail(null)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box xl">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Registration Details</h3>
              <button onClick={() => setRegDetail(null)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[['Purok', puroks.find(p => p.id === regDetail.purok_id)?.name],
                  ['House No.', regDetail.house_no_street || 'Not provided'],
                  ['Username', regDetail.username],
                  ['Reg. Date', regDetail.reg_date]].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 p-3 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{k}</div>
                    <div className="text-sm font-semibold text-navy">{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[11px] font-bold text-blue-600 uppercase mb-2">Household Head</div>
                <div className="grid grid-cols-2 gap-2">
                  {[['Name', `${regDetail.head?.fname} ${regDetail.head?.lname}`],
                    ['Age', regDetail.head?.age],
                    ['Sex', regDetail.head?.sex],
                    ['Contact', regDetail.head?.contact],
                    ['Email', regDetail.head?.email]].map(([k, v]) => (
                    <div key={k} className="bg-blue-50 p-2.5 rounded-xl">
                      <div className="text-[10px] font-bold text-blue-400 uppercase mb-0.5">{k}</div>
                      <div className="text-xs font-semibold text-navy">{v || '—'}</div>
                    </div>
                  ))}
                  {normalizeSectors(regDetail.head?.sectors).length > 0 && (
                    <div className="col-span-2 bg-blue-50 p-2.5 rounded-xl">
                      <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Sectors</div>
                      <div className="flex flex-wrap gap-1">
                        {normalizeSectors(regDetail.head?.sectors).map(s =>
                          <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {regDetail.members?.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">Members ({regDetail.members.length})</div>
                  {regDetail.members.map((m, i) => (
                    <div key={i} className="bg-slate-50 p-3 rounded-xl mb-2">
                      <div className="font-semibold text-sm text-navy">{m.fname} {m.lname}</div>
                      <div className="text-xs text-slate-500">{m.age}y · {m.sex} · {m.relationship}</div>
                      {(m.contact || m.email) && (
                        <div className="text-[11px] text-slate-400 mt-1">
                          {m.contact && <><i className="fas fa-phone mr-1" />{m.contact}</>}
                          {m.contact && m.email && ' · '}
                          {m.email && <><i className="fas fa-envelope mr-1" />{m.email}</>}
                        </div>
                      )}
                      {normalizeSectors(m.sectors).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {normalizeSectors(m.sectors).map(s =>
                            <span key={s} className={`badge badge-${s}`}>{s.replace('_', ' ').toUpperCase()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {regDetail.emergency_receiver?.receiver_name && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <div className="text-[11px] font-bold text-amber-700 mb-1">
                    <i className="fas fa-user-shield mr-1" />Emergency Receiver
                  </div>
                  <div className="text-sm text-amber-900">
                    {regDetail.emergency_receiver.receiver_name} · {regDetail.emergency_receiver.receiver_contact}
                    {' · '}{regDetail.emergency_receiver.relationship}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setRegDetail(null)} className="btn btn-gray">Close</button>
              {regDetail.status === 'pending' && (
                <>
                  <button onClick={() => { setShowReject(regDetail); setRegDetail(null) }} className="btn btn-danger">
                    <i className="fas fa-times" /> Reject
                  </button>
                  <button onClick={() => handleApprove(regDetail)} className="btn btn-success">
                    <i className="fas fa-check" /> Approve
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {showReject && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReject(null)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Reject Registration</h3>
              <button onClick={() => setShowReject(null)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="text-sm text-slate-600 mb-4">
                Rejecting: <strong className="text-navy">{showReject.head?.fname} {showReject.head?.lname}</strong>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Rejection (optional)</label>
                <textarea className="form-input" rows={3} value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. Duplicate registration, incomplete info..." />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowReject(null)} className="btn btn-gray">Cancel</button>
              <button onClick={handleReject} className="btn btn-danger">
                <i className="fas fa-times" /> Confirm Reject
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Add Cycle Modal ── */}
      {showAddCycle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddCycle(false)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Create Distribution Cycle</h3>
              <button onClick={() => setShowAddCycle(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Cycle Name *</label>
                <input className="form-input" value={cycleForm.name}
                  onChange={e => setCycleForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Regular Household Relief Q4 2025" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Cycle Type *</label>
                <select className="form-input" value={cycleForm.type}
                  onChange={e => setCycleForm(f => ({ ...f, type: e.target.value }))}>
                  {CYCLE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-input" rows={2} value={cycleForm.description}
                  onChange={e => setCycleForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* ── Distribution Schedule & Location ── */}
              <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                <label className="form-label text-navy font-bold text-xs flex items-center gap-1.5 mb-2">
                  <i className="fas fa-clock text-blue-600" />
                  Distribution Schedule & Claim Location
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group mb-0">
                    <label className="form-label text-[11px]">Distribution Date *</label>
                    <input
                      type="date"
                      className="form-input text-xs"
                      value={cycleForm.distribution_date}
                      onChange={e => setCycleForm(f => ({ ...f, distribution_date: e.target.value }))}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label className="form-label text-[11px]">Claim Time Window *</label>
                    <input
                      type="text"
                      className="form-input text-xs"
                      placeholder="e.g. 8:00 AM - 4:00 PM"
                      value={cycleForm.distribution_time}
                      onChange={e => setCycleForm(f => ({ ...f, distribution_time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group mb-0">
                  <label className="form-label text-[11px]">Claim Venue / Address *</label>
                  <input
                    type="text"
                    className="form-input text-xs"
                    placeholder="e.g. Barangay Puerto Covered Court, Highway"
                    value={cycleForm.claim_address}
                    onChange={e => setCycleForm(f => ({ ...f, claim_address: e.target.value }))}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="form-label text-[11px]">Who to Approach / Contact Person (Optional)</label>
                  <input
                    type="text"
                    className="form-input text-xs"
                    placeholder="e.g. Kagawad Juan Dela Cruz / Barangay Relief Team"
                    value={cycleForm.contact_person}
                    onChange={e => setCycleForm(f => ({ ...f, contact_person: e.target.value }))}
                  />
                </div>
              </div>

              {/* ── Targeted Purok Selection ── */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <label className="form-label text-navy font-bold text-xs flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5">
                    <i className="fas fa-map-location-dot text-emerald-600" />
                    Targeted Puroks (Who receives relief?)
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {cycleForm.target_purok_ids.length === 0 ? 'All Puroks' : `${cycleForm.target_purok_ids.length} Selected`}
                  </span>
                </label>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-navy border-b border-slate-200 pb-2">
                    <input
                      type="checkbox"
                      checked={cycleForm.target_purok_ids.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) setCycleForm(f => ({ ...f, target_purok_ids: [] }))
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>🌐 Entire Barangay Puerto (All Active Puroks)</span>
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {(puroks || []).filter(p => !p.is_archived).map(p => {
                      const isChecked = cycleForm.target_purok_ids.includes(p.id)
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-400 transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCycleForm(f => ({ ...f, target_purok_ids: [...f.target_purok_ids, p.id] }))
                              } else {
                                setCycleForm(f => ({ ...f, target_purok_ids: f.target_purok_ids.filter(id => id !== p.id) }))
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddCycle(false)} className="btn btn-gray">Cancel</button>
              <button onClick={handleCreateCycle} className="btn btn-primary">
                <i className="fas fa-rotate" /> Create & Activate
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Add Purok Modal ── */}
      {showAddPurok && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddPurok(false)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Add Purok</h3>
              <button onClick={() => setShowAddPurok(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Purok Name *</label>
                <input className="form-input" value={purokForm.name}
                  onChange={e => setPurokForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Purok 6" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddPurok(false)} className="btn btn-gray">Cancel</button>
              <button onClick={handleAddPurok} className="btn btn-primary">
                <i className="fas fa-plus" /> Add
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Edit Purok Modal ── */}
      {editPurok && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditPurok(null)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Edit Purok</h3>
              <button onClick={() => setEditPurok(null)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Purok Name *</label>
                <input className="form-input" value={editPurokName}
                  onChange={e => setEditPurokName(e.target.value)}
                  placeholder="e.g. Purok 6" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditPurok(null)} className="btn btn-gray">Cancel</button>
              <button onClick={handleUpdatePurok} className="btn btn-primary">
                <i className="fas fa-save" /> Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── High-Security Confirm Delete Purok Modal ── */}
      {confirmDeletePurok && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDeletePurok(null)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box border-t-4 border-red-500">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-red-700 flex items-center gap-2">
                <i className="fas fa-triangle-exclamation text-red-600" />
                Confirm Purok Archiving
              </h3>
              <button onClick={() => setConfirmDeletePurok(null)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="bg-red-50/80 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 leading-relaxed">
                <div className="font-bold text-sm text-red-800 mb-1 flex items-center gap-1.5">
                  <i className="fas fa-shield-cat" /> High Security Protection
                </div>
                You are archiving <strong className="font-extrabold underline">{confirmDeletePurok.name}</strong>.
                <br />
                All linked registered records (<strong className="font-bold text-red-900">{households.filter(h => h.purok_id === confirmDeletePurok.id).length} households</strong>) will be <span className="font-extrabold text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded">100% preserved</span> in the system and moved to the <strong>Backup Vault</strong>.
              </div>

              <div className="form-group">
                <label className="form-label text-slate-700 font-semibold">
                  To confirm, type <span className="text-red-700 font-extrabold select-all bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{confirmDeletePurok.name}</span> below:
                </label>
                <input
                  className="form-input border-red-200 focus:border-red-500 focus:ring-red-500/20"
                  value={confirmPurokInput}
                  onChange={e => setConfirmPurokInput(e.target.value)}
                  placeholder={`Type "${confirmDeletePurok.name}" to unlock`}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer justify-between bg-slate-50 border-t border-slate-100">
              <button onClick={() => setConfirmDeletePurok(null)} className="btn btn-gray">Cancel</button>
              <button
                disabled={confirmPurokInput.trim() !== confirmDeletePurok.name}
                onClick={() => handleDeletePurok(confirmDeletePurok)}
                className={`btn btn-danger ${confirmPurokInput.trim() !== confirmDeletePurok.name ? 'opacity-50 cursor-not-allowed' : 'shadow-md'}`}
              >
                <i className="fas fa-box-archive mr-1" /> Confirm Archive to Backup Vault
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Add Staff Account Modal ── */}
      {showAddStaff && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddStaff(false)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">
                <i className="fas fa-user-plus text-emerald-500 mr-2" />Add Staff Account
              </h3>
              <button onClick={() => setShowAddStaff(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 mb-4">
                <i className="fas fa-circle-info mr-1" />
                Staff accounts can verify QR codes, manage inventory, and record special assistance distributions.
              </div>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={staffForm.full_name}
                  onChange={e => setStaffForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Juan Dela Cruz" autoFocus />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={staffForm.email}
                    onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact</label>
                  <input className="form-input" value={staffForm.contact}
                    onChange={e => setStaffForm(f => ({ ...f, contact: e.target.value }))}
                    placeholder="09XXXXXXXXX" maxLength={11} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Username * (6+ chars)</label>
                <input className="form-input" value={staffForm.username}
                  onChange={e => setStaffForm(f => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
                  placeholder="staff02" />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="password" className="form-input" value={staffForm.password}
                  onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))} />
                <PasswordStrengthMeter password={staffForm.password} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input type="password" className="form-input" value={staffForm.confirm}
                  onChange={e => setStaffForm(f => ({ ...f, confirm: e.target.value }))} />
                {staffForm.confirm && (
                  <div className={`text-xs mt-1 ${staffForm.password === staffForm.confirm ? 'text-emerald-600' : 'text-red-500'}`}>
                    <i className={`fas ${staffForm.password === staffForm.confirm ? 'fa-circle-check' : 'fa-circle-xmark'} mr-1`} />
                    {staffForm.password === staffForm.confirm ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddStaff(false)} className="btn btn-gray">Cancel</button>
              <button onClick={handleAddStaff} className="btn btn-success">
                <i className="fas fa-user-plus" /> Create Staff Account
              </button>
            </div>
          </motion.div>
        </div>
      )}



      {/* ── Staff Detail Modal (password never shown) ── */}
      {staffDetail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStaffDetail(null)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">
                <i className="fas fa-id-badge text-emerald-500 mr-2" />Staff Account Details
              </h3>
              <button onClick={() => setStaffDetail(null)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="flex flex-col items-center mb-5">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-emerald-100 flex items-center justify-center text-white text-2xl font-bold font-display"
                  style={{ background: staffDetail.photo ? '#fff' : '#10b981' }}>
                  {staffDetail.photo
                    ? <img src={staffDetail.photo} alt="" className="w-full h-full object-cover" />
                    : (staffDetail.full_name?.[0]?.toUpperCase() || '?')}
                </div>
                <div className="font-display font-bold text-navy mt-3">{staffDetail.full_name}</div>
                <div className="text-xs text-slate-500">@{staffDetail.username}</div>
                <span className={`badge mt-1.5 ${staffDetail.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                  {staffDetail.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  ['Username', `@${staffDetail.username}`],
                  ['Role', staffDetail.role],
                  ['Email', staffDetail.email || '—'],
                  ['Contact', staffDetail.contact || '—'],
                  ['Address', staffDetail.address || '—'],
                  ['Created', new Date(staffDetail.created_at).toLocaleDateString('en-PH')],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 p-3 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{k}</div>
                    <div className="text-sm font-semibold text-navy truncate capitalize">{v}</div>
                  </div>
                ))}
              </div>

              {staffDetail.bio && (
                <div className="bg-slate-50 p-3 rounded-xl mb-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bio</div>
                  <div className="text-sm text-navy">{staffDetail.bio}</div>
                </div>
              )}

              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <i className="fas fa-shield-halved mr-1" />
                <strong>Privacy Notice:</strong> Passwords are encrypted and cannot be viewed by anyone, including administrators. If a staff member forgets their password, they should use the "Forgot Password" recovery flow on the login page.
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setStaffDetail(null)} className="btn btn-gray">Close</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
