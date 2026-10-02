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
  const [showPrintPreview, setShowPrintPreview] = useState(false)
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
      <div className="flex items-center justify-between mb-3 no-print gap-2">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-bold border border-red-200 max-w-full">
            <i className="fas fa-lock text-[10px] flex-shrink-0" />
            <span className="font-bold flex-shrink-0">CONFIDENTIAL</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={handleExportCSV} className="btn btn-gray btn-sm py-1.5 px-2.5 cursor-pointer flex items-center gap-1" title="Export Current Cycle Summary to CSV">
            <i className="fas fa-file-csv text-emerald-600 text-sm" />
            <span className="text-xs">Export CSV</span>
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            disabled={!currentCycle}
            className="btn btn-outline btn-sm py-1.5 px-2.5 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            title="Preview and print official distribution summary report"
          >
            <i className="fas fa-print text-sm" />
            <span className="hidden sm:inline text-xs">Print</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Controls */}
      <div className="card p-3 sm:p-3.5 mb-4 no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200">
        <div className="text-xs font-bold text-navy flex items-center gap-1.5">
          <i className="fas fa-calendar-alt text-blue-600" /> Filter Date Range
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

      {/* Print Preview Modal */}
      {showPrintPreview && currentCycle && (
        <ReportsPrintPreviewModal
          cycle={currentCycle}
          purokData={purokData}
          sectorData={sectorData}
          onClose={() => setShowPrintPreview(false)}
        />
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

/**
 * Printable Distribution Summary & Monitoring Report Modal
 */
function ReportsPrintPreviewModal({ cycle, purokData, sectorData, onClose }) {
  if (!cycle) return null

  const handlePrint = () => {
    window.print()
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  // Executive KPI summary calculations
  const totalAllocated = purokData.reduce((acc, p) => acc + p.total, 0)
  const totalClaimed = purokData.reduce((acc, p) => acc + p.claimed, 0)
  const totalUnclaimed = purokData.reduce((acc, p) => acc + p.unclaimed, 0)
  const pctClaimed = totalAllocated > 0 ? Math.round((totalClaimed / totalAllocated) * 100) : 0

  return (
    <div
      className="modal-overlay print-slip fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card modal-box p-6 sm:p-8 w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto border border-slate-200 relative print:border-none print:shadow-none print:p-0 print:max-w-full print:rounded-none"
      >
        {/* Close Button top-right */}
        <button
          type="button"
          onClick={onClose}
          className="no-print absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
          title="Close Preview"
        >
          <i className="fas fa-times text-sm" />
        </button>

        {/* Printable Document Section */}
        <div id="report-summary-printable" className="space-y-4 text-slate-800">
          {/* Header */}
          <div className="text-center border-b pb-4 border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Republic of the Philippines · City of Cagayan de Oro
            </div>
            <div className="text-lg font-black text-navy uppercase tracking-tight mt-0.5">
              Barangay Puerto Disaster Risk Reduction &amp; Relief Operations
            </div>
            <div className="inline-block mt-2 px-3.5 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-blue-800 font-bold text-xs uppercase tracking-wide">
              Official Distribution Summary &amp; Monitoring Report
            </div>
          </div>

          {/* Reference Meta Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2.5 border-b border-slate-200">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Date Generated</div>
                <div className="font-bold text-slate-800 text-xs mt-0.5">{currentDate}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Sector Classification</div>
                <div className="font-bold text-blue-700 uppercase text-xs mt-0.5">
                  {cycle.type || 'General Sector'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Cycle Status</div>
                <div className={`font-bold text-xs mt-0.5 ${cycle.is_active ? 'text-emerald-700 font-extrabold' : 'text-slate-600'}`}>
                  {cycle.is_active ? 'ACTIVE OPERATION' : 'CONCLUDED / ARCHIVED'}
                </div>
              </div>
            </div>

            {/* Event Name */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Disaster Event / Relief Cycle</div>
              <div className="font-bold text-navy text-sm mt-0.5 leading-snug break-words">
                {cycle.name}
              </div>
            </div>
          </div>

          {/* Executive KPI Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Allocated QRs</div>
              <div className="text-lg font-black text-navy font-mono mt-0.5">{totalAllocated}</div>
              <div className="text-[9px] text-slate-400">Total Eligible</div>
            </div>
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Total Claimed</div>
              <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">{totalClaimed}</div>
              <div className="text-[9px] text-emerald-600 font-semibold">{pctClaimed}% Complete</div>
            </div>
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Total Unclaimed</div>
              <div className="text-lg font-black text-amber-700 font-mono mt-0.5">{totalUnclaimed}</div>
              <div className="text-[9px] text-amber-600 font-semibold">{100 - pctClaimed}% Pending</div>
            </div>
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-blue-800 tracking-wider">Completion Rate</div>
              <div className="text-lg font-black text-blue-700 font-mono mt-0.5">{pctClaimed}%</div>
              <div className="text-[9px] text-blue-600 font-semibold">Distribution Pace</div>
            </div>
          </div>

          {/* Purok Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 flex items-center justify-between">
              <span>Purok Distribution Breakdown</span>
              <span className="text-slate-500 font-semibold text-[10px] normal-case">
                {purokData.length} {purokData.length === 1 ? 'purok' : 'puroks'} reporting
              </span>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5 w-10">#</th>
                  <th className="py-2.5 px-3.5">Purok Name</th>
                  <th className="py-2.5 px-3.5 text-right w-24">Allocated</th>
                  <th className="py-2.5 px-3.5 text-right w-24">Claimed</th>
                  <th className="py-2.5 px-3.5 text-right w-24">Unclaimed</th>
                  <th className="py-2.5 px-3.5 text-right w-28">Rate (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purokData.length > 0 ? (
                  purokData.map((p, idx) => {
                    const rate = p.total > 0 ? Math.round((p.claimed / p.total) * 100) : 0
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3.5 font-bold text-navy">{p.label}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">{p.total}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700">{p.claimed}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-amber-700">{p.unclaimed}</td>
                        <td className="py-2.5 px-3.5 text-right">
                          <span className="inline-block px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-4 px-3.5 text-center text-slate-500 italic">
                      No purok distribution records found for this cycle.
                    </td>
                  </tr>
                )}
              </tbody>
              {purokData.length > 0 && (
                <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-800">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3.5 text-right uppercase text-[10px] tracking-wider">
                      Overall Total:
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-black text-navy">{totalAllocated}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-black text-emerald-700">{totalClaimed}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-black text-amber-700">{totalUnclaimed}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-black text-blue-700">{pctClaimed}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Sector Breakdown Table (if available) */}
          {sectorData.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 flex items-center justify-between">
                <span>Sector Distribution Breakdown</span>
                <span className="text-slate-500 font-semibold text-[10px] normal-case">
                  {sectorData.length} {sectorData.length === 1 ? 'sector' : 'sectors'}
                </span>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3.5 w-10">#</th>
                    <th className="py-2 px-3.5">Sector Classification</th>
                    <th className="py-2 px-3.5 text-right w-24">Allocated</th>
                    <th className="py-2 px-3.5 text-right w-24">Claimed</th>
                    <th className="py-2 px-3.5 text-right w-24">Unclaimed</th>
                    <th className="py-2 px-3.5 text-right w-28">Rate (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sectorData.map((s, idx) => {
                    const rate = s.total > 0 ? Math.round((s.claimed / s.total) * 100) : 0
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3.5 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3.5 font-bold text-navy">{s.label}</td>
                        <td className="py-2 px-3.5 text-right font-mono text-slate-700">{s.total}</td>
                        <td className="py-2 px-3.5 text-right font-mono font-bold text-emerald-700">{s.claimed}</td>
                        <td className="py-2 px-3.5 text-right font-mono font-bold text-amber-700">{s.unclaimed}</td>
                        <td className="py-2 px-3.5 text-right">
                          <span className="inline-block px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Signature Sign-offs */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 pb-1 h-8" />
              <div className="font-bold text-navy mt-1.5">Prepared By</div>
              <div className="text-[10px] text-slate-500">Relief Operations &amp; Monitoring Officer</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-1 h-8" />
              <div className="font-bold text-navy mt-1.5">Attested &amp; Certified By</div>
              <div className="text-[10px] text-slate-500">Punong Barangay / CDRRMO Representative</div>
            </div>
          </div>
        </div>

        {/* Modal Actions (Hidden in Print) */}
        <div className="no-print mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <i className="fas fa-chart-pie text-blue-500" />
            <span>Official DRRMO Relief Operations Summary Record</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-outline btn-sm px-3.5 flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer font-semibold shadow-2xs"
            >
              <i className="fas fa-print" /> Print Report
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-gray btn-sm px-3.5 cursor-pointer font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
