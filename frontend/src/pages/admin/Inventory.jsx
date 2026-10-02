import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { fuzzyMatch } from '../../utils/fuzzySearch'
import { exportToCsv } from '../../utils/csvExport'
import toast from 'react-hot-toast'

function Calc({ item }) {
  const [val, setVal] = useState('')
  if (!item.has_conversion || !item.conversion_config) return null
  const cfg = item.conversion_config
  return (
    <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div className="text-[11px] font-bold text-blue-700 mb-1.5">
        <i className="fas fa-calculator mr-1" />Conversion Calculator
      </div>
      <input type="number" min="0" step="0.5" className="form-input text-xs py-1.5"
        placeholder={`Enter ${cfg.base_unit}...`}
        value={val} onChange={e => setVal(e.target.value)} />
      {val && cfg.conversions?.map((c, i) => (
        <div key={i} className="text-xs text-blue-600 mt-1">
          {parseFloat(val)} {cfg.base_unit} = <strong>{(parseFloat(val) / c.factor).toFixed(2)}</strong> {c.label}
        </div>
      ))}
    </div>
  )
}

function StockLedgerModal({ item, onClose }) {
  const { fetchItemLedger } = useAppStore()
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      setLoading(true)
      const res = await fetchItemLedger(item.id)
      if (isMounted) {
        setLedger(res.ledger || [])
        setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [item.id, fetchItemLedger])

  const handleExportLedgerCSV = () => {
    const headers = [
      { label: 'Date', key: 'date' },
      { label: 'Donor Attribution', key: 'donor_name' },
      { label: 'Description', key: 'description' },
      { label: 'Type', key: 'type' },
      { label: 'Quantity Changed', key: 'qty' },
      { label: 'Running Balance', key: 'balance_after' },
      { label: 'Recorded By', key: 'recorded_by' },
    ]
    const rows = ledger.map(l => ({
      date: new Date(l.date).toLocaleDateString(),
      donor_name: l.donor_name || item.donor_name || 'General Stock',
      description: l.description,
      type: l.type?.toUpperCase(),
      qty: (l.qty > 0 ? '+' : '') + l.qty,
      balance_after: l.balance_after,
      recorded_by: l.recorded_by || 'System',
    }))
    exportToCsv(`Ledger_${item.name.replace(/\s+/g, '_')}`, headers, rows)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="card p-6 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Ledger Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">
              Stock Ledger &amp; Running Balance
            </div>
            <h2 className="font-display font-black text-2xl text-navy uppercase tracking-tight flex items-center gap-2 flex-wrap">
              <span>{item.name}</span>
              <span className="text-blue-600 text-base font-bold bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                {item.unit}
              </span>
              {item.donor_name && (
                <span className="text-indigo-700 text-xs font-bold bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200 flex items-center gap-1.5 shadow-2xs">
                  <i className="fas fa-hand-holding-heart text-indigo-500" />
                  <span>{item.donor_name}</span>
                </span>
              )}
              {item.is_repacked && (
                <span className="text-amber-700 text-xs font-bold bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1.5 shadow-2xs">
                  <i className="fas fa-boxes-packing text-amber-500" />
                  <span>Repacked Goods</span>
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
              <span className="font-mono font-semibold text-slate-600">{item.item_code}</span>
              <span>·</span>
              <span>Unit: <strong className="text-navy">{item.unit}</strong></span>
              <span>·</span>
              <span className="badge badge-sufficient text-xs font-bold px-2 py-0.5">
                Current Stock: {item.quantity} {item.unit}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-slate-400 hover:text-navy hover:bg-slate-100 flex items-center justify-center">
            <i className="fas fa-xmark text-sm" />
          </button>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-y-auto my-4 border border-slate-200/80 rounded-xl">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 text-blue-500 block" />
              <div className="text-xs font-semibold">Loading ledger records...</div>
            </div>
          ) : ledger.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <i className="fas fa-receipt text-3xl mb-2 text-slate-300 block" />
              <div className="text-sm font-semibold text-slate-600">No stock movement entries yet</div>
              <div className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Stock intake is recorded via Receiving Donors, and deductions occur when relief goods are distributed.
              </div>
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200 sticky top-0 uppercase">
                <tr>
                  <th className="py-3 px-4 w-[20%]">Date</th>
                  <th className="py-3 px-4 w-[45%]">Description &amp; Origin</th>
                  <th className="py-3 px-4 w-[17%] text-right">Qty</th>
                  <th className="py-3 px-4 w-[18%] text-right">R. Bal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((entry) => {
                  const isPositive = entry.qty > 0
                  const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: '2-digit',
                  })
                  return (
                    <tr key={entry.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-600 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-navy leading-snug">
                          {entry.description}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {entry.donor_name && (
                            <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 flex items-center gap-1">
                              <i className="fas fa-hand-holding-heart text-[9px]" />
                              <span>{entry.donor_name}</span>
                            </span>
                          )}
                          {entry.recorded_by && (
                            <span className="text-[10px] text-slate-400">
                              By: {entry.recorded_by}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`inline-block font-bold text-xs ${
                          isPositive ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'
                        }`}>
                          {isPositive ? `+${entry.qty}` : entry.qty}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-navy whitespace-nowrap text-xs">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                          {entry.balance_after}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="text-[11px] text-slate-400">
            {ledger.length} total movement transaction{ledger.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            {ledger.length > 0 && (
              <button onClick={handleExportLedgerCSV} className="btn btn-outline btn-xs px-3">
                <i className="fas fa-file-csv mr-1.5 text-blue-500" /> Export CSV
              </button>
            )}
            <button onClick={onClose} className="btn btn-gray btn-xs px-4">
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

const BULK_UNITS_SET = new Set([
  'sack', 'sacks',
  'box', 'boxes',
  'case', 'cases',
  'carton', 'cartons',
  'crate', 'crates',
  'bale', 'bales',
  'bundle', 'bundles',
  'container', 'containers',
  'drum', 'drums',
  'carboy', 'carboys',
  'gallon', 'gallons',
  'bag', 'bags',
  'tub', 'tubs',
])

export function isBulkPackaging(unit) {
  if (!unit) return false
  const clean = unit.trim().toLowerCase()
  if (BULK_UNITS_SET.has(clean)) return true
  const bulkKeywords = ['sack', 'box', 'case', 'carton', 'crate', 'bale', 'bundle', 'container', 'drum', 'carboy', 'gallon', 'bag']
  return bulkKeywords.some(k => clean.includes(k))
}

function RepackModal({ item, allInventory, onClose }) {
  const { repackInventoryItem } = useAppStore()
  const [sourceQty, setSourceQty] = useState('')
  const [targetUnit, setTargetUnit] = useState('')
  const [yieldPerUnit, setYieldPerUnit] = useState('')
  const [totalYield, setTotalYield] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currUnit = (item.unit || '').trim().toLowerCase()

  // Suggest common conversion units based on source unit
  const suggestedUnits = (() => {
    if (currUnit === 'sacks' || currUnit === 'sack') return ['kg', 'g', 'packs']
    if (currUnit === 'boxes' || currUnit === 'box' || currUnit === 'cases' || currUnit === 'case') return ['pcs', 'cans', 'packs', 'bottles']
    if (currUnit === 'packs' || currUnit === 'pack') return ['pcs', 'sachets']
    return ['kg', 'pcs', 'packs', 'cans', 'bottles']
  })()

  // Default initial configuration based on source item
  useEffect(() => {
    if (currUnit === 'sacks' || currUnit === 'sack') {
      setTargetUnit('kg')
      setYieldPerUnit('50')
      setSourceQty('1')
      setTotalYield('50')
    } else if (currUnit === 'boxes' || currUnit === 'box' || currUnit === 'cases' || currUnit === 'case') {
      setTargetUnit('pcs')
      setYieldPerUnit('24')
      setSourceQty('1')
      setTotalYield('24')
    } else {
      setSourceQty('1')
    }
  }, [currUnit])

  const handleSourceQtyChange = (val) => {
    setSourceQty(val)
    const s = parseFloat(val)
    const y = parseFloat(yieldPerUnit)
    if (!isNaN(s) && !isNaN(y) && s > 0 && y > 0) {
      setTotalYield((s * y).toString())
    }
  }

  const handleYieldPerUnitChange = (val) => {
    setYieldPerUnit(val)
    const s = parseFloat(sourceQty)
    const y = parseFloat(val)
    if (!isNaN(s) && !isNaN(y) && s > 0 && y > 0) {
      setTotalYield((s * y).toString())
    }
  }

  const handleTotalYieldChange = (val) => {
    setTotalYield(val)
    const tot = parseFloat(val)
    const s = parseFloat(sourceQty)
    if (!isNaN(tot) && !isNaN(s) && s > 0 && tot > 0) {
      const perUnit = tot / s
      setYieldPerUnit(Number.isInteger(perUnit) ? perUnit.toString() : perUnit.toFixed(2))
    }
  }

  const cleanTargetUnit = (targetUnit || '').trim().toLowerCase()
  const existingTarget = allInventory.find(
    (i) =>
      i.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
      i.unit.trim().toLowerCase() === cleanTargetUnit &&
      (i.donor_id === item.donor_id || (!i.donor_id && !item.donor_id)) &&
      i.id !== item.id
  )

  const numSourceQty = parseFloat(sourceQty) || 0
  const numTotalYield = parseFloat(totalYield) || 0
  const hasEnoughStock = numSourceQty > 0 && numSourceQty <= item.quantity
  const isDiffUnit = cleanTargetUnit && cleanTargetUnit !== currUnit
  const hasValidYield = numTotalYield > 0
  const isValid = hasEnoughStock && isDiffUnit && hasValidYield

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || submitting) return

    setSubmitting(true)
    const res = await repackInventoryItem({
      source_item_id: item.id,
      source_qty: numSourceQty,
      target_unit: cleanTargetUnit,
      yield_qty: numTotalYield,
      remarks: remarks.trim(),
    })
    setSubmitting(false)

    if (res.ok) {
      toast.success(res.message || 'Stock successfully repacked!')
      onClose()
    } else {
      toast.error(res.message || 'Failed to repack stock.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card p-6 w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col my-auto border border-slate-100"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <i className="fas fa-boxes-packing" /> Repack &amp; Bulk Conversion
            </div>
            <h2 className="font-display font-black text-xl text-navy uppercase tracking-tight">
              Convert {item.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Break down bulk packaging into relief distribution units while preserving donor traceability.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-navy hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <i className="fas fa-xmark text-sm" />
          </button>
        </div>

        {/* Source Item Badge Box */}
        <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              <i className="fas fa-box" />
            </div>
            <div>
              <div className="font-bold text-navy text-sm flex items-center gap-2 flex-wrap">
                <span>{item.name}</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold text-[10px]">
                  {item.unit}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono mt-0.5 flex-wrap">
                <span>{item.item_code}</span>
                <span>·</span>
                {item.donor_name ? (
                  <span className="text-indigo-700 font-semibold flex items-center gap-1">
                    <i className="fas fa-hand-holding-heart text-[10px]" />
                    <span>Donor: {item.donor_name}</span>
                  </span>
                ) : (
                  <span>General Stock</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Available</div>
            <div className="text-base font-extrabold text-navy font-mono">
              {item.quantity} <span className="text-xs font-semibold text-slate-500">{item.unit}</span>
            </div>
          </div>
        </div>

        {/* Conversion Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Source Qty Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-slate-700">
                Quantity to Open / Convert ({item.unit}) *
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                Max: {item.quantity} {item.unit}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.1"
                max={item.quantity}
                step="any"
                required
                className="form-input text-xs py-2 flex-1 rounded-xl"
                placeholder={`Number of ${item.unit} to repack...`}
                value={sourceQty}
                onChange={(e) => handleSourceQtyChange(e.target.value)}
              />
              <div className="flex gap-1">
                {[1, 2, 5].filter((n) => n <= item.quantity).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleSourceQtyChange(n.toString())}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                  >
                    {n}
                  </button>
                ))}
                {item.quantity > 5 && (
                  <button
                    type="button"
                    onClick={() => handleSourceQtyChange(item.quantity.toString())}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                  >
                    All
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Target Unit of Measure */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-slate-700">
                Target Distribution Unit *
              </label>
              <span className="text-[10px] text-slate-400">e.g. kg, packs, cans, pcs</span>
            </div>
            <input
              type="text"
              required
              className="form-input text-xs py-2 w-full rounded-xl"
              placeholder="e.g. kg, packs, cans, pcs..."
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
            />
            {/* Suggested Chips */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-semibold">Quick select:</span>
              {suggestedUnits.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setTargetUnit(u)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                    cleanTargetUnit === u
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Conversion Ratio / Total Yield */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Yield per 1 {item.unit}
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                className="form-input text-xs py-2 w-full rounded-xl"
                placeholder={`e.g. 50 ${cleanTargetUnit || 'units'}`}
                value={yieldPerUnit}
                onChange={(e) => handleYieldPerUnitChange(e.target.value)}
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                1 {item.unit} = {yieldPerUnit || '...'} {cleanTargetUnit || 'unit'}
              </span>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Total Output Yield *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                className="form-input text-xs py-2 w-full rounded-xl font-bold text-navy"
                placeholder={`Total ${cleanTargetUnit || 'units'}...`}
                value={totalYield}
                onChange={(e) => handleTotalYieldChange(e.target.value)}
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Total to be added in inventory
              </span>
            </div>
          </div>

          {/* Audit Remarks */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Audit Remarks / Purpose <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              type="text"
              className="form-input text-xs py-2 w-full rounded-xl"
              placeholder="e.g. Repacked for Barangay relief package distribution"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {/* Conversion Live Impact Box */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2.5">
            <div className="text-[11px] font-bold text-blue-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <i className="fas fa-arrow-right-arrow-left text-blue-600" /> Stock Ledger &amp; Donor Traceability Preview
              </span>
              <span className="text-[10px] uppercase font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                Live
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-blue-200/50">
              <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Source Deduction</div>
                <div className="font-bold text-navy text-xs truncate">{item.name} [{item.unit}]</div>
                <div className="text-[10px] text-indigo-600 truncate mt-0.5 font-medium">
                  {item.donor_name || 'General Inventory'}
                </div>
                <div className="flex items-center justify-between mt-1 text-xs font-mono">
                  <span className="text-slate-500">{item.quantity}</span>
                  <span className="text-red-500 font-bold">-{numSourceQty}</span>
                  <span className="font-bold text-navy">
                    {Math.max(0, item.quantity - numSourceQty)} {item.unit}
                  </span>
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Target Addition</div>
                <div className="font-bold text-navy text-xs truncate">
                  {item.name} [{cleanTargetUnit || '...'}]
                </div>
                <div className="text-[10px] text-indigo-600 truncate mt-0.5 font-medium">
                  {item.donor_name || 'General Inventory'}
                </div>
                <div className="flex items-center justify-between mt-1 text-xs font-mono">
                  <span className="text-slate-500">
                    {existingTarget ? existingTarget.quantity : 0}
                  </span>
                  <span className="text-emerald-600 font-bold">+{numTotalYield}</span>
                  <span className="font-bold text-navy">
                    {(existingTarget ? existingTarget.quantity : 0) + numTotalYield} {cleanTargetUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Donor Traceability Notice */}
            <div className="text-[11px] text-indigo-950 bg-indigo-50/80 border border-indigo-200/80 p-2.5 rounded-lg flex items-start gap-2">
              <i className="fas fa-shield-halved text-indigo-600 mt-0.5 text-xs shrink-0" />
              <div className="leading-snug">
                <span className="font-bold">Donor Segregation Preserved:</span> Repacked units are designated under <strong>{item.donor_name || 'General Stock'}</strong> (flagged as <em>Repacked Goods</em>) and remain distinct from other donors&apos; stock.
              </div>
            </div>

            {!existingTarget && cleanTargetUnit && (
              <div className="text-[10px] text-blue-700 bg-blue-100/50 p-2 rounded flex items-center gap-1.5">
                <i className="fas fa-info-circle text-xs shrink-0" />
                <span>
                  A new inventory item record for <strong>{item.name} [{cleanTargetUnit}]</strong> ({item.donor_name || 'General Stock'}) will be automatically created under this category.
                </span>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
              disabled={!isValid || submitting}
              className="btn btn-primary btn-xs px-4 flex items-center gap-1.5 disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>Repacking...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-check-circle" />
                  <span>Confirm Repack</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function AdminInventory() {
  const { inventory, categories, addCategory } = useAppStore()
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedDonor, setSelectedDonor] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL') // 'ALL', 'BULK', 'REPACKED'
  const [viewingLedgerItem, setViewingLedgerItem] = useState(null)
  const [repackingItem, setRepackingItem] = useState(null)
  const [showAddCat, setShowAddCat] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newCat, setNewCat] = useState({ name: '', icon: 'fa-box', color: '#1a56db' })

  // Extract unique donors from current inventory
  const uniqueDonors = Array.from(
    new Set(inventory.map(i => i.donor_name).filter(Boolean))
  ).sort()

  const rawItems = selectedCat ? inventory.filter(i => i.category_id === selectedCat.id) : inventory
  const items = rawItems.filter(item => {
    if (selectedDonor !== 'ALL') {
      if (item.donor_name !== selectedDonor) return false
    }
    if (filterType === 'BULK') {
      if (!isBulkPackaging(item.unit)) return false
    } else if (filterType === 'REPACKED') {
      if (!item.is_repacked) return false
    }
    if (searchQuery) {
      const catName = categories.find(c => c.id === item.category_id)?.name || ''
      const targetFields = [item.name, item.item_code, item.unit, catName, item.donor_name || '']
      if (!fuzzyMatch(targetFields, searchQuery)) return false
    }
    return true
  })

  const handleAddCat = () => {
    if (!newCat.name) { toast.error('Category name required.'); return }
    addCategory(newCat)
    toast.success(`Category "${newCat.name}" added.`)
    setShowAddCat(false)
    setNewCat({ name: '', icon: 'fa-box', color: '#1a56db' })
  }

  const handleExportCSV = () => {
    const headers = [
      { label: 'Item Code', key: 'item_code' },
      { label: 'Item Name', key: 'name' },
      { label: 'Donor / Agency', key: 'donor_name' },
      { label: 'Repacked Status', key: 'repacked_status' },
      { label: 'Category', key: 'category_name' },
      { label: 'Quantity in Stock', key: 'quantity' },
      { label: 'Unit', key: 'unit' },
      { label: 'Low Threshold', key: 'low_threshold' },
      { label: 'Critical Threshold', key: 'critical_threshold' },
      { label: 'Stock Status', key: 'status' },
    ]
    const rows = items.map(i => {
      const cat = categories.find(c => c.id === i.category_id)
      const isCrit = i.quantity <= i.critical_threshold
      const isLow = i.quantity <= i.low_threshold
      const status = isCrit ? 'Critical' : isLow ? 'Low' : 'OK'
      return {
        item_code: i.item_code || `INV-${i.id}`,
        name: i.name,
        donor_name: i.donor_name || 'General Stock',
        repacked_status: i.is_repacked ? 'Yes (Repacked)' : 'No (Original)',
        category_name: cat?.name || 'General',
        quantity: i.quantity,
        unit: i.unit,
        low_threshold: i.low_threshold,
        critical_threshold: i.critical_threshold,
        status,
      }
    })
    exportToCsv('Inventory_Stock', headers, rows)
  }

  return (
    <div>
      {/* Header and Quick Actions */}
      <div className="section-header mb-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy">Relief Goods Inventory</h1>
          <div className="section-sub">
            {items.length} item{items.length !== 1 ? 's' : ''}{selectedCat && ` in ${selectedCat.name}`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search Box */}
          <div className="relative min-w-[160px] sm:min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search item or donor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input text-xs pl-8 py-2 w-full rounded-xl bg-white border-slate-200"
            />
          </div>

          {/* Donor Filter Dropdown */}
          <div className="relative min-w-[150px] sm:min-w-[180px]">
            <select
              value={selectedDonor}
              onChange={e => setSelectedDonor(e.target.value)}
              className="form-input text-xs py-2 w-full rounded-xl bg-white border-slate-200 text-slate-700 font-semibold cursor-pointer"
              title="Filter by Donating Institution / LGU"
            >
              <option value="ALL">🏛 All Donors ({uniqueDonors.length})</option>
              {uniqueDonors.map(donor => (
                <option key={donor} value={donor}>
                  {donor}
                </option>
              ))}
            </select>
          </div>

          <button onClick={handleExportCSV} className="btn btn-gray btn-sm cursor-pointer" title="Export Inventory to CSV">
            <i className="fas fa-file-csv text-emerald-600 text-sm" /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button onClick={() => setShowAddCat(true)} className="btn btn-outline btn-sm">
            <i className="fas fa-plus" /> <span className="hidden sm:inline">Category</span>
          </button>
          <Link to="/admin/receiving" className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm">
            <i className="fas fa-hand-holding-heart" />
            <span className="hidden sm:inline">Receive Goods</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-boxes-stacked" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Items</div>
            <div className="text-xl font-extrabold text-navy font-mono">{inventory.length}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-hand-holding-heart" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Donors</div>
            <div className="text-xl font-extrabold text-navy font-mono">{uniqueDonors.length}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-triangle-exclamation" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low Stock</div>
            <div className="text-xl font-extrabold text-navy font-mono">
              {inventory.filter(i => i.quantity <= (i.low_threshold || 15) && i.quantity > 0).length}
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-circle-xmark" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Out of Stock</div>
            <div className="text-xl font-extrabold text-navy font-mono">
              {inventory.filter(i => i.quantity <= 0).length}
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        <div className={`cat-card ${!selectedCat ? 'active' : ''}`} onClick={() => setSelectedCat(null)}>
          <i className="fas fa-border-all text-2xl mb-1" style={{ color: !selectedCat ? '#1a56db' : '#94a3b8' }} />
          <div className="font-display font-bold text-xs text-center" style={{ color: !selectedCat ? '#1a56db' : '#475569' }}>
            All
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{inventory.length}</div>
        </div>
        {categories.map(c => {
          const active = selectedCat?.id === c.id
          const count = inventory.filter(i => i.category_id === c.id).length
          return (
            <div key={c.id} className={`cat-card ${active ? 'active' : ''}`} onClick={() => setSelectedCat(c)}>
              <i className={`fas ${c.icon} text-2xl mb-1`}
                style={{ color: active ? c.color : '#94a3b8' }} />
              <div className="font-display font-bold text-xs text-center leading-tight"
                style={{ color: active ? c.color : '#475569' }}>
                {c.name}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{count}</div>
            </div>
          )
        })}
      </div>

      {/* Packaging & Donor Sub-Filter Bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-navy text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Packaging
          </button>
          <button
            type="button"
            onClick={() => setFilterType('BULK')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterType === 'BULK'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <i className="fas fa-box" />
            <span>Bulk / Convertibles ({inventory.filter(i => isBulkPackaging(i.unit)).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('REPACKED')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterType === 'REPACKED'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <i className="fas fa-boxes-packing" />
            <span>Repacked Goods ({inventory.filter(i => i.is_repacked).length})</span>
          </button>
        </div>

        {selectedDonor !== 'ALL' && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-1 rounded-lg text-xs">
            <span className="font-semibold">Filtered by: <strong>{selectedDonor}</strong></span>
            <button
              type="button"
              onClick={() => setSelectedDonor('ALL')}
              className="text-indigo-500 hover:text-indigo-900 font-bold ml-1 cursor-pointer"
              title="Clear donor filter"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        )}
      </div>

      {/* Inventory Table with Stock Ledger & Repack Modal Triggers */}
      <AnimatePresence mode="wait">
        <motion.div key={selectedCat?.id ?? 'all'}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="card mobile-card-table min-h-[400px] flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-xs">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <i className="fas fa-box-open text-3xl mb-2 block text-slate-300" />
              <div className="text-sm font-semibold text-slate-600">No items match this filter</div>
              <div className="text-xs text-slate-400 mt-1 max-w-xs">
                {selectedDonor !== 'ALL' ? (
                  <span>
                    No inventory recorded from <strong>{selectedDonor}</strong> under this category.
                  </span>
                ) : (
                  <span>
                    To add relief goods to this category, record an incoming shipment in{' '}
                    <Link to="/admin/receiving" className="text-blue-600 underline font-semibold">
                      Receiving Donors
                    </Link>.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <table className="tbl w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500 font-bold uppercase">
                  <th className="w-[44%] text-left pl-5 py-3.5">Item &amp; Donor Attribution</th>
                  <th className="w-[26%] text-left py-3.5">Stock in Hand</th>
                  <th className="w-[14%] text-left py-3.5">Status</th>
                  <th className="w-[16%] text-right pr-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.map(item => {
                  const isCrit = item.quantity <= item.critical_threshold
                  const isLow = item.quantity <= item.low_threshold
                  const cfg = item.conversion_config
                  const display = cfg?.conversions?.[0]
                    ? `${item.quantity} ${cfg.base_unit} (≈${(item.quantity / cfg.conversions[0].factor).toFixed(1)} ${cfg.conversions[0].label})`
                    : `${item.quantity} ${item.unit}`
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-blue-50/60 ${isCrit ? 'row-critical' : isLow ? 'row-low' : ''}`}
                    >
                      <td
                        data-label="Item"
                        className="pl-5 py-4 cursor-pointer"
                        onClick={() => setViewingLedgerItem(item)}
                        title={`Click to view ${item.name} Stock Ledger history`}
                      >
                        <div className="font-semibold text-navy text-sm flex items-center gap-2 flex-wrap">
                          <span>{item.name}</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                            {item.unit}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">({item.item_code})</span>
                        </div>

                        {/* Donor and Repack Attribution Badges */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {item.donor_name ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                              title={`Donated by ${item.donor_name}`}
                            >
                              <i className="fas fa-hand-holding-heart text-[9px] text-indigo-500" />
                              <span>{item.donor_name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              <span>General Stock</span>
                            </span>
                          )}

                          {item.is_repacked && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
                              title="Repacked from bulk units for relief distribution"
                            >
                              <i className="fas fa-boxes-packing text-[9px] text-amber-600" />
                              <span>Repacked Goods</span>
                            </span>
                          )}
                        </div>

                        <Calc item={item} />
                      </td>
                      <td
                        data-label="Stock"
                        className="py-4 cursor-pointer"
                        onClick={() => setViewingLedgerItem(item)}
                        title={`Click to view ${item.name} Stock Ledger history`}
                      >
                        <span className="font-bold text-navy text-sm">{display}</span>
                      </td>
                      <td
                        data-label="Status"
                        className="py-4 cursor-pointer"
                        onClick={() => setViewingLedgerItem(item)}
                        title={`Click to view ${item.name} Stock Ledger history`}
                      >
                        {isCrit ? <span className="badge badge-critical">Critical</span>
                          : isLow ? <span className="badge badge-low">Low</span>
                            : <span className="badge badge-sufficient">OK</span>}
                      </td>
                      <td data-label="Actions" className="text-right pr-5 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isBulkPackaging(item.unit) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRepackingItem(item);
                              }}
                              disabled={item.quantity <= 0}
                              className="btn btn-outline btn-xs px-2.5 py-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title={item.quantity <= 0 ? "No stock available to repack" : `Repack / Convert bulk ${item.unit} into distribution units`}
                            >
                              <i className="fas fa-boxes-packing text-[11px]" />
                              <span>Repack</span>
                            </button>
                          ) : item.is_repacked ? (
                            <span
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md inline-flex items-center gap-1"
                              title="Repacked distribution units ready for family packs"
                            >
                              <i className="fas fa-check-circle text-[10px]" />
                              <span>Ready</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300 select-none px-2" title="Standard distribution unit">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Stock Ledger Modal */}
      {viewingLedgerItem && (
        <StockLedgerModal item={viewingLedgerItem} onClose={() => setViewingLedgerItem(null)} />
      )}

      {/* Repack & Convert Bulk Modal */}
      {repackingItem && (
        <RepackModal
          item={repackingItem}
          allInventory={inventory}
          onClose={() => setRepackingItem(null)}
        />
      )}

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddCat(false)}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Add Inventory Category</h3>
              <button onClick={() => setShowAddCat(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input className="form-input" value={newCat.name}
                  onChange={e => setNewCat(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Baby Care, Water & Sanitation" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Font Awesome Icon Class</label>
                <input className="form-input" value={newCat.icon}
                  onChange={e => setNewCat(f => ({ ...f, icon: e.target.value }))}
                  placeholder="fa-box" />
                <div className="text-[11px] text-slate-400 mt-1">
                  Browse icons at fontawesome.com/search (e.g. fa-tshirt, fa-flask)
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="color" className="form-input h-12" value={newCat.color}
                  onChange={e => setNewCat(f => ({ ...f, color: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddCat(false)} className="btn btn-gray">Cancel</button>
              <button onClick={handleAddCat} className="btn btn-primary"><i className="fas fa-plus" /> Add Category</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
