import { useState } from 'react'
import { useAppStore } from '../../store/appStore'

export default function BeneficiaryCommunity() {
  const { distributions, puroks, cycles, households } = useAppStore()
  const [purokFilter, setPurok] = useState('')
  const activeCycle = cycles.find(c => c.is_active)

  const records = distributions
    .filter(d => activeCycle && d.cycle_id === activeCycle.id)
    .filter(d => {
      if (!purokFilter) return true
      return String(d.purok_id) === purokFilter
    })
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))

  return (
    <div>
      <div className="font-display font-bold text-base text-navy mb-1">
        <i className="fas fa-eye mr-2 text-blue-500" />Community Board
      </div>
      <div className="text-xs text-slate-400 mb-4">Transparency report — who received in the current cycle</div>

      {!activeCycle ? (
        <div className="card p-10 text-center text-slate-400">
          <i className="fas fa-rotate text-4xl mb-3 block text-slate-200" />
          <div className="text-sm font-semibold">No active cycle</div>
          <div className="text-xs mt-1">Check back when a cycle is active.</div>
        </div>
      ) : (
        <>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 font-semibold mb-4">
            <i className="fas fa-rotate mr-2" />{activeCycle.name}
          </div>

          <div className="tab-scroll mb-4">
            <div className={`purok-tab cursor-pointer hover:bg-slate-200 transition-colors ${!purokFilter ? 'active' : ''}`} onClick={() => setPurok('')}>All</div>
            {puroks.map(p => (
              <div key={p.id} className={`purok-tab cursor-pointer hover:bg-slate-200 transition-colors ${purokFilter === String(p.id) ? 'active' : ''}`}
                onClick={() => setPurok(String(p.id))}>{p.name}</div>
            ))}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 mb-4">
            <i className="fas fa-lock mr-1" />For privacy, only household codes are shown — not individual names.
          </div>

          <div className="space-y-2">
            {records.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">
                <i className="fas fa-inbox text-3xl mb-2 block text-slate-200" />
                <div className="text-sm">No distributions recorded yet</div>
              </div>
            ) : records.map((d, i) => (
              <div key={i} className="card p-3 flex items-center justify-between gap-3 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-check text-emerald-600 text-xs" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-navy">{d.hh_code}</div>
                    <div className="text-[11px] text-slate-400">{d.purok_name} · {d.dist_date}</div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 text-right flex-shrink-0 max-w-[120px] truncate">
                  {d.items?.slice(0, 2).map(i => i.item_name).join(', ')}
                  {d.items?.length > 2 && '...'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
