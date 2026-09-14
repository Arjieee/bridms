import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pie } from 'react-chartjs-2'
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js'
import { useAppStore } from '../../store/appStore'
import { exportToCsv } from '../../utils/csvExport'

Chart.register(ArcElement, Tooltip, Legend)

function NameList({ title, names, color, emptyText }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-[10px] font-bold uppercase mb-2" style={{ color }}>{title} ({names.length})</div>
      {names.length === 0 ? (
        <div className="text-[11px] text-slate-400 italic">{emptyText}</div>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {names.map((n, i) => (
            <div key={i} className="text-xs font-medium text-navy flex items-center gap-1.5">
              <i className="fas fa-circle text-[5px]" style={{ color }} />
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PieCard({ label, claimed, unclaimed, total, claimedNames, unclaimedNames }) {
  const pct = total > 0 ? Math.round((claimed / total) * 100) : 0
  const [showLists, setShowLists] = useState(false)

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <div className="font-display font-bold text-sm text-navy mb-3 truncate">{label}</div>
      <div className="flex items-center gap-4 mb-3">
        <div style={{ width: 100, height: 100, flexShrink: 0 }}>
          <Pie
            data={{
              labels: ['Claimed', 'Unclaimed'],
              datasets: [{
                data: [claimed, unclaimed],
                backgroundColor: ['#10b981', '#e2e8f0'],
                borderColor: ['#059669', '#cbd5e1'],
                borderWidth: 2,
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
            }}
          />
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-emerald-500 flex-shrink-0" />
            <span className="text-slate-600">Claimed</span>
            <span className="ml-auto font-bold text-emerald-600">{claimed} ({pct}%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-slate-200 flex-shrink-0" />
            <span className="text-slate-600">Unclaimed</span>
            <span className="ml-auto font-bold text-slate-400">{unclaimed}</span>
          </div>
          <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-1">Total: {total}</div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <button onClick={() => setShowLists(s => !s)}
        className="w-full py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1">
        <i className={`fas fa-chevron-${showLists ? 'up' : 'down'} text-[9px]`} />
        {showLists ? 'Hide' : 'Show'} Beneficiary Names
      </button>

      <AnimatePresence>
        {showLists && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <NameList title="Claimed"   names={claimedNames}   color="#059669" emptyText="No claims yet." />
              <NameList title="Unclaimed" names={unclaimedNames} color="#94a3b8" emptyText="All claimed!" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AdminReports() {
  const { cycles, qrCodes, households, puroks, sectors, distributions } = useAppStore()
  const [cycleIdx, setCycleIdx] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Build list of cycles (filtered by date range if specified)
  const sortedCycles = useMemo(() => {
    let list = cycles
    if (startDate) {
      list = list.filter(c => c.created_at >= startDate)
    }
    if (endDate) {
      list = list.filter(c => c.created_at <= endDate + 'T23:59:59')
    }
    const active = list.filter(c => c.is_active).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const inactive = list.filter(c => !c.is_active).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return [...active, ...inactive]
  }, [cycles, startDate, endDate])

  const currentCycle = sortedCycles[cycleIdx] || null
  const cycleQRs = qrCodes.filter(q => q.cycle_id === currentCycle?.id)

  const purokData = puroks.map(p => {
    const hhsInPurok = households.filter(h => h.purok_id === p.id)
    const qrs = cycleQRs.filter(q => hhsInPurok.some(h => h.id === q.household_id))
    const claimedQRs = qrs.filter(q => q.is_claimed)
    const unclaimedQRs = qrs.filter(q => !q.is_claimed)
    return {
      label: p.name,
      total: qrs.length,
      claimed: claimedQRs.length,
      unclaimed: unclaimedQRs.length,
      claimedNames:   claimedQRs.map(qr => nameForQR(qr, households)).filter(Boolean),
      unclaimedNames: unclaimedQRs.map(qr => nameForQR(qr, households)).filter(Boolean),
    }
  }).filter(d => d.total > 0)

  const sectorData = sectors.map(s => {
    const qrs = cycleQRs.filter(q => q.cycle_type === s.code && q.type === 'member')
    const claimedQRs = qrs.filter(q => q.is_claimed)
    const unclaimedQRs = qrs.filter(q => !q.is_claimed)
    return {
      label: s.name,
      total: qrs.length,
      claimed: claimedQRs.length,
      unclaimed: unclaimedQRs.length,
      claimedNames:   claimedQRs.map(qr => nameForQR(qr, households)).filter(Boolean),
      unclaimedNames: unclaimedQRs.map(qr => nameForQR(qr, households)).filter(Boolean),
    }
  }).filter(d => d.total > 0)

  const handlePrev = () => setCycleIdx(i => Math.max(0, i - 1))
  const handleNext = () => setCycleIdx(i => Math.min(sortedCycles.length - 1, i + 1))

  const handleExportCSV = () => {
    if (!currentCycle) {
      exportToCsv('Reports', [], [])
      return
    }
    const headers = [
      { label: 'Category / Group', key: 'group_type' },
      { label: 'Group Name', key: 'label' },
      { label: 'Total Allocated QRs', key: 'total' },
      { label: 'Claimed QRs', key: 'claimed' },
      { label: 'Unclaimed QRs', key: 'unclaimed' },
      { label: 'Claim Rate (%)', key: 'pct' },
      { label: 'Claimed Beneficiary Names', key: 'claimedNames' },
      { label: 'Unclaimed Beneficiary Names', key: 'unclaimedNames' },
    ]
    const rows = [
      ...purokData.map(p => ({
        group_type: 'Purok',
        label: p.label,
        total: p.total,
        claimed: p.claimed,
        unclaimed: p.unclaimed,
        pct: p.total > 0 ? `${Math.round((p.claimed / p.total) * 100)}%` : '0%',
        claimedNames: (p.claimedNames || []).join('; '),
        unclaimedNames: (p.unclaimedNames || []).join('; '),
      })),
      ...sectorData.map(s => ({
        group_type: 'Sector',
        label: s.label,
        total: s.total,
        claimed: s.claimed,
        unclaimed: s.unclaimed,
        pct: s.total > 0 ? `${Math.round((s.claimed / s.total) * 100)}%` : '0%',
        claimedNames: (s.claimedNames || []).join('; '),
        unclaimedNames: (s.unclaimedNames || []).join('; '),
      })),
    ]
    exportToCsv(`Reports_${currentCycle.name.replace(/[^a-zA-Z0-9]/g, '_')}`, headers, rows)
  }

  return (
    <div className="confidential">
      {/* Official Print Header Seal (Visible when printing) */}
      <div className="print-header hidden print:flex items-center gap-4 border-b-2 border-slate-900 pb-4 mb-6">
        <img src="/logo.png" alt="Barangay Puerto Seal" className="w-16 h-16 object-contain" />
        <div>
          <h1 className="font-display font-extrabold text-sm text-slate-800 uppercase tracking-wider">Republic of the Philippines · City of Cagayan de Oro</h1>
          <h2 className="font-display font-black text-xl text-slate-900">BARANGAY PUERTO RELIEF OPERATIONS</h2>
          <p className="text-xs text-slate-600">Official Distribution Summary & Inventory Monitoring Report</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 no-print gap-2">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-bold border border-red-200 max-w-full">
            <i className="fas fa-lock text-[10px] flex-shrink-0" />
            <span className="font-bold flex-shrink-0">CONFIDENTIAL</span>
            <span className="hidden sm:inline text-red-500 font-normal truncate">— For authorized personnel only</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={handleExportCSV} className="btn btn-gray btn-sm py-1.5 px-2.5 cursor-pointer flex items-center gap-1" title="Export Current Cycle Summary to CSV">
            <i className="fas fa-file-csv text-emerald-600 text-sm" />
            <span className="text-xs">Export CSV</span>
          </button>
          <button onClick={() => window.print()} className="btn btn-outline btn-sm py-1.5 px-2.5 flex items-center gap-1" title="Print Official Report">
            <i className="fas fa-print text-sm" />
            <span className="hidden sm:inline text-xs">Print</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Controls */}
      <div className="card p-3 sm:p-3.5 mb-4 no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200">
        <div className="text-xs font-bold text-navy flex items-center gap-1.5">
          <i className="fas fa-calendar-alt text-blue-600" /> Filter Cycle Date Range
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap text-xs">
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[130px]">
            <span className="text-[11px] text-slate-500 font-medium sm:hidden">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setCycleIdx(0) }}
              className="form-input !py-1.5 !px-2.5 text-xs w-full sm:!w-36 bg-white border-slate-200 rounded-lg min-w-[120px]"
            />
          </div>
          <span className="text-slate-400 font-medium hidden sm:inline">to</span>
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[130px]">
            <span className="text-[11px] text-slate-500 font-medium sm:hidden">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setCycleIdx(0) }}
              className="form-input !py-1.5 !px-2.5 text-xs w-full sm:!w-36 bg-white border-slate-200 rounded-lg min-w-[120px]"
            />
          </div>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate(''); setCycleIdx(0) }}
              className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex-shrink-0">
              Reset
            </button>
          )}
        </div>
      </div>

      {sortedCycles.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <i className="fas fa-rotate text-4xl mb-3 block text-slate-300" />
          <div className="text-sm font-semibold">No matching cycles found</div>
          <div className="text-xs mt-1">Try adjusting your date range filter or create a cycle in Settings.</div>
        </div>
      ) : (
        <>
          {/* CYCLE NAVIGATOR */}
          <div className="card p-3 mb-5 flex items-center gap-2">
            <button onClick={handlePrev} disabled={cycleIdx === 0}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 transition-colors">
              <i className="fas fa-chevron-left" />
            </button>
            <div className="flex-1 min-w-0 text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="font-display font-bold text-sm text-navy truncate">{currentCycle.name}</span>
                <span className={`badge ${currentCycle.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                  {currentCycle.is_active ? 'Active' : 'Ended'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Cycle {cycleIdx + 1} of {sortedCycles.length} · Created: {new Date(currentCycle.created_at).toLocaleDateString('en-PH')}
              </div>
            </div>
            <button onClick={handleNext} disabled={cycleIdx >= sortedCycles.length - 1}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 transition-colors">
              <i className="fas fa-chevron-right" />
            </button>
          </div>

          <div className="mb-6">
            <div className="font-display font-bold text-sm text-navy mb-3">
              <i className="fas fa-map-marker-alt text-blue-500 mr-2" />Distribution by Purok
            </div>
            {purokData.length === 0 ? (
              <div className="card p-6 text-center text-slate-400 text-sm">No distribution data for this cycle.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {purokData.map((d, i) => <PieCard key={i} {...d} />)}
              </div>
            )}
          </div>

          <div>
            <div className="font-display font-bold text-sm text-navy mb-3">
              <i className="fas fa-users text-blue-500 mr-2" />Distribution by Sector
            </div>
            {sectorData.length === 0 ? (
              <div className="card p-6 text-center text-slate-400 text-sm">No sector data for this cycle.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectorData.map((d, i) => <PieCard key={i} {...d} />)}
              </div>
            )}
          </div>

          <div className="mt-6 p-3 bg-slate-100 rounded-xl text-[11px] text-slate-400 text-center no-print">
            Beneficiary names shown only to authorized admins. Handle confidentially.
          </div>
        </>
      )}
    </div>
  )
}

// Helper to get beneficiary name from QR code
function nameForQR(qr, households) {
  const hh = households.find(h => h.id === qr.household_id)
  if (!hh) return null
  if (qr.type === 'household') {
    const head = hh.members?.find(m => m.is_head)
    return head ? `${head.fname} ${head.lname} (${hh.hh_code})` : hh.hh_code
  }
  const member = hh.members?.find(m => m.id === qr.member_id)
  return member ? `${member.fname} ${member.lname} (${hh.hh_code})` : hh.hh_code
}
