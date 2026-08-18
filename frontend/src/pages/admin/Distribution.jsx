import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { fuzzyMatch } from '../../utils/fuzzySearch'
import { exportToCsv } from '../../utils/csvExport'
import toast from 'react-hot-toast'

// Default icon/color map for system sectors
const SECTOR_ICONS = {
  household:   { icon: 'fa-house',          color: '#1a56db' },
  pwd:         { icon: 'fa-wheelchair',     color: '#7c3aed' },
  senior:      { icon: 'fa-person-cane',    color: '#f59e0b' },
  osy:         { icon: 'fa-graduation-cap', color: '#10b981' },
  solo_parent: { icon: 'fa-person',         color: '#ec4899' },
  teenage_mom: { icon: 'fa-baby',           color: '#ef4444' },
  emergency:   { icon: 'fa-bolt',           color: '#dc2626' },
}

const COLOR_OPTIONS = ['#1a56db','#7c3aed','#f59e0b','#10b981','#ec4899','#ef4444','#06b6d4','#8b5cf6','#f97316','#84cc16']

export default function AdminDistribution() {
  const location = useLocation()
  const { distributions, cycles, qrCodes, puroks, households, inventory, sectors, standardPackages, addManualDistribution, claimQR, addSector } = useAppStore()
  const { user } = useAuthStore()
  const isStaff = user?.role === 'staff'
  const isAdmin = user?.role === 'admin'

  const [selectedType, setType] = useState('household')
  const [purokFilter, setPurok] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddSector, setShowAddSector] = useState(false)
  const [isSpecial, setIsSpecial] = useState(false)
  const [pkgItems, setPkgItems] = useState([])
  const [newItemId, setNewItemId] = useState('')
  const [selectedHH, setSelectedHH] = useState('')
  const [officialInput, setOfficialInput] = useState('')
  const [form, setForm] = useState({
    dist_date: new Date().toISOString().split('T')[0],
    officials: [],
    remarks: '',
    special_reason: '',
  })
  const [sectorForm, setSectorForm] = useState({ name: '', code: '', color: '#1a56db', icon: 'fa-tag' })

  useEffect(() => {
    if (location.state?.prefillHhCode) {
      const hh = (households || []).find(h => h.hh_code === location.state.prefillHhCode)
      if (hh) {
        setSelectedHH(hh.id)
        setShowAdd(true)
      }
    }
  }, [location.state, households])

  // Build sector buttons dynamically: household + emergency are always shown,
  // plus all sectors from store
  const SECTOR_BTNS = [
    { key: 'household', label: 'Household', ...SECTOR_ICONS.household },
    ...sectors.map(s => ({
      key: s.code, label: s.name,
      icon: SECTOR_ICONS[s.code]?.icon || s.icon || 'fa-tag',
      color: SECTOR_ICONS[s.code]?.color || s.color || '#64748b',
    })),
  ]

  const handleAddSector = () => {
    if (!sectorForm.name.trim()) { toast.error('Sector name required.'); return }
    const code = sectorForm.code.trim() || sectorForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const result = addSector({ name: sectorForm.name, code, color: sectorForm.color, icon: sectorForm.icon })
    if (result.ok) {
      toast.success(`Sector "${sectorForm.name}" added!`)
      setShowAddSector(false)
      setSectorForm({ name: '', code: '', color: '#1a56db', icon: 'fa-tag' })
    } else {
      toast.error(result.message)
    }
  }

  const getCycleStatus = (c) => {
    if (!c) return 'Ended'
    const cQRs = (qrCodes || []).filter((q) => q.cycle_id === c.id)
    const totalQRs = cQRs.length
    const claimedQRs = cQRs.filter((q) => q.is_claimed).length
    const isCompleted = totalQRs > 0 && claimedQRs === totalQRs
    if (isCompleted) return 'Completed'
    if (c.is_active) return 'Active'
    return 'Ended'
  }

  const activeCycle = cycles.find(c => c.is_active && getCycleStatus(c) === 'Active' && c.type === selectedType)
  const anyActive = cycles.find(c => c.is_active && getCycleStatus(c) === 'Active')

  const initPackageForCycle = (cycId, specialMode = isSpecial) => {
    if (specialMode) {
      setPkgItems([])
      return
    }
    const cyc = cycles.find(c => c.id === cycId) || activeCycle || anyActive
    if (cyc?.items && cyc.items.length > 0) {
      setPkgItems(cyc.items.map(p => ({ ...p })))
    } else if (cyc?.type && standardPackages[cyc.type]) {
      setPkgItems(standardPackages[cyc.type].map(p => ({ ...p })))
    } else if (selectedType && standardPackages[selectedType]) {
      setPkgItems(standardPackages[selectedType].map(p => ({ ...p })))
    } else {
      setPkgItems([])
    }
  }

  // Determine which households have already received in the currently active cycle of this type
  const receivedHouseholdIds = (() => {
    if (!activeCycle) return new Set()
    return new Set(distributions
      .filter(d => d.cycle_id === activeCycle.id)
      .map(d => d.household_id))
  })()

  const availableMonths = Array.from(new Set(
    distributions
      .filter(d => !selectedType || d.cycle_type === selectedType)
      .map(d => d.dist_date?.substring(0, 7))
      .filter(Boolean)
  )).sort().reverse()

  const records = distributions.filter(d => {
    if (selectedType && d.cycle_type !== selectedType) return false
    if (purokFilter && String(d.purok_id) !== purokFilter) return false
    if (monthFilter && d.dist_date?.substring(0, 7) !== monthFilter) return false
    if (searchQuery) {
      const itemsSummary = (d.items || []).map(i => `${i.item_name} ${i.quantity}${i.unit || ''}`).join(' ')
      const targetFields = [
        d.member_name,
        d.head_fname,
        d.head_lname,
        d.dist_code,
        d.hh_code,
        d.purok_name,
        itemsSummary,
      ]
      if (!fuzzyMatch(targetFields, searchQuery)) return false
    }
    return true
  })

  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [modalPurokFilter, setModalPurokFilter] = useState('')
  const [modalSearch, setModalSearch] = useState('')

  const openAddModal = () => {
    setShowAdd(true)
    setIsSpecial(false)
    const initialCycleId = activeCycle?.id || anyActive?.id || cycles[0]?.id || ''
    setSelectedCycleId(initialCycleId)
    setSelectedHH('')
    setModalPurokFilter('')
    setModalSearch('')
    setForm({
      dist_date: new Date().toISOString().split('T')[0],
      officials: [], remarks: '', special_reason: '',
    })
    initPackageForCycle(initialCycleId, false)
  }

  const targetCycle = cycles.find(c => c.id === selectedCycleId) || activeCycle || anyActive

  const targetQRs = targetCycle ? qrCodes.filter(q => q.cycle_id === targetCycle.id) : []

  const eligibleLineItems = isSpecial
    ? households.map(hh => {
        const head = hh.members?.find(m => m.is_head) || hh.members?.[0]
        return {
          household_id: hh.id,
          member_id: head?.id || null,
          hh_code: hh.hh_code,
          purok_name: hh.purok_name,
          purok_id: hh.purok_id,
          fname: head?.fname || 'Household',
          lname: head?.lname || hh.hh_code,
          is_claimed: false,
        }
      }).filter(item => {
        if (modalPurokFilter && String(item.purok_id) !== modalPurokFilter) return false
        if (modalSearch) {
          const targetFields = [item.fname, item.lname, item.hh_code, item.purok_name]
          if (!fuzzyMatch(targetFields, modalSearch)) return false
        }
        return true
      })
    : targetQRs.map(q => {
        const hh = households.find(h => h.id === q.household_id)
        const head = hh?.members?.find(m => m.is_head)
        const member = q.member_id ? hh?.members?.find(m => m.id === q.member_id) : head
        return {
          qr_id: q.id,
          qr_token: q.qr_token,
          household_id: q.household_id,
          member_id: q.member_id,
          hh_code: hh?.hh_code,
          purok_name: hh?.purok_name,
          purok_id: hh?.purok_id,
          fname: member?.fname,
          lname: member?.lname,
          is_claimed: q.is_claimed,
          claimed_at: q.claimed_at,
        }
      }).filter(item => {
        if (modalPurokFilter && String(item.purok_id) !== modalPurokFilter) return false
        if (modalSearch) {
          const targetFields = [item.fname, item.lname, item.hh_code, item.purok_name, item.qr_token]
          if (!fuzzyMatch(targetFields, modalSearch)) return false
        }
        return true
      })

  const handleFulfillLineItem = async (item) => {
    if (!form.dist_date) { toast.error('Date required.'); return }
    const itemsToDistribute = pkgItems.length > 0
      ? pkgItems.map(i => ({ item_id: i.item_id, item_name: i.item_name, quantity: parseFloat(i.quantity) || 1, unit: i.unit }))
      : (targetCycle?.items || []).map(i => ({ item_id: i.item_id, item_name: i.item_name, quantity: parseFloat(i.quantity) || 1, unit: i.unit }))

    if (itemsToDistribute.length === 0) {
      toast.error('Add at least one item to distribute.')
      return
    }
    if (isSpecial && !form.special_reason.trim()) { toast.error('Reason required for special assistance.'); return }

    const res = await addManualDistribution({
      cycle_id: isSpecial ? null : targetCycle?.id,
      household_id: item.household_id,
      member_id: item.member_id || null,
      dist_date: form.dist_date,
      officials: form.officials,
      items: itemsToDistribute,
      type: isSpecial ? 'special_assistance' : 'standard',
      special_reason: isSpecial ? form.special_reason : null,
      remarks: form.remarks || null,
      type_filter: isSpecial ? 'emergency' : (targetCycle?.type || selectedType),
    })

    if (res?.ok) {
      toast.success(isSpecial ? `Special assistance distributed to ${item.fname} ${item.lname}!` : `Relief goods distributed to ${item.fname} ${item.lname}!`)
    } else {
      toast.error(res?.message || 'Failed to record distribution.')
    }
  }

  const addOfficial = () => {
    if (!officialInput.trim()) return
    setForm(f => ({ ...f, officials: [...f.officials, { name: officialInput.trim() }] }))
    setOfficialInput('')
  }

  const handleExportCSV = () => {
    const headers = [
      { label: 'Distribution Code', key: 'dist_code' },
      { label: 'Cycle / Event Name', key: 'cycle_name' },
      { label: 'Sector / Type', key: 'type' },
      { label: 'Household Code', key: 'hh_code' },
      { label: 'Recipient / Head Name', key: 'recipient_name' },
      { label: 'Purok', key: 'purok_name' },
      { label: 'Distribution Date', key: 'dist_date' },
      { label: 'Relief Items Breakdown', key: 'items_summary' },
      { label: 'Special Reason / Remarks', key: 'remarks' },
    ]
    const rows = records.map(r => ({
      dist_code: r.dist_code,
      cycle_name: r.cycle_name || 'Standard Relief',
      type: r.type === 'special_assistance' ? 'Special Assistance' : (r.cycle_type || 'Standard'),
      hh_code: r.hh_code || 'N/A',
      recipient_name: r.member_name || (r.head_fname ? `${r.head_fname} ${r.head_lname}` : 'N/A'),
      purok_name: r.purok_name || 'N/A',
      dist_date: r.dist_date || 'N/A',
      items_summary: (r.items || []).map(i => `${i.item_name} (${i.quantity} ${i.unit})`).join('; '),
      remarks: r.special_reason || r.remarks || '—',
    }))
    exportToCsv(`Distribution_Logs_${selectedType || 'all'}`, headers, rows)
  }

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-sub">
            Select a sector type
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowAddSector(true)} className="btn btn-outline btn-sm">
            <i className="fas fa-plus" /> <span className="hidden sm:inline">Add Sector</span>
          </button>
          <button
            onClick={openAddModal}
            disabled={!selectedType}
            className={`btn btn-primary btn-sm transition-all duration-200 ${
              !selectedType ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
            }`}>
            <i className="fas fa-plus" /> Add Distribution
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
        {SECTOR_BTNS.map(s => {
          const isActive = selectedType === s.key
          return (
            <div key={s.key}
              onClick={() => { setType(s.key); setPurok('') }}
              className={`cat-card ${isActive ? 'active' : ''}`}
              style={isActive ? { borderColor: s.color, background: `${s.color}12` } : {}}>
              <i className={`fas ${s.icon} text-2xl mb-1.5`}
                style={{ color: isActive ? s.color : '#94a3b8' }} />
              <div className="font-display font-bold text-xs text-navy">{s.label}</div>
            </div>
          )
        })}
      </div>

      {selectedType && (
        <div className="card p-3 mb-4 space-y-3">
          {/* Header Row: Compact Active Cycle Info + Record Count + Month History Filter */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-navy bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-flex items-center gap-1.5">
                <i className="fas fa-boxes-packing text-blue-600 text-xs" />
                Active Cycle: <strong className="text-navy">{activeCycle ? activeCycle.name : 'None'}</strong>
                {activeCycle && (
                  <span className="text-slate-500 font-normal ml-1">
                    · {receivedHouseholdIds.size} claimed
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {records.length} {records.length === 1 ? 'record' : 'records'} found
              </span>
            </div>

            {/* Right Side: Month Range / Month History Selector & Search */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {/* Month History Filter */}
              <div className="relative">
                <select
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                  className="form-input text-xs py-1 px-2.5 bg-white font-medium border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                >
                  <option value="">📅 All Month History</option>
                  {availableMonths.map(m => {
                    const [year, month] = m.split('-')
                    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1)
                    const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    return <option key={m} value={m}>{label}</option>
                  })}
                </select>
              </div>

              {/* Search Record input */}
              <div className="relative">
                <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search record..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input text-xs py-1 pl-7 pr-2.5 w-36 sm:w-44 border-slate-200 rounded-lg"
                />
              </div>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="btn btn-gray btn-xs py-1 px-2.5 cursor-pointer flex items-center gap-1.5"
                title="Export Distribution Logs to CSV"
              >
                <i className="fas fa-file-csv text-emerald-600 text-xs" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>

          {/* Purok Filter Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <i className="fas fa-filter text-slate-400 text-[10px]" /> Purok Filter:
            </div>
            <div className="tab-scroll">
              <div className={`purok-tab ${!purokFilter ? 'active' : ''}`} onClick={() => setPurok('')}>All</div>
              {puroks.map(p => (
                <div key={p.id} className={`purok-tab ${purokFilter === String(p.id) ? 'active' : ''}`}
                  onClick={() => setPurok(String(p.id))}>{p.name}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {records.length > 0 ? (
        <div className="card mobile-card-table">
          <table className="tbl w-full table-fixed">
            <thead>
              <tr>
                <th className="w-[13%]">Code</th>
                <th className="w-[23%]">Head / Beneficiary</th>
                <th className="w-[9%]">Purok</th>
                <th className="w-[10%]">Date</th>
                <th className="w-[9%]">Type</th>
                <th className="w-[36%]">Details</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td data-label="Code" className="whitespace-nowrap">
                    <span className="font-mono text-xs font-bold text-navy">{r.dist_code}</span>
                  </td>
                  <td data-label="Beneficiary">
                    <div className="font-semibold text-navy text-xs">
                      {r.member_name || (r.head_fname ? `${r.head_fname} ${r.head_lname}` : '—')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{r.hh_code}</div>
                  </td>
                  <td data-label="Purok" className="whitespace-nowrap">
                    <span className="text-xs font-medium text-slate-700">{r.purok_name}</span>
                  </td>
                  <td data-label="Date" className="whitespace-nowrap">
                    <span className="text-xs text-slate-600">{r.dist_date}</span>
                  </td>
                  <td data-label="Type" className="whitespace-nowrap">
                    <span className={`badge ${r.type === 'special_assistance' ? 'badge-pending' : 'badge-approved'}`}>
                      {r.type === 'special_assistance' ? 'Special Assistance' : 'Standard'}
                    </span>
                  </td>
                  <td data-label="Details">
                    <div className="text-[11px] text-slate-600 leading-normal">
                      {r.items?.map(i => `${i.item_name} (${i.quantity}${i.unit})`).join(', ')}
                    </div>
                    {r.special_reason && (
                      <div className="text-[10px] text-amber-700 italic mt-0.5">
                        Reason: {r.special_reason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedType ? (
        <div className="card p-10 text-center text-slate-400">
          <i className="fas fa-boxes-stacked text-4xl mb-3 block text-slate-300" />
          <div className="text-sm font-semibold">No distribution records for this sector</div>
          <div className="text-xs mt-1">Click "Add Distribution" to record relief goods.</div>
        </div>
      ) : null}

      {!selectedType && (
        <div className="card p-10 text-center text-slate-400">
          <i className="fas fa-truck text-5xl mb-3 block text-slate-200" />
          <div className="text-sm font-semibold">Select a distribution type</div>
          <div className="text-xs mt-1">Choose Household, PWD, Senior, OSY, Solo Parent, or Teenage Mom</div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="modal-box lg">
            <div className="modal-header">
              <div>
                <h3 className="font-display font-bold text-base text-navy">
                  {isSpecial ? 'Special Assistance Distribution' : 'Cycle Beneficiary Fulfillment'}
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  {isSpecial
                    ? 'Search directly for any registered household to provide urgent emergency relief'
                    : 'Select a distribution cycle to view and fulfill beneficiary line items'}
                </div>
              </div>
              <button onClick={() => setShowAdd(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {/* Special Assistance Toggle */}
              <div className="flex items-center justify-between p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                <div>
                  <div className="text-xs font-semibold text-amber-900">Mark as Special Assistance</div>
                  <div className="text-[11px] text-amber-700">Decouples from cycles & allows searching any household directly</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={isSpecial}
                    onChange={e => {
                      const val = e.target.checked
                      setIsSpecial(val)
                      initPackageForCycle(selectedCycleId, val)
                    }} />
                  <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-amber-500
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full
                    after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>

              {/* Step 1: Select Cycle (Only shown when NOT Special Assistance) */}
              {!isSpecial && (
                <div className="form-group">
                  <label className="form-label font-bold text-navy text-sm">
                    1. Select Distribution Cycle *
                  </label>
                  <select className="form-input font-medium"
                    value={selectedCycleId}
                    onChange={e => {
                      const val = e.target.value
                      setSelectedCycleId(val)
                      initPackageForCycle(val, isSpecial)
                    }}>
                    <option value="">-- Select Distribution Cycle --</option>
                    {cycles.map(c => {
                      const status = getCycleStatus(c)
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type.toUpperCase()}) · {status}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              {!isSpecial && targetCycle && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs font-bold text-blue-900 flex items-center gap-2">
                      <span>{targetCycle.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        getCycleStatus(targetCycle) === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                        getCycleStatus(targetCycle) === 'Completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {getCycleStatus(targetCycle)}
                      </span>
                    </div>
                    <div className="text-[11px] text-blue-700 mt-0.5">
                      Type: <span className="uppercase font-semibold">{targetCycle.type}</span> ·
                      {targetQRs.length} Total Eligible Beneficiaries
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="badge badge-approved">
                      {targetQRs.filter(q => q.is_claimed).length} Claimed
                    </span>
                    <span className="badge badge-pending">
                      {targetQRs.filter(q => !q.is_claimed).length} Left
                    </span>
                  </div>
                </div>
              )}

              {/* Date Option */}
              <div>
                <label className="form-label">Distribution Date *</label>
                <input type="date" className="form-input"
                  value={form.dist_date}
                  onChange={e => setForm(f => ({ ...f, dist_date: e.target.value }))} />
              </div>

              {/* Purok Filter Tabs in Modal */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Filter by Purok</div>
                <div className="tab-scroll">
                  <div className={`purok-tab ${!modalPurokFilter ? 'active' : ''}`} onClick={() => setModalPurokFilter('')}>All</div>
                  {puroks.map(p => (
                    <div key={p.id} className={`purok-tab ${modalPurokFilter === String(p.id) ? 'active' : ''}`}
                      onClick={() => setModalPurokFilter(String(p.id))}>{p.name}</div>
                  ))}
                </div>
              </div>

              {isSpecial && (
                <div className="form-group">
                  <label className="form-label">Reason for Special Assistance *</label>
                  <textarea className="form-input text-xs" rows={2}
                    value={form.special_reason}
                    onChange={e => setForm(f => ({ ...f, special_reason: e.target.value }))}
                    placeholder="e.g. Death in the family, medical emergency, fire victim..." />
                </div>
              )}

              {/* Package Preview */}
              <div className="form-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label mb-0">Relief Goods Package *</label>
                  <span className="text-[11px] text-blue-600 font-semibold">
                    {pkgItems.length} items configured
                  </span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {pkgItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2 text-xs">
                      <span className="flex-1 font-semibold text-navy truncate">{item.item_name}</span>
                      <input type="number" min="0" step="0.5"
                        className="w-16 form-input text-xs text-center py-1"
                        value={item.quantity}
                        onChange={e => setPkgItems(p => p.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))} />
                      <span className="text-xs text-slate-400 w-10">{item.unit}</span>
                      <button onClick={() => setPkgItems(p => p.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600">
                        <i className="fas fa-trash text-xs" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-2">
                  <select
                    className="form-input text-xs w-full bg-blue-50/50 border-blue-200 text-blue-800 font-medium"
                    value={newItemId}
                    onChange={e => {
                      const id = e.target.value;
                      if (!id) return;
                      const invItem = inventory.find(inv => String(inv.id) === String(id));
                      if (invItem) {
                        const existingIdx = pkgItems.findIndex(it => String(it.item_id) === String(invItem.id));
                        if (existingIdx >= 0) {
                          setPkgItems(p => p.map((it, idx) => idx === existingIdx ? { ...it, quantity: Number(it.quantity) + 1 } : it));
                        } else {
                          setPkgItems(p => [...p, { item_id: invItem.id, item_name: invItem.name, quantity: 1, unit: invItem.unit }]);
                        }
                      }
                      setNewItemId('');
                    }}
                  >
                    <option value="">+ Add Item from Inventory...</option>
                    {inventory.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} ({inv.quantity} {inv.unit} in stock)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 2: Line Items Order List / Household List */}
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-navy truncate">
                      {isSpecial
                        ? `Select Household for Special Assistance (${eligibleLineItems.length})`
                        : `2. Eligible Beneficiaries Order List (${eligibleLineItems.length})`}
                    </div>
                    <div className="text-[11px] text-slate-400 font-normal truncate">
                      {isSpecial ? 'Direct distribution to household' : 'Each line item has a unique QR code'}
                    </div>
                  </div>

                  {/* Search Beneficiary Bar placed directly beside the header */}
                  <div className="relative w-full sm:w-64 flex-shrink-0">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                      className="form-input text-xs pl-8 !py-1.5 border-slate-200 rounded-xl w-full"
                      placeholder={isSpecial ? "Search household..." : "Search by name or HH code..."}
                      value={modalSearch}
                      onChange={e => setModalSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto bg-white">
                  {eligibleLineItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      {isSpecial
                        ? 'No households found matching search filters.'
                        : (targetCycle ? 'No eligible beneficiaries match filters.' : 'Select a cycle above first.')}
                    </div>
                  ) : (
                    eligibleLineItems.map((item, idx) => (
                      <div key={item.qr_id || item.household_id || idx} className={`p-3 flex items-center justify-between gap-3 ${item.is_claimed ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-navy">{item.fname} {item.lname}</span>
                            {item.qr_token && (
                              <span className="text-[10px] bg-slate-100 font-mono text-slate-600 px-1.5 py-0.5 rounded">
                                QR: {item.qr_token?.substring(0, 8)}...
                              </span>
                            )}
                            {isSpecial && (
                              <span className="badge badge-pending">Special Relief</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {item.hh_code} · {item.purok_name}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {item.is_claimed ? (
                            <span className="badge badge-approved py-1.5 px-3">
                              <i className="fas fa-check mr-1" />Distributed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleFulfillLineItem(item)}
                              className="btn btn-success btn-xs">
                              <i className="fas fa-truck" /> {isSpecial ? 'Distribute Special' : 'Distribute'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div className="form-group">
                <label className="form-label">Remarks (optional)</label>
                <textarea className="form-input text-xs" rows={1}
                  value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  placeholder="Optional distribution notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAdd(false)} className="btn btn-primary">Done</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Sector Modal */}
      {showAddSector && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddSector(false)}>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">
                <i className="fas fa-tag text-blue-500 mr-2" />Add New Sector
              </h3>
              <button onClick={() => setShowAddSector(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 mb-4">
                <i className="fas fa-circle-info mr-1" />
                Create a custom sector if the default ones (PWD, Senior, OSY, Solo Parent, Teenage Mom) don't fit your client's needs.
              </div>
              <div className="form-group">
                <label className="form-label">Sector Name *</label>
                <input className="form-input" value={sectorForm.name}
                  onChange={e => setSectorForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Indigenous People, Single Father" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Code (optional, auto-generated if blank)</label>
                <input className="form-input" value={sectorForm.code}
                  onChange={e => setSectorForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="e.g. indigenous_people" />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} type="button" onClick={() => setSectorForm(f => ({ ...f, color: c }))}
                      className="w-9 h-9 rounded-xl border-2 transition-all"
                      style={{
                        background: c,
                        borderColor: sectorForm.color === c ? '#0a1f47' : 'transparent',
                        transform: sectorForm.color === c ? 'scale(1.1)' : 'scale(1)',
                      }} />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Icon (Font Awesome class)</label>
                <input className="form-input" value={sectorForm.icon}
                  onChange={e => setSectorForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="fa-tag" />
                <div className="text-[11px] text-slate-400 mt-1">
                  Preview: <i className={`fas ${sectorForm.icon} text-xl ml-2`} style={{ color: sectorForm.color }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddSector(false)} className="btn btn-gray">Cancel</button>
              <button onClick={handleAddSector} className="btn btn-primary">
                <i className="fas fa-plus" /> Create Sector
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
