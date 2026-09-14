import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { fuzzyMatch } from '../../utils/fuzzySearch'

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

export default function BeneficiaryCommunity() {
  const { distributions, puroks, cycles, qrCodes, households, sectors } = useAppStore()
  const [selectedCycleId, setSelectedCycleId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'received' | 'pending'
  const [purokFilter, setPurokFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Determine active cycle or fall back to most recent cycle
  const activeCycle = cycles.find(c => c.is_active) || cycles[0]
  const currentCycle = cycles.find(c => String(c.id) === String(selectedCycleId)) || activeCycle

  // Build the complete list of target beneficiaries for this cycle with their receipt status
  const allEligibleBeneficiaries = useMemo(() => {
    if (!currentCycle) return []

    // 1. Check if cycle has specific QR codes generated
    const cycleQRs = qrCodes.filter(q => String(q.cycle_id) === String(currentCycle.id))
    const cycleDists = distributions.filter(d => String(d.cycle_id) === String(currentCycle.id))

    // Set of household IDs or HH codes that have claimed/received in this cycle
    const claimedHhIds = new Set()
    const claimedHhCodes = new Set()
    const distMap = new Map()

    cycleDists.forEach(d => {
      if (d.household_id) claimedHhIds.add(d.household_id)
      if (d.hh_code) claimedHhCodes.add(d.hh_code)
      distMap.set(d.household_id || d.hh_code, d)
    })

    cycleQRs.forEach(q => {
      if (q.is_claimed) {
        if (q.household_id) claimedHhIds.add(q.household_id)
      }
    })

    // If QRs exist for this cycle, map from QRs
    if (cycleQRs.length > 0) {
      return cycleQRs.map(q => {
        const hh = households.find(h => h.id === q.household_id)
        const head = hh?.members?.find(m => m.is_head)
        const member = q.member_id ? hh?.members?.find(m => m.id === q.member_id) : head
        const dist = distMap.get(q.household_id) || distMap.get(hh?.hh_code)
        const isReceived = q.is_claimed || !!dist

        return {
          id: q.id,
          household_id: q.household_id,
          hh_code: hh?.hh_code || 'HH-000',
          head_name: head ? `${head.fname} ${head.lname}` : (member ? `${member.fname} ${member.lname}` : 'Household Head'),
          member_name: member && member.id !== head?.id ? `${member.fname} ${member.lname}` : null,
          purok_id: hh?.purok_id,
          purok_name: hh?.purok_name || 'Barangay Puerto',
          address: hh?.house_no_street || 'Puerto, CDO',
          sectors: member?.sectors || head?.sectors || [],
          is_received: isReceived,
          dist_date: dist?.dist_date || q.claimed_at,
          items: dist?.items || (typeof currentCycle.items === 'string' ? JSON.parse(currentCycle.items || '[]') : currentCycle.items || []),
          dist_code: dist?.dist_code,
        }
      })
    }

    // Otherwise, map from households (check if target puroks specified)
    let targetPurokIds = []
    try {
      if (typeof currentCycle.target_purok_ids === 'string') {
        targetPurokIds = JSON.parse(currentCycle.target_purok_ids)
      } else if (Array.isArray(currentCycle.target_purok_ids)) {
        targetPurokIds = currentCycle.target_purok_ids
      }
    } catch {
      targetPurokIds = []
    }

    const eligibleHouseholds = households.filter(hh => {
      if (hh.status && hh.status !== 'approved') return false
      if (targetPurokIds.length > 0 && !targetPurokIds.includes(hh.purok_id)) return false
      return true
    })

    return eligibleHouseholds.map(hh => {
      const head = hh.members?.find(m => m.is_head)
      const dist = distMap.get(hh.id) || distMap.get(hh.hh_code)
      const isReceived = claimedHhIds.has(hh.id) || claimedHhCodes.has(hh.hh_code) || !!dist

      return {
        id: hh.id,
        household_id: hh.id,
        hh_code: hh.hh_code,
        head_name: head ? `${head.fname} ${head.lname}` : 'Household Head',
        member_name: null,
        purok_id: hh.purok_id,
        purok_name: hh.purok_name || 'Barangay Puerto',
        address: hh.house_no_street || 'Puerto, CDO',
        sectors: head?.sectors || [],
        is_received: isReceived,
        dist_date: dist?.dist_date,
        items: dist?.items || (typeof currentCycle.items === 'string' ? JSON.parse(currentCycle.items || '[]') : currentCycle.items || []),
        dist_code: dist?.dist_code,
      }
    })
  }, [currentCycle, qrCodes, distributions, households])

  // Aggregate Stats
  const totalCount = allEligibleBeneficiaries.length
  const receivedCount = allEligibleBeneficiaries.filter(b => b.is_received).length
  const pendingCount = totalCount - receivedCount
  const percentClaimed = totalCount > 0 ? Math.round((receivedCount / totalCount) * 100) : 0

  // Filtered List
  const filteredBeneficiaries = useMemo(() => {
    return allEligibleBeneficiaries.filter(b => {
      // 1. Status Filter
      if (statusFilter === 'received' && !b.is_received) return false
      if (statusFilter === 'pending' && b.is_received) return false

      // 2. Purok Filter
      if (purokFilter && String(b.purok_id) !== purokFilter) return false

      // 3. Search Query
      if (searchQuery.trim()) {
        const targetFields = [b.head_name, b.member_name, b.hh_code, b.purok_name, b.address]
        if (!fuzzyMatch(targetFields, searchQuery)) return false
      }

      return true
    })
  }, [allEligibleBeneficiaries, statusFilter, purokFilter, searchQuery])

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-lg sm:text-xl text-navy flex items-center gap-2">
            <i className="fas fa-bullhorn text-blue-600 text-base sm:text-lg" />
            Community Transparency Board
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time public record of relief goods distribution for the community.
          </p>
        </div>

        {/* Cycle Selector Dropdown */}
        {cycles.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl shadow-xs">
            <i className="fas fa-arrows-rotate text-blue-600 text-xs" />
            <select
              value={currentCycle?.id}
              onChange={e => setSelectedCycleId(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-blue-900 focus:ring-0 cursor-pointer pr-3"
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!currentCycle ? (
        <div className="card p-10 text-center text-slate-400">
          <i className="fas fa-box-open text-4xl mb-3 block text-slate-300" />
          <div className="text-sm font-semibold">No relief cycles recorded</div>
          <div className="text-xs mt-1">Check back once a distribution cycle is initiated.</div>
        </div>
      ) : (
        <>
          {/* Transparency Summary Statistics Cards */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="card p-3 sm:p-3.5 bg-white border border-slate-100 shadow-xs flex flex-col justify-between">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Target</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display font-black text-xl sm:text-2xl text-navy">{totalCount}</span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium">beneficiaries</span>
              </div>
            </div>

            <div className="card p-3 sm:p-3.5 bg-emerald-50/70 border border-emerald-100 shadow-xs flex flex-col justify-between">
              <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center justify-between">
                <span>Received</span>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">{percentClaimed}%</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display font-black text-xl sm:text-2xl text-emerald-700">{receivedCount}</span>
                <span className="text-[10px] sm:text-xs text-emerald-600 font-medium">claimed</span>
              </div>
            </div>

            <div className="card p-3 sm:p-3.5 bg-amber-50/70 border border-amber-100 shadow-xs flex flex-col justify-between">
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Not Yet Received</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display font-black text-xl sm:text-2xl text-amber-700">{pendingCount}</span>
                <span className="text-[10px] sm:text-xs text-amber-600 font-medium">pending</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${percentClaimed}%` }}
            />
          </div>

          {/* Filter & Search Controls */}
          <div className="card p-3 sm:p-4 space-y-3">
            {/* Status Tabs */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Filter by Distribution Status</div>
              <div className="tab-scroll">
                {[
                  { key: 'all', label: `All (${totalCount})`, icon: 'fa-list' },
                  { key: 'received', label: `✅ Received (${receivedCount})`, icon: 'fa-circle-check' },
                  { key: 'pending', label: `⏳ Not Yet Received (${pendingCount})`, icon: 'fa-clock' },
                ].map(tab => (
                  <div
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`purok-tab flex items-center gap-1.5 cursor-pointer ${statusFilter === tab.key ? 'active' : ''}`}
                  >
                    <span>{tab.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Purok Filter Tabs */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Filter by Purok</div>
              <div className="tab-scroll">
                <div
                  className={`purok-tab cursor-pointer ${!purokFilter ? 'active' : ''}`}
                  onClick={() => setPurokFilter('')}
                >
                  All
                </div>
                {(puroks || []).filter(p => !p.is_archived).map(p => (
                  <div
                    key={p.id}
                    className={`purok-tab cursor-pointer ${purokFilter === String(p.id) ? 'active' : ''}`}
                    onClick={() => setPurokFilter(String(p.id))}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative pt-1 border-t border-slate-100">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs mt-0.5" />
              <input
                type="text"
                placeholder="Search by resident name, household head, or HH code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input text-xs pl-8 pr-3 py-2 w-full rounded-xl bg-white border-slate-200"
              />
            </div>
          </div>

          {/* Beneficiaries Transparency List */}
          <div className="space-y-2.5">
            {filteredBeneficiaries.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">
                <i className="fas fa-users-slash text-3xl mb-2 block text-slate-300" />
                <div className="text-sm font-semibold">No beneficiaries match this filter</div>
                <div className="text-xs mt-1">Try switching status tabs or selecting another Purok.</div>
              </div>
            ) : (
              filteredBeneficiaries.map((b, idx) => (
                <motion.div
                  key={b.id || idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="card p-3.5 sm:p-4 bg-white hover:shadow-md transition-all border border-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Beneficiary Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-xs ${
                          b.is_received
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        <i className={`fas ${b.is_received ? 'fa-check' : 'fa-hourglass-half'}`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-sm text-navy">{b.head_name}</span>
                          <span className="font-mono text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {b.hh_code}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-slate-700">{b.purok_name}</span>
                          {b.address && <span>· {b.address}</span>}
                        </div>

                        {/* Sectors badges */}
                        {normalizeSectors(b.sectors).length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {normalizeSectors(b.sectors).map(secCode => {
                              const sObj = sectors.find(s => s.code === secCode)
                              return (
                                <span
                                  key={secCode}
                                  className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md"
                                >
                                  {sObj?.name || secCode}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Pill & Receipt Info */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      {b.is_received ? (
                        <div className="text-right">
                          <span className="badge badge-approved text-xs px-2.5 py-1">
                            <i className="fas fa-circle-check mr-1" />
                            Received
                          </span>
                          {b.dist_date && (
                            <div className="text-[11px] text-slate-400 mt-1 font-medium">
                              {b.dist_date}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="badge badge-pending text-xs px-2.5 py-1">
                            <i className="fas fa-clock mr-1" />
                            Not Yet Received
                          </span>
                          <div className="text-[10px] text-amber-600 mt-1 font-semibold">
                            Pending pickup / release
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items received summary preview if available */}
                  {b.is_received && b.items && b.items.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-1">
                      <span className="font-semibold text-slate-600 text-[11px] flex items-center gap-1">
                        <i className="fas fa-box text-blue-500" /> Package:
                      </span>
                      <span className="text-[11px] text-slate-600 truncate max-w-full">
                        {Array.isArray(b.items)
                          ? b.items.map(it => `${it.item_name || it.name} (${it.quantity || it.qty || 1} ${it.unit || ''})`).join(', ')
                          : 'Standard Relief Goods'}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
