import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { exportToCsv } from '../../utils/csvExport'

export default function BeneficiaryHistory() {
  const { user } = useAuthStore()
  const { households, distributions } = useAppStore()
  const hh = households.find(h => h.account_id === user?.id)

  const records = distributions
    .filter(d => d.household_id === hh?.id)
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))

  const handleExportCSV = () => {
    const headers = [
      { label: 'Distribution Code', key: 'dist_code' },
      { label: 'Cycle / Event Name', key: 'cycle_name' },
      { label: 'Date Received', key: 'dist_date' },
      { label: 'Distribution Type', key: 'type' },
      { label: 'Relief Goods Received', key: 'items_summary' },
      { label: 'Special Reason / Remarks', key: 'remarks' },
    ]
    const rows = records.map(r => ({
      dist_code: r.dist_code,
      cycle_name: r.cycle_name,
      dist_date: r.dist_date,
      type: r.type === 'special_assistance' ? 'Special Assistance' : 'Standard Distribution',
      items_summary: (r.items || []).map(i => `${i.item_name} (${i.quantity} ${i.unit})`).join('; '),
      remarks: r.special_reason || '—',
    }))
    exportToCsv(`My_Relief_History_${hh?.hh_code || 'HH'}`, headers, rows)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="font-display font-bold text-base text-navy">
          <i className="fas fa-clock-rotate-left mr-2 text-blue-500" />My Distribution History
        </div>
        <button onClick={handleExportCSV} className="btn btn-gray btn-xs cursor-pointer" title="Download my assistance history as CSV">
          <i className="fas fa-file-csv text-emerald-600 text-sm" /> <span>Export My History (CSV)</span>
        </button>
      </div>

      {records.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <i className="fas fa-box-open text-4xl mb-3 block text-slate-200" />
          <div className="text-sm font-semibold">No history yet</div>
          <div className="text-xs mt-1">Your received relief will appear here.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r, i) => (
            <motion.div key={r.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03, duration: 0.15 }} className="card p-4 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm text-navy">{r.cycle_name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <i className="fas fa-calendar mr-1" />{r.dist_date}
                  </div>
                </div>
                <span className={`badge flex-shrink-0 ${r.type === 'special_assistance' ? 'badge-pending' : 'badge-approved'}`}>
                  {r.type === 'special_assistance' ? 'Special' : 'Standard'}
                </span>
              </div>
              {r.items?.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Items Received</div>
                  {r.items.map((item, j) => (
                    <div key={j} className="flex items-center justify-between text-sm">
                      <span className="text-navy">{item.item_name}</span>
                      <span className="text-slate-500 font-semibold text-xs">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {r.special_reason && (
                <div className="mt-3 p-2.5 bg-amber-50 rounded-xl text-xs text-amber-800">
                  <strong>Reason:</strong> {r.special_reason}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
