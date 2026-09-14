import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

export default function AdminQRVerification() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { scanQR, claimQR, cycles, puroks, qrCodes, households } = useAppStore()
  const [scanning, setScanning] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [result, setResult] = useState(null)
  const [manual, setManual] = useState('')
  const [purokFilter, setPurok] = useState('')
  const [claimFilter, setClaimFilter] = useState('all') // 'all' | 'unclaimed' | 'claimed'
  const [selectedCycleId, setSelectedCycleId] = useState(null)
  const html5Ref = useRef(null)
  const resultRef = useRef(null)

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [result])

  const activeCycles = (cycles || []).filter((c) => {
    if (!c.is_active) return false;
    const cQRs = (qrCodes || []).filter((q) => q.cycle_id === c.id);
    const totalQRs = cQRs.length;
    const claimedQRs = cQRs.filter((q) => q.is_claimed).length;
    const isCompleted = totalQRs > 0 && claimedQRs === totalQRs;
    return !isCompleted;
  });
  const activeCycle = activeCycles.find(c => String(c.id) === String(selectedCycleId)) || activeCycles[0]

  const eligibles = qrCodes
    .filter(q => String(q.cycle_id) === String(activeCycle?.id))
    .map(q => {
      const hh = households.find(h => h.id === q.household_id)
      const head = hh?.members?.find(m => m.is_head)
      const member = q.member_id ? hh?.members?.find(m => m.id === q.member_id) : head
      return {
        ...q,
        hh_code: hh?.hh_code,
        purok: hh?.purok_name,
        purok_id: hh?.purok_id,
        fname: member?.fname,
        lname: member?.lname,
      }
    })
    .filter(e => !purokFilter || String(e.purok_id) === purokFilter)

  const claimed = eligibles.filter(e => e.is_claimed).length
  const remaining = eligibles.length - claimed

  const filteredEligibles = eligibles.filter(e => {
    if (claimFilter === 'claimed') return e.is_claimed
    if (claimFilter === 'unclaimed') return !e.is_claimed
    return true
  })

  const stopScan = async () => {
    try {
      if (html5Ref.current) {
        await html5Ref.current.stop()
        await html5Ref.current.clear()
        html5Ref.current = null
      }
    } catch (e) { /* swallow */ }
    setScanning(false)
  }

  useEffect(() => () => { stopScan() }, [])

  const startScan = async () => {
    setResult(null)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      // Wait for DOM
      await new Promise(r => setTimeout(r, 100))
      html5Ref.current = new Html5Qrcode('qr-reader-v2')
      await html5Ref.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => { stopScan(); handleScan(decoded) },
        () => { /* ignore frame errors */ }
      )
    } catch (err) {
      toast.error('Camera not available. Try manual entry or check browser permissions.')
      setScanning(false)
    }
  }

  const handleScan = async (token) => {
    let raw = (token || '').trim()
    if (raw.startsWith('BPR-SECURED::')) {
      raw = raw.replace('BPR-SECURED::', '').trim()
    }
    const r = await scanQR(raw)
    setResult(r)
    if (r.status === 'eligible') toast.success('✅ QR Verified! Resident of Barangay Puerto.')
    else if (r.status === 'claimed') toast.error('Already claimed for this cycle.')
    else if (r.status === 'on_hold') toast.error('⚠️ Distribution ON HOLD: Member status change awaiting beneficiary confirmation.')
    else if (r.status === 'inactive_member') toast.error('❌ Member is marked INACTIVE and is not eligible.')
    else if (r.status === 'inactive') toast.error('This cycle is no longer active.')
    else if (r.status === 'insufficient_stock') toast.error('⚠️ Stock is insufficient for relief package.')
    else toast.error('QR code not registered in system.')
  }

  const handleClaim = async () => {
    if (!result?.qr?.id) return
    setClaiming(true)
    const res = await claimQR(result.qr.id)
    setClaiming(false)
    if (res.ok) {
      toast.success('🎉 Relief items distributed & claimed successfully!')
      setResult(prev => ({
        ...prev,
        status: 'claimed',
        message: `Claimed successfully for cycle: "${prev.cycle?.name || 'Active Cycle'}".`,
      }))
    } else {
      toast.error(res.message || 'Failed to complete distribution.')
    }
  }

  const handleManual = () => {
    if (!manual.trim()) return
    handleScan(manual.trim())
    setManual('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl text-navy">QR Code Scanner</h1>
          <p className="text-slate-500 text-xs mt-0.5">Scan beneficiary QR code to verify & distribute relief goods.</p>
        </div>

        {activeCycles.length > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl shadow-xs">
            <i className="fas fa-arrows-rotate text-emerald-600 text-xs" />
            <select
              value={activeCycle?.id}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-emerald-800 focus:ring-0 cursor-pointer pr-4"
            >
              {activeCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl">
            <i className="fas fa-pause text-slate-400 text-xs" />
            <span className="text-xs font-bold text-slate-500">No Active Cycle</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4 space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div id="qr-reader-v2" className="overflow-hidden rounded-2xl bg-black/90 min-h-[220px]" />

            {!scanning ? (
              <button onClick={startScan} disabled={!activeCycle}
                className="btn btn-primary mt-3 w-full justify-center shadow-xs">
                <i className="fas fa-camera mr-1.5" /> Start Camera Scanner
              </button>
            ) : (
              <button onClick={stopScan} className="btn btn-gray mt-3 w-full justify-center">
                <i className="fas fa-square mr-1.5 text-red-500" /> Stop Camera
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Manual Entry</div>
            <div className="flex gap-2">
              <input className="form-input flex-1 text-xs" value={manual}
                onChange={e => setManual(e.target.value)}
                placeholder="Paste QR token..."
                onKeyDown={e => e.key === 'Enter' && handleManual()} />
              <button onClick={handleManual} disabled={!manual.trim() || !activeCycle}
                className="btn btn-primary btn-sm flex-shrink-0">
                <i className="fas fa-check" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div ref={resultRef} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={
                  result.status === 'eligible' ? 'qr-eligible'
                    : result.status === 'claimed' ? 'qr-claimed'
                    : result.status === 'on_hold' ? 'qr-inactive bg-amber-50 border-amber-300'
                    : result.status === 'inactive_member' ? 'qr-notfound bg-red-50 border-red-300'
                    : result.status === 'inactive' ? 'qr-inactive'
                    : result.status === 'insufficient_stock' ? 'qr-inactive'
                    : 'qr-notfound'
                }>
                <i className={`fas text-2xl flex-shrink-0 mt-0.5 ${
                  result.status === 'eligible' ? 'fa-circle-check text-emerald-500'
                    : result.status === 'claimed' ? 'fa-circle-xmark text-red-500'
                    : result.status === 'on_hold' ? 'fa-triangle-exclamation text-amber-600'
                    : result.status === 'inactive_member' ? 'fa-user-slash text-red-600'
                    : result.status === 'inactive' ? 'fa-pause-circle text-amber-500'
                    : result.status === 'insufficient_stock' ? 'fa-boxes-packing text-amber-500'
                    : 'fa-circle-question text-slate-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-sm">
                    {result.status === 'eligible' ? 'Verified Resident of Barangay Puerto'
                      : result.status === 'claimed' ? 'Already Claimed'
                      : result.status === 'on_hold' ? '⚠️ Distribution ON HOLD: Status Unconfirmed'
                      : result.status === 'inactive_member' ? '❌ Member Marked Inactive'
                      : result.status === 'inactive' ? 'Cycle Inactive'
                      : result.status === 'insufficient_stock' ? 'Insufficient Inventory Stock'
                      : 'QR Code Not Registered'}
                  </div>
                  <div className="text-xs mt-0.5 text-slate-600 font-medium">{result.message}</div>
                  {result.household && (
                    <div className="mt-3 bg-white/95 p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      {/* Household Header Info */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="font-display font-bold text-navy text-sm">
                            {result.member?.fname} {result.member?.lname}
                            {result.member?.is_head && <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">Head</span>}
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            HH Code: <strong className="text-navy font-mono">{result.household.hh_code}</strong> · Purok: <strong className="text-navy">{result.household.purok_name}</strong>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {(result.household.members || []).filter(m => m.status === 'active' || (!m.status && m.status !== 'inactive' && m.status !== 'deceased')).length} / {(result.household.members || []).length} Active Members
                          </span>
                        </div>
                      </div>

                      {/* Detailed Member List & Sector Breakdown */}
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Household Members & Sector Eligibility
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {(result.household.members || []).map((m, idx) => {
                            const isMemberActive = m.status === 'active' || (!m.status && m.status !== 'inactive' && m.status !== 'deceased');
                            return (
                              <div key={m.id || idx} className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                isMemberActive ? 'bg-slate-50/90 border-slate-200/80' : 'bg-red-50/60 border-red-200/80 opacity-75'
                              }`}>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-navy">{m.fname} {m.lname}</span>
                                    {m.is_head && <span className="text-[9px] font-bold text-blue-600">(Head)</span>}
                                    <span className={`badge ${
                                      isMemberActive ? 'badge-approved' : m.status === 'inactive' ? 'badge-rejected' : 'badge-inactive'
                                    }`}>
                                      {isMemberActive ? 'Active' : m.status || 'Inactive'}
                                    </span>
                                  </div>

                                  {/* Sector Badges */}
                                  {m.sectors && m.sectors.length > 0 ? (
                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                      <span className="text-[10px] text-slate-400 font-medium">Sectors:</span>
                                      {m.sectors.map(sec => (
                                        <span key={sec} className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 capitalize">
                                          {sec.replace(/_/g, ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-400 italic mt-0.5">No special sector</div>
                                  )}
                                </div>

                                <div className="text-right flex-shrink-0 text-[11px] text-slate-500">
                                  {m.relationship || 'Member'} · {m.age} yrs
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Direct Action to Record Distribution Manually */}
                      <div className="pt-2 border-t border-slate-100 flex gap-2">
                        <button
                          onClick={() => navigate(user?.role === 'staff' ? '/staff/distribution' : '/admin/distribution', { state: { prefillHhCode: result.household.hh_code } })}
                          className="btn btn-primary btn-sm flex-1 justify-center shadow-xs"
                        >
                          <i className="fas fa-pen-to-square mr-1.5" />
                          Proceed to Manual Distribution Record
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => setResult(null)}
                      className="py-2 px-3 bg-white/80 hover:bg-white text-slate-700 rounded-xl text-xs font-bold border border-slate-200 w-full flex justify-center items-center">
                      <i className="fas fa-qrcode mr-1.5" />Scan Next
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="card flex flex-col">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-display font-bold text-sm text-navy">Eligible List</div>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-bold">
                  {claimed} claimed
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold">
                  {remaining} unclaimed
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase px-1">Filter Status</div>
              <div className="flex gap-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'unclaimed', label: 'Unclaimed' },
                  { key: 'claimed', label: 'Claimed' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setClaimFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      claimFilter === f.key
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tab-scroll">
              <div className={`purok-tab ${!purokFilter ? 'active' : ''}`} onClick={() => setPurok('')}>All</div>
              {(puroks || []).filter(p => !p.is_archived).map(p => (
                <div key={p.id} className={`purok-tab ${purokFilter === String(p.id) ? 'active' : ''}`}
                  onClick={() => setPurok(String(p.id))}>{p.name}</div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-96 divide-y divide-slate-50">
            {filteredEligibles.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                {activeCycle ? 'No matching beneficiaries found.' : 'Activate a cycle first.'}
              </div>
            ) : (
              filteredEligibles.map((e, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-2.5 gap-3 ${e.is_claimed ? 'bg-emerald-50/30' : ''}`}>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-semibold text-sm text-navy truncate">{e.fname} {e.lname}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                      <span>{e.hh_code}</span>
                      <span>·</span>
                      <span>{e.purok}</span>
                      {e.qr_token && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1" title={e.qr_token}>
                            Token: {e.qr_token.slice(0, 8)}...
                            <button onClick={() => { navigator.clipboard.writeText(e.qr_token); toast.success('Token copied!') }}
                              className="text-blue-600 hover:text-blue-800 ml-0.5" title="Copy Token">
                              <i className="fas fa-copy" />
                            </button>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    {e.is_claimed ? (
                      <span className="badge badge-claimed"><i className="fas fa-check mr-1" />Claimed</span>
                    ) : (
                      <span className="badge badge-eligible">Eligible</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {eligibles.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>Progress</span>
                <span className="font-bold">{Math.round((claimed / eligibles.length) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(claimed / eligibles.length) * 100}%` }} />
              </div>
              <div className="text-[11px] text-slate-400 text-center mt-2">
                {claimed} of {eligibles.length} served
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
