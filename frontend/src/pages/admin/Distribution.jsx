import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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

/**
 * Printable Distribution Acknowledgment Slip / Receipt Modal
 */
function DistributionSlipModal({ receipt, onClose, onDistributeNext }) {
  if (!receipt) return null

  const items = receipt.items || []
  const dateFormatted = receipt.dist_date
    ? new Date(receipt.dist_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print-slip"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card p-6 sm:p-8 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto border border-slate-200"
      >
        {/* Printable Voucher Section */}
        <div id="distribution-slip-printable" className="space-y-5 text-slate-800">
          {/* Header */}
          <div className="text-center border-b pb-4 border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Republic of the Philippines · City of Cagayan de Oro
            </div>
            <div className="text-lg font-black text-navy uppercase tracking-tight mt-0.5">
              Barangay Puerto Disaster Risk Reduction &amp; Relief Operations
            </div>
            <div className="inline-block mt-2 px-3.5 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-blue-800 font-bold text-xs uppercase tracking-wide">
              Official Distribution Acknowledgment Receipt
            </div>
          </div>

          {/* Reference Meta Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Tracking Code</div>
              <div className="font-mono font-black text-navy text-sm">{receipt.dist_code}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Distribution Date</div>
              <div className="font-bold text-slate-700">{dateFormatted}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Event / Cycle</div>
              <div className="font-bold text-navy truncate" title={receipt.cycle_name}>
                {receipt.cycle_name || 'Standard Relief'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Sector Type</div>
              <div className="font-bold text-blue-700 uppercase">
                {receipt.cycle_type || receipt.type || 'Household'}
              </div>
            </div>
          </div>

          {/* Beneficiary Details Box */}
          <div className="border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
            <div className="font-bold text-slate-700 text-xs uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center justify-between">
              <span>Beneficiary Information</span>
              <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-bold">
                {receipt.hh_code}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-slate-400">Household Head:</span>{' '}
                <strong className="text-navy">
                  {receipt.head_fname ? `${receipt.head_fname} ${receipt.head_lname}` : (receipt.recipient_name || '—')}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Purok:</span>{' '}
                <strong className="text-slate-700">{receipt.purok_name || 'Barangay Puerto'}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400">Physical Claimant (Received By):</span>{' '}
                <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {receipt.recipient_name || receipt.member_name || (receipt.head_fname ? `${receipt.head_fname} ${receipt.head_lname}` : 'Beneficiary')}
                </strong>
              </div>
              {receipt.special_reason && (
                <div className="sm:col-span-2 text-amber-800 bg-amber-50/70 p-2 rounded border border-amber-200">
                  <span className="font-bold">Reason for Special Relief:</span> {receipt.special_reason}
                </div>
              )}
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
              Relief Package Breakdown
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3.5 w-10">#</th>
                  <th className="py-2 px-3.5">Item Description</th>
                  <th className="py-2 px-3.5 text-right w-24">Quantity</th>
                  <th className="py-2 px-3.5 w-24">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3.5 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3.5 font-bold text-navy">{item.item_name}</td>
                    <td className="py-2 px-3.5 text-right font-extrabold text-navy font-mono">{item.quantity}</td>
                    <td className="py-2 px-3.5 text-slate-600">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signature Sign-offs */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 pb-1 h-8" />
              <div className="font-bold text-navy mt-1">Claimant / Recipient Signature</div>
              <div className="text-[10px] text-slate-400">Signature over printed name</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-1 h-8 flex items-end justify-center font-bold text-navy text-[11px]">
                {receipt.recorded_by || 'Barangay Relief Officer'}
              </div>
              <div className="font-bold text-navy mt-1">Issuing Barangay Officer</div>
              <div className="text-[10px] text-slate-400">Authorized Disaster Response Staff</div>
            </div>
          </div>
        </div>

        {/* Modal Actions (Hidden in Print) */}
        <div className="no-print mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <i className="fas fa-circle-check text-emerald-500" />
            <span>Distribution &amp; Stock Ledger successfully updated.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-outline btn-sm px-3 flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
            >
              <i className="fas fa-print" /> Print Slip
            </button>
            <button
              type="button"
              onClick={onDistributeNext}
              className="btn btn-primary btn-sm px-3.5 flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <i className="fas fa-user-plus" /> Next Resident
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-gray btn-sm px-3 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Modern Resident-First Desk Distribution Terminal Modal
 */
function DeskDistributionModal({
  isOpen,
  onClose,
  initialPrefillHhId,
  selectedSectorType,
  onSuccess,
}) {
  const {
    households,
    cycles,
    distributions,
    inventory,
    puroks,
    standardPackages,
    addManualDistribution,
  } = useAppStore()
  const { user } = useAuthStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPurokFilter, setSelectedPurokFilter] = useState('')
  const [selectedHH, setSelectedHH] = useState(null)
  const [claimantType, setClaimantType] = useState('head') // 'head' | 'member' | 'rep'
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [repName, setRepName] = useState('')
  const [repRelation, setRepRelation] = useState('')
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [isSpecial, setIsSpecial] = useState(false)
  const [specialReason, setSpecialReason] = useState('')
  const [distDate, setDistDate] = useState(new Date().toISOString().split('T')[0])
  const [pkgItems, setPkgItems] = useState([])
  const [remarks, setRemarks] = useState('')
  const [newItemId, setNewItemId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Handle prefill if passed from other page
  useEffect(() => {
    if (initialPrefillHhId && households.length > 0) {
      const match = households.find(
        h => h.id === initialPrefillHhId || h.hh_code === initialPrefillHhId
      )
      if (match) {
        handleSelectHousehold(match)
      }
    }
  }, [initialPrefillHhId, households])

  // Active cycles list
  const activeCycles = useMemo(() => {
    return (cycles || []).filter(c => c.is_active)
  }, [cycles])

  // Helper to load package items based on sector / cycle
  const loadPackageForHousehold = (hh, cycleId = null, forceSpecial = false) => {
    const memberSectors = (hh.members || []).flatMap(m => m.sectors || (m.sector ? [m.sector] : []))
    const primarySector = memberSectors[0] || selectedSectorType || 'household'

    if (forceSpecial) {
      const template = standardPackages[primarySector] || standardPackages['household'] || []
      setPkgItems(template.map(p => ({ ...p })))
      return
    }

    const cyc = cycleId ? cycles.find(c => c.id === cycleId) : activeCycles.find(c => c.type === primarySector || c.type === 'household')
    if (cyc?.items && cyc.items.length > 0) {
      setPkgItems(cyc.items.map(p => ({ ...p })))
    } else if (cyc?.type && standardPackages[cyc.type]) {
      setPkgItems(standardPackages[cyc.type].map(p => ({ ...p })))
    } else {
      const template = standardPackages[primarySector] || standardPackages['household'] || []
      setPkgItems(template.map(p => ({ ...p })))
    }
  }

  // Select household handler
  const handleSelectHousehold = (hh) => {
    setSelectedHH(hh)
    setSearchQuery('')
    setClaimantType('head')

    const head = hh.members?.find(m => m.is_head) || hh.members?.[0]
    const nonHeadMembers = (hh.members || []).filter(m => m.id !== head?.id)
    if (nonHeadMembers.length > 0) {
      setSelectedMemberId(nonHeadMembers[0].id)
    }

    // Auto-detect matching active cycle
    const memberSectors = (hh.members || []).flatMap(m => m.sectors || (m.sector ? [m.sector] : []))
    const matchingCycle = activeCycles.find(
      c => c.type === selectedSectorType || memberSectors.includes(c.type) || c.type === 'household'
    )

    if (matchingCycle) {
      setSelectedCycleId(matchingCycle.id)
      setIsSpecial(false)
      loadPackageForHousehold(hh, matchingCycle.id, false)
    } else {
      setSelectedCycleId('')
      setIsSpecial(true)
      loadPackageForHousehold(hh, null, true)
    }
  }

  // Search filtered households
  const searchResults = useMemo(() => {
    if (selectedHH) return []
    const q = searchQuery.toLowerCase().trim()
    return households.filter(hh => {
      if (selectedPurokFilter && String(hh.purok_id) !== String(selectedPurokFilter)) {
        return false
      }
      if (!q) return true
      const head = hh.members?.find(m => m.is_head) || hh.members?.[0]
      const headName = head ? `${head.fname} ${head.lname}`.toLowerCase() : ''
      const hhCode = (hh.hh_code || '').toLowerCase()
      const purok = (hh.purok_name || '').toLowerCase()
      const memberNames = (hh.members || []).map(m => `${m.fname} ${m.lname}`.toLowerCase()).join(' ')
      return headName.includes(q) || hhCode.includes(q) || purok.includes(q) || memberNames.includes(q)
    }).slice(0, 10)
  }, [households, searchQuery, selectedPurokFilter, selectedHH])

  // Check if household has already claimed in the chosen cycle
  const targetCycle = isSpecial ? null : (selectedCycleId ? cycles.find(c => c.id === selectedCycleId) : null)
  const existingClaim = useMemo(() => {
    if (!selectedHH || !targetCycle) return null
    return distributions.find(
      d => d.household_id === selectedHH.id && d.cycle_id === targetCycle.id
    )
  }, [selectedHH, targetCycle, distributions])

  const head = selectedHH?.members?.find(m => m.is_head) || selectedHH?.members?.[0]
  const nonHeadMembers = (selectedHH?.members || []).filter(m => m.id !== head?.id)

  // Validation
  const hasItems = pkgItems.length > 0 && pkgItems.some(i => (parseFloat(i.quantity) || 0) > 0)
  const isBlockedByDoubleClaim = Boolean(existingClaim && !isSpecial)
  const isRepValid = claimantType !== 'rep' || Boolean(repName.trim())
  const isSpecialValid = !isSpecial || Boolean(specialReason.trim())
  const canSubmit = selectedHH && hasItems && !isBlockedByDoubleClaim && isRepValid && isSpecialValid && !submitting

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    let recipientDesc = head ? `${head.fname} ${head.lname}` : 'Household Head'
    let memberIdToPass = null

    if (claimantType === 'head') {
      recipientDesc = head ? `${head.fname} ${head.lname} (Head)` : 'Head'
      memberIdToPass = head?.id || null
    } else if (claimantType === 'member') {
      const chosen = selectedHH.members?.find(m => m.id === selectedMemberId)
      if (chosen) {
        recipientDesc = `${chosen.fname} ${chosen.lname} (${chosen.relation || 'Member'})`
        memberIdToPass = chosen.id
      }
    } else if (claimantType === 'rep') {
      recipientDesc = `${repName.trim()} (${repRelation.trim() || 'Authorized Representative'})`
    }

    const finalRemarks = [
      claimantType !== 'head' ? `Claimed by: ${recipientDesc}` : null,
      remarks.trim() ? remarks.trim() : null,
    ].filter(Boolean).join(' · ')

    const itemsToDistribute = pkgItems.map(i => ({
      item_id: i.item_id,
      item_name: i.item_name,
      quantity: parseFloat(i.quantity) || 1,
      unit: i.unit,
    }))

    setSubmitting(true)
    const res = await addManualDistribution({
      cycle_id: isSpecial ? null : targetCycle?.id,
      household_id: selectedHH.id,
      member_id: memberIdToPass,
      dist_date: distDate,
      officials: [{ name: user?.full_name || user?.username || 'Relief Officer' }],
      items: itemsToDistribute,
      type: isSpecial ? 'special_assistance' : 'standard',
      special_reason: isSpecial ? specialReason.trim() : null,
      remarks: finalRemarks,
      type_filter: isSpecial ? 'emergency' : (targetCycle?.type || selectedSectorType || 'household'),
    })
    setSubmitting(false)

    if (res?.ok) {
      toast.success(`Relief package issued to ${recipientDesc}!`)
      onSuccess({
        dist_code: res.dist_code,
        household_id: selectedHH.id,
        hh_code: selectedHH.hh_code,
        purok_name: selectedHH.purok_name,
        head_fname: head?.fname,
        head_lname: head?.lname,
        recipient_name: recipientDesc,
        items: itemsToDistribute,
        cycle_name: isSpecial ? 'Special / Emergency Assistance' : (targetCycle?.name || 'Relief Distribution'),
        cycle_type: isSpecial ? 'Emergency' : (targetCycle?.type || selectedSectorType || 'Household'),
        dist_date: distDate,
        special_reason: isSpecial ? specialReason : null,
        remarks: finalRemarks,
        recorded_by: user?.full_name || user?.username || 'Staff',
      })
    } else {
      toast.error(res?.message || 'Failed to record distribution.')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto border border-slate-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div>
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <i className="fas fa-hand-holding-heart" /> Desk Distribution Terminal
            </div>
            <h3 className="font-display font-black text-xl text-navy uppercase tracking-tight">
              Manual Relief Distribution
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify resident, inspect live warehouse stock, and issue relief packages on the spot.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-navy hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <i className="fas fa-xmark text-sm" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* STEP 1: Resident Search or Selected Card */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              1. Resident Identification &amp; Household Verification *
            </label>

            {!selectedHH ? (
              <div className="space-y-2">
                <div className="relative">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search by resident name (e.g. Juan), HH code (e.g. HH-001), or Purok..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="form-input text-xs pl-8 py-2 w-full rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                  />
                </div>

                {/* Quick Purok Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold">Purok:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPurokFilter('')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                      !selectedPurokFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {puroks.filter(p => !p.is_archived).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPurokFilter(String(p.id))}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                        selectedPurokFilter === String(p.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                {/* Search Results List */}
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white shadow-2xs">
                  {searchResults.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      <i className="fas fa-user-slash text-2xl text-slate-300 block mb-1.5" />
                      No registered residents found matching search filters.
                    </div>
                  ) : (
                    searchResults.map(hh => {
                      const hHead = hh.members?.find(m => m.is_head) || hh.members?.[0]
                      return (
                        <div
                          key={hh.id}
                          onClick={() => handleSelectHousehold(hh)}
                          className="p-3 hover:bg-blue-50/70 cursor-pointer transition-colors flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-bold text-navy text-sm">
                              {hHead ? `${hHead.fname} ${hHead.lname}` : 'Household Head'}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono mt-0.5">
                              <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                {hh.hh_code}
                              </span>
                              <span>·</span>
                              <span>{hh.purok_name}</span>
                              <span>·</span>
                              <span>{hh.members?.length || 1} family member(s)</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs px-2.5 py-1 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white"
                          >
                            Select
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Selected Resident Card */
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base shadow-2xs">
                    <i className="fas fa-house-user" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-navy text-sm">
                        {head ? `${head.fname} ${head.lname}` : 'Household Head'}
                      </span>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {selectedHH.hh_code}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {selectedHH.purok_name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Family Size: <strong>{selectedHH.members?.length || 1} members</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHH(null)
                    setSearchQuery('')
                    setPkgItems([])
                  }}
                  className="btn btn-outline btn-xs px-2.5 py-1 text-slate-600 border-slate-200 hover:bg-slate-200"
                >
                  <i className="fas fa-rotate mr-1" /> Change Resident
                </button>
              </div>
            )}
          </div>

          {/* STEP 2 & 3: Once Household is Selected */}
          {selectedHH && (
            <>
              {/* Eligibility & Double-Claim Guard Banner */}
              {isSpecial ? (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <i className="fas fa-bolt text-amber-600" /> Special Assistance / Emergency Distribution
                    </span>
                    <span className="badge badge-pending text-[10px]">Special Mode</span>
                  </div>
                  <p className="text-amber-800 text-[11px]">
                    This distribution is decoupled from regular scheduled cycles to fulfill urgent disaster or emergency relief.
                  </p>
                </div>
              ) : existingClaim ? (
                /* High Visibility Double-Claim Warning */
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-red-900">
                    <span className="flex items-center gap-1.5 text-sm">
                      <i className="fas fa-triangle-exclamation text-red-600" />
                      ALREADY RECEIVED RELIEF FOR THIS CYCLE
                    </span>
                    <span className="badge badge-critical text-[10px]">Already Claimed</span>
                  </div>
                  <p className="text-red-800 leading-snug">
                    This household already claimed relief for <strong>{targetCycle?.name}</strong> on <strong>{existingClaim.dist_date}</strong>.
                    {existingClaim.dist_code && ` (Tracking Code: ${existingClaim.dist_code})`}.
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <label className="flex items-center gap-2 font-bold text-red-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSpecial}
                        onChange={e => {
                          setIsSpecial(e.target.checked)
                          loadPackageForHousehold(selectedHH, null, e.target.checked)
                        }}
                        className="rounded border-red-300 text-red-600"
                      />
                      <span>Authorize Emergency / Special Assistance Override</span>
                    </label>
                  </div>
                </div>
              ) : (
                /* Eligible Green Banner */
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      <i className="fas fa-check" />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-900 text-xs">
                        Verified &amp; Eligible for Distribution
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Cycle: <strong>{targetCycle ? targetCycle.name : 'Standard Relief'}</strong> · No previous claims recorded for this cycle.
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-approved text-xs font-bold">Ready</span>
                </div>
              )}

              {/* Distribution Cycle Selection & Override Option */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">Distribution Cycle</label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isSpecial
                        setIsSpecial(next)
                        loadPackageForHousehold(selectedHH, next ? null : selectedCycleId, next)
                      }}
                      className="text-[10px] text-blue-600 font-semibold hover:underline"
                    >
                      {isSpecial ? 'Switch to Scheduled Cycle' : 'Switch to Special Relief'}
                    </button>
                  </div>
                  {!isSpecial ? (
                    <select
                      className="form-input text-xs py-2 rounded-xl w-full"
                      value={selectedCycleId}
                      onChange={e => {
                        const val = e.target.value
                        setSelectedCycleId(val)
                        loadPackageForHousehold(selectedHH, val, false)
                      }}
                    >
                      {activeCycles.length === 0 ? (
                        <option value="" disabled>-- No active cycles found --</option>
                      ) : (
                        <option value="">-- Select Active Cycle --</option>
                      )}
                      {activeCycles.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input text-xs py-2 rounded-xl w-full bg-slate-100 font-semibold text-slate-600"
                      disabled
                      value="Special Assistance / Emergency Distribution"
                    />
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Distribution Date *</label>
                  <input
                    type="date"
                    required
                    className="form-input text-xs py-2 rounded-xl w-full"
                    value={distDate}
                    onChange={e => setDistDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Special Reason Input if isSpecial */}
              {isSpecial && (
                <div>
                  <label className="font-bold text-amber-900 block mb-1">
                    Reason for Special / Emergency Relief *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Typhoon victim, fire emergency, urgent medical need..."
                    className="form-input text-xs py-2 rounded-xl w-full border-amber-200 bg-amber-50/50"
                    value={specialReason}
                    onChange={e => setSpecialReason(e.target.value)}
                  />
                </div>
              )}

              {/* Physical Recipient / Claimant Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Physical Recipient / Who is Claiming? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                    claimantType === 'head' ? 'border-blue-500 bg-blue-50/80 font-bold text-blue-900 shadow-2xs' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="claimantType"
                      checked={claimantType === 'head'}
                      onChange={() => setClaimantType('head')}
                      className="text-blue-600"
                    />
                    <div className="truncate">
                      <div className="truncate">{head ? `${head.fname} ${head.lname}` : 'Head'}</div>
                      <div className="text-[10px] text-slate-400 font-normal">Household Head</div>
                    </div>
                  </label>

                  {nonHeadMembers.length > 0 && (
                    <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                      claimantType === 'member' ? 'border-blue-500 bg-blue-50/80 font-bold text-blue-900 shadow-2xs' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="claimantType"
                        checked={claimantType === 'member'}
                        onChange={() => setClaimantType('member')}
                        className="text-blue-600"
                      />
                      <div className="truncate">
                        <div>Family Member</div>
                        <div className="text-[10px] text-slate-400 font-normal">Spouse, Child, Relative</div>
                      </div>
                    </label>
                  )}

                  <label className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                    claimantType === 'rep' ? 'border-blue-500 bg-blue-50/80 font-bold text-blue-900 shadow-2xs' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="claimantType"
                      checked={claimantType === 'rep'}
                      onChange={() => setClaimantType('rep')}
                      className="text-blue-600"
                    />
                    <div className="truncate">
                      <div>Authorized Rep.</div>
                      <div className="text-[10px] text-slate-400 font-normal">Neighbor / Caregiver</div>
                    </div>
                  </label>
                </div>

                {/* Member selection dropdown if claimantType === 'member' */}
                {claimantType === 'member' && nonHeadMembers.length > 0 && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="font-semibold text-slate-600 block mb-1 text-[11px]">
                      Select Registered Family Member:
                    </label>
                    <select
                      className="form-input text-xs py-1.5 rounded-lg w-full font-bold text-navy"
                      value={selectedMemberId}
                      onChange={e => setSelectedMemberId(e.target.value)}
                    >
                      {nonHeadMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.fname} {m.lname} ({m.relation || 'Member'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* External representative name inputs if claimantType === 'rep' */}
                {claimantType === 'rep' && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1 text-[11px]">Representative Full Name *</label>
                      <input
                        type="text"
                        required
                        className="form-input text-xs py-1.5 rounded-lg w-full"
                        placeholder="e.g. Maria Clara Santos"
                        value={repName}
                        onChange={e => setRepName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1 text-[11px]">Relationship / ID Presented</label>
                      <input
                        type="text"
                        className="form-input text-xs py-1.5 rounded-lg w-full"
                        placeholder="e.g. Caregiver / Voter ID"
                        value={repRelation}
                        onChange={e => setRepRelation(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: Relief Package Items with Live Warehouse Inventory Check */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">
                    Relief Goods Package Breakdown ({pkgItems.length} items) *
                  </label>
                  <button
                    type="button"
                    onClick={() => loadPackageForHousehold(selectedHH, selectedCycleId, isSpecial)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fas fa-rotate text-[10px]" /> Reload Template
                  </button>
                </div>

                {pkgItems.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                    No items in this package yet. Use the dropdown below to add relief goods.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {pkgItems.map((item, idx) => {
                      const invMatch = inventory.find(
                        inv => String(inv.id) === String(item.item_id) || inv.name.toLowerCase() === item.item_name.toLowerCase()
                      )
                      const stockAvailable = invMatch ? invMatch.quantity : 0
                      const isLow = stockAvailable < (parseFloat(item.quantity) || 0)

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-navy truncate">{item.item_name}</div>
                            <div className="text-[10px] mt-0.5">
                              {isLow ? (
                                <span className="text-red-600 font-bold flex items-center gap-1">
                                  <i className="fas fa-triangle-exclamation" />
                                  Only {stockAvailable} {item.unit} in warehouse!
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium flex items-center gap-1">
                                  <i className="fas fa-circle-check text-emerald-500" />
                                  {stockAvailable} {item.unit} in stock
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              className="w-16 form-input text-xs text-center py-1 font-bold text-navy"
                              value={item.quantity}
                              onChange={e => {
                                const val = e.target.value
                                setPkgItems(p => p.map((it, i) => i === idx ? { ...it, quantity: val } : it))
                              }}
                            />
                            <span className="text-slate-500 font-semibold w-10 text-center">{item.unit}</span>
                            <button
                              type="button"
                              onClick={() => setPkgItems(p => p.filter((_, i) => i !== idx))}
                              className="w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                            >
                              <i className="fas fa-trash text-xs" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Dropdown to add more items from Inventory */}
                <div className="flex gap-2">
                  <select
                    className="form-input text-xs py-1.5 rounded-xl flex-1 bg-white border-slate-200"
                    value={newItemId}
                    onChange={e => {
                      const id = e.target.value
                      if (!id) return
                      const invItem = inventory.find(inv => String(inv.id) === String(id))
                      if (invItem) {
                        const existingIdx = pkgItems.findIndex(it => String(it.item_id) === String(invItem.id))
                        if (existingIdx >= 0) {
                          setPkgItems(p => p.map((it, i) => i === existingIdx ? { ...it, quantity: Number(it.quantity) + 1 } : it))
                        } else {
                          setPkgItems(p => [...p, { item_id: invItem.id, item_name: invItem.name, quantity: 1, unit: invItem.unit }])
                        }
                      }
                      setNewItemId('')
                    }}
                  >
                    <option value="">+ Add Item from Warehouse Stock...</option>
                    {inventory.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} [{inv.unit}] ({inv.quantity} in stock)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Audit Remarks / Notes <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Distributed during emergency Barangay assembly"
                  className="form-input text-xs py-1.5 rounded-xl w-full"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-gray btn-xs px-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="btn btn-primary btn-xs px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>Issuing Relief...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-check-circle" />
                  <span>Confirm &amp; Issue Relief Pack</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function AdminDistribution() {
  const location = useLocation()
  const {
    distributions,
    cycles,
    qrCodes,
    puroks,
    households,
    sectors,
    addSector,
  } = useAppStore()
  const { user } = useAuthStore()

  const [selectedType, setType] = useState('household')
  const [purokFilter, setPurok] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddSector, setShowAddSector] = useState(false)
  const [completedReceipt, setCompletedReceipt] = useState(null)
  const [prefillHhId, setPrefillHhId] = useState(null)
  const [sectorForm, setSectorForm] = useState({ name: '', code: '', color: '#1a56db', icon: 'fa-tag' })

  // Handle prefill if routed with state
  useEffect(() => {
    if (location.state?.prefillHhCode) {
      setPrefillHhId(location.state.prefillHhCode)
      setShowAdd(true)
    }
  }, [location.state])

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

  const receivedHouseholdIds = useMemo(() => {
    if (!activeCycle) return new Set()
    return new Set(distributions
      .filter(d => d.cycle_id === activeCycle.id)
      .map(d => d.household_id))
  }, [activeCycle, distributions])

  const availableMonths = useMemo(() => {
    return Array.from(new Set(
      distributions
        .filter(d => !selectedType || d.cycle_type === selectedType)
        .map(d => d.dist_date?.substring(0, 7))
        .filter(Boolean)
    )).sort().reverse()
  }, [distributions, selectedType])

  const records = useMemo(() => {
    return distributions.filter(d => {
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
  }, [distributions, selectedType, purokFilter, monthFilter, searchQuery])

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
      {/* Top Header */}
      <div className="section-header mb-5">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy">Relief Distribution</h1>
          <div className="section-sub">
            Desk distribution, beneficiary fulfillment, and running relief logs.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowAddSector(true)} className="btn btn-outline btn-sm cursor-pointer">
            <i className="fas fa-plus" /> <span className="hidden sm:inline">Add Sector</span>
          </button>
          <button
            onClick={() => {
              setPrefillHhId(null)
              setShowAdd(true)
            }}
            className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <i className="fas fa-hand-holding-heart" /> Add Distribution
          </button>
        </div>
      </div>

      {/* Sector Category Pills */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
        {SECTOR_BTNS.map(s => {
          const isActive = selectedType === s.key
          return (
            <div
              key={s.key}
              onClick={() => { setType(s.key); setPurok('') }}
              className={`cat-card ${isActive ? 'active' : ''}`}
              style={isActive ? { borderColor: s.color, background: `${s.color}12` } : {}}
            >
              <i
                className={`fas ${s.icon} text-2xl mb-1.5`}
                style={{ color: isActive ? s.color : '#94a3b8' }}
              />
              <div className="font-display font-bold text-xs text-navy text-center leading-tight">
                {s.label}
              </div>
            </div>
          )
        })}
      </div>

      {selectedType && (
        <div className="card p-3 mb-4 space-y-3">
          {/* Header Row: Active Cycle Info + Record Count + Month History Filter */}
          <div className="space-y-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs font-bold text-navy bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-flex items-center gap-1.5 truncate">
                  <i className="fas fa-boxes-packing text-blue-600 text-xs" />
                  Active Cycle: <strong className="text-navy">{activeCycle ? activeCycle.name : 'None'}</strong>
                  {activeCycle && (
                    <span className="text-slate-500 font-normal ml-1">
                      · {receivedHouseholdIds.size} claimed
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  {records.length} {records.length === 1 ? 'record' : 'records'} found
                </span>
              </div>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="btn btn-gray btn-xs py-1 px-2.5 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                title="Export Distribution Logs to CSV"
              >
                <i className="fas fa-file-csv text-emerald-600 text-xs" />
                <span className="text-xs">Export CSV</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {/* Month History Filter */}
              <div className="relative">
                <select
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                  className="form-input text-xs py-1.5 px-2.5 bg-white font-medium border-slate-200 rounded-lg text-slate-700 cursor-pointer w-full"
                >
                  <option value="">
                    📅 All Month History {availableMonths.length === 0 ? '(0 logs)' : `(${distributions.length} logs)`}
                  </option>
                  {availableMonths.map(m => {
                    const [year, month] = m.split('-')
                    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1)
                    const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    const count = distributions.filter(d => (!selectedType || d.cycle_type === selectedType) && d.dist_date?.startsWith(m)).length
                    return <option key={m} value={m}>{label} ({count} logs)</option>
                  })}
                </select>
              </div>

              {/* Search Record input */}
              <div className="relative">
                <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search record by code, name, HH code, or item..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input text-xs py-1.5 pl-7 pr-2.5 w-full border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Purok Filter Tabs */}
          <div className="space-y-1.5 pt-0.5">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <i className="fas fa-filter text-slate-400 text-[10px]" /> Purok Filter:
            </div>
            <div className="tab-scroll w-full py-0.5">
              <div className={`purok-tab ${!purokFilter ? 'active' : ''}`} onClick={() => setPurok('')}>All</div>
              {puroks.filter(p => !p.is_archived).map(p => (
                <div
                  key={p.id}
                  className={`purok-tab ${purokFilter === String(p.id) ? 'active' : ''}`}
                  onClick={() => setPurok(String(p.id))}
                >
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Distribution Records Table */}
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
                      {r.type === 'special_assistance' ? 'Special' : 'Standard'}
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
          <div className="text-xs mt-1">Click "Add Distribution" to issue and record relief goods.</div>
        </div>
      ) : null}

      {!selectedType && (
        <div className="card p-10 text-center text-slate-400">
          <i className="fas fa-truck text-5xl mb-3 block text-slate-200" />
          <div className="text-sm font-semibold">Select a distribution sector</div>
          <div className="text-xs mt-1">Choose Household, PWD, Senior, OSY, Solo Parent, or Teenage Mom</div>
        </div>
      )}

      {/* NEW: Desk Distribution Terminal Modal */}
      <DeskDistributionModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        initialPrefillHhId={prefillHhId}
        selectedSectorType={selectedType}
        onSuccess={(receipt) => {
          setShowAdd(false)
          setCompletedReceipt(receipt)
        }}
      />

      {/* NEW: Official Printable Distribution Slip Modal */}
      {completedReceipt && (
        <DistributionSlipModal
          receipt={completedReceipt}
          onClose={() => setCompletedReceipt(null)}
          onDistributeNext={() => {
            setCompletedReceipt(null)
            setPrefillHhId(null)
            setShowAdd(true)
          }}
        />
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
                Create a custom sector if the default ones (PWD, Senior, OSY, Solo Parent, Teenage Mom) don't fit your needs.
              </div>
              <div className="form-group">
                <label className="form-label">Sector Name *</label>
                <input
                  className="form-input"
                  value={sectorForm.name}
                  onChange={e => setSectorForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Indigenous People, Single Father"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Code (optional, auto-generated if blank)</label>
                <input
                  className="form-input"
                  value={sectorForm.code}
                  onChange={e => setSectorForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="e.g. indigenous_people"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSectorForm(f => ({ ...f, color: c }))}
                      className="w-9 h-9 rounded-xl border-2 transition-all cursor-pointer"
                      style={{
                        background: c,
                        borderColor: sectorForm.color === c ? '#0a1f47' : 'transparent',
                        transform: sectorForm.color === c ? 'scale(1.1)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Icon (Font Awesome class)</label>
                <input
                  className="form-input"
                  value={sectorForm.icon}
                  onChange={e => setSectorForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="fa-tag"
                />
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
