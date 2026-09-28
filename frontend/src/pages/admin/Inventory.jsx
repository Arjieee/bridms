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
      { label: 'Description', key: 'description' },
      { label: 'Type', key: 'type' },
      { label: 'Quantity Changed', key: 'qty' },
      { label: 'Running Balance', key: 'balance_after' },
      { label: 'Recorded By', key: 'recorded_by' },
    ]
    const rows = ledger.map(l => ({
      date: new Date(l.date).toLocaleDateString(),
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
            <h2 className="font-display font-black text-2xl text-navy uppercase tracking-tight">
              {item.name}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
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
                  <th className="py-3 px-4 w-[22%]">Date</th>
                  <th className="py-3 px-4 w-[43%]">Description</th>
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
                        {entry.recorded_by && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            By: {entry.recorded_by}
                          </div>
                        )}
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

export default function AdminInventory() {
  const { inventory, categories, addCategory } = useAppStore()
  const [selectedCat, setSelectedCat] = useState(null)
  const [viewingLedgerItem, setViewingLedgerItem] = useState(null)
  const [showAddCat, setShowAddCat] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newCat, setNewCat] = useState({ name: '', icon: 'fa-box', color: '#1a56db' })

  const rawItems = selectedCat ? inventory.filter(i => i.category_id === selectedCat.id) : inventory
  const items = rawItems.filter(item => {
    if (searchQuery) {
      const catName = categories.find(c => c.id === item.category_id)?.name || ''
      const targetFields = [item.name, item.item_code, item.unit, catName]
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
      <div className="section-header mb-5">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy">Relief Goods Inventory</h1>
          <div className="section-sub">
            {items.length} item{items.length !== 1 ? 's' : ''}{selectedCat && ` in ${selectedCat.name}`} · Stock is restocked via Receiving Donors
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative min-w-[160px] sm:min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search inventory item..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input text-xs pl-8 py-2 w-full rounded-xl bg-white border-slate-200"
            />
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

      {/* Category Filter Pills */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
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

      {/* Inventory Table with Stock Ledger Modal Trigger */}
      <AnimatePresence mode="wait">
        <motion.div key={selectedCat?.id ?? 'all'}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="card mobile-card-table min-h-[400px] flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-xs">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <i className="fas fa-box-open text-3xl mb-2 block text-slate-300" />
              <div className="text-sm font-semibold text-slate-600">No items in this category</div>
              <div className="text-xs text-slate-400 mt-1 max-w-xs">
                To add relief goods to this category, record an incoming shipment in{' '}
                <Link to="/admin/receiving" className="text-blue-600 underline font-semibold">
                  Receiving Donors
                </Link>.
              </div>
            </div>
          ) : (
            <table className="tbl w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500 font-bold uppercase">
                  <th className="w-[50%] text-left pl-5 py-3.5">Item</th>
                  <th className="w-[30%] text-left py-3.5">Stock in Hand</th>
                  <th className="w-[20%] text-right pr-5 py-3.5">Status</th>
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
                      onClick={() => setViewingLedgerItem(item)}
                      className={`transition-colors cursor-pointer hover:bg-blue-50/60 ${isCrit ? 'row-critical' : isLow ? 'row-low' : ''}`}
                      title={`Click to view ${item.name} Stock Ledger history`}
                    >
                      <td data-label="Item" className="pl-5 py-4">
                        <div className="font-semibold text-navy text-sm flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({item.item_code})</span>
                        </div>
                        <Calc item={item} />
                      </td>
                      <td data-label="Stock" className="py-4">
                        <span className="font-bold text-navy text-sm">{display}</span>
                      </td>
                      <td data-label="Status" className="text-right pr-5 py-4">
                        {isCrit ? <span className="badge badge-critical">Critical</span>
                          : isLow ? <span className="badge badge-low">Low</span>
                            : <span className="badge badge-sufficient">OK</span>}
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
