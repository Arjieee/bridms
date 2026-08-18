import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

function StockModal({ item, mode, onClose, pendingTasks = [] }) {
  const { adjustStock, fulfillDonationTask } = useAppStore()
  const [qty, setQty] = useState('')
  const [remarks, setRemarks] = useState('')

  const handleSubmit = async () => {
    const q = parseFloat(qty)
    if (!q || q <= 0) { toast.error('Enter a valid quantity.'); return }
    await adjustStock(item.id, q, mode, remarks || (mode === 'in' ? 'Stock in' : 'Stock out'))

    if (mode === 'in' && pendingTasks.length > 0) {
      const matched = pendingTasks.find(t => {
        const tName = t.item_name.toLowerCase().trim()
        const iName = item.name.toLowerCase().trim()
        return tName === iName || tName.includes(iName) || iName.includes(tName)
      })
      if (matched) {
        await fulfillDonationTask(matched.supplierId, matched.itemIndex, item.id, q)
      }
    }

    toast.success(`Stock ${mode === 'in' ? 'added' : 'deducted'} successfully.`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="card p-6 w-full max-w-md bg-white rounded-2xl shadow-xl">
        <div className="font-display font-bold text-lg text-navy mb-1">
          {mode === 'in' ? 'Add Stock' : 'Deduct Stock'} — {item.name}
        </div>
        <div className="text-xs text-slate-500 mb-4">
          Current: <strong className="text-navy">{item.quantity} {item.unit}</strong>
        </div>

        <div className="space-y-3">
          <div>
            <label className="form-label text-xs">Quantity to {mode === 'in' ? 'Add' : 'Deduct'}</label>
            <input type="number" min="0.5" step="0.5" className="form-input"
              placeholder={`Quantity in ${item.unit}...`} value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div>
            <label className="form-label text-xs">Remarks / Source</label>
            <input className="form-input" value={remarks} onChange={e => setRemarks(e.target.value)}
              placeholder={mode === 'in' ? 'e.g. Donation from LGU, Purchase' : 'e.g. Damaged, Expired'} />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="btn btn-gray">Cancel</button>
          <button onClick={handleSubmit} className={`btn ${mode === 'in' ? 'btn-success' : 'btn-warning'}`}>
            {mode === 'in' ? 'Add Stock' : 'Deduct Stock'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function AdminInventory() {
  const { inventory, categories, suppliers, addInventoryItem, addCategory, fulfillDonationTask } = useAppStore()
  const [selectedCat, setSelectedCat] = useState(null)
  const [stockTarget, setStockTarget] = useState(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [newItem, setNewItem] = useState({ name: '', category_id: '', quantity: '', unit: '', low_threshold: 15, critical_threshold: 5 })
  const [newCat, setNewCat] = useState({ name: '', icon: 'fa-box', color: '#1a56db' })

  // Collect unfulfilled donated items for modal & button badge
  const pendingTasks = [];
  (suppliers || []).forEach((sup) => {
    (sup.items || []).forEach((item, idx) => {
      if (!item.fulfilled) {
        pendingTasks.push({
          ...item,
          supplierId: sup.id,
          supplierName: sup.org_name,
          itemIndex: idx,
        })
      }
    })
  })

  const rawItems = selectedCat ? inventory.filter(i => i.category_id === selectedCat.id) : inventory
  const items = rawItems.filter(item => {
    if (searchQuery) {
      const catName = categories.find(c => c.id === item.category_id)?.name || ''
      const targetFields = [item.name, item.item_code, item.unit, catName]
      if (!fuzzyMatch(targetFields, searchQuery)) return false
    }
    return true
  })

  const handleAutoFillTask = (task) => {
    setSelectedTask(task)
    // Auto-match category if possible
    const matched = categories.find(c =>
      c.name.toLowerCase().includes('food') || c.name.toLowerCase().includes('relief')
    )
    setNewItem({
      name: task.item_name || '',
      category_id: matched ? matched.id : (categories[0]?.id || 1),
      quantity: task.quantity || '100',
      unit: task.unit || 'Packs',
      low_threshold: 20,
      critical_threshold: 5,
    })
    toast.success(`Auto-filled "${task.item_name}". Set low & critical alerts below, then click Add Item.`)
  }

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.category_id || !newItem.unit) {
      toast.error('Name, category, and unit are required.')
      return
    }
    const res = await addInventoryItem(newItem)

    // Fulfill linked donation task (either selectedTask or auto-matched by name)
    let taskToFulfill = selectedTask
    if (!taskToFulfill) {
      const typedName = newItem.name.toLowerCase().trim()
      taskToFulfill = pendingTasks.find(t => {
        const tName = t.item_name.toLowerCase().trim()
        return tName === typedName || typedName.includes(typedName) || typedName.includes(tName)
      })
    }

    if (taskToFulfill) {
      await fulfillDonationTask(taskToFulfill.supplierId, taskToFulfill.itemIndex, null, 0)
      setSelectedTask(null)
    }

    if (res?.merged) {
      toast.success(res.message || `Merged stock into existing item "${newItem.name}"!`)
    } else {
      toast.success(`"${newItem.name}" added to inventory!`)
    }
    setShowAddItem(false)
    setNewItem({ name: '', category_id: '', quantity: '', unit: '', low_threshold: 15, critical_threshold: 5 })
  }

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
          <div className="section-sub">{items.length} item{items.length !== 1 ? 's' : ''}{selectedCat && ` in ${selectedCat.name}`}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative min-w-[160px] sm:min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search inventory item..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input text-xs pl-8 py-1.5 w-full rounded-xl bg-white border-slate-200"
            />
          </div>
          <button onClick={handleExportCSV} className="btn btn-gray btn-sm cursor-pointer" title="Export Inventory to CSV">
            <i className="fas fa-file-csv text-emerald-600 text-sm" /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button onClick={() => setShowAddCat(true)} className="btn btn-outline btn-sm">
            <i className="fas fa-plus" /> <span className="hidden sm:inline">Category</span>
          </button>
          <button onClick={() => setShowAddItem(true)} className="btn btn-primary btn-sm flex items-center gap-1.5">
            <i className="fas fa-plus" />
            <span className="hidden sm:inline">Item</span>
            {pendingTasks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-navy font-extrabold text-[10px] shadow-sm">
                {pendingTasks.length} Donated
              </span>
            )}
          </button>
        </div>
      </div>

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

      <AnimatePresence mode="wait">
        <motion.div key={selectedCat?.id ?? 'all'}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="card mobile-card-table min-h-[400px] flex flex-col justify-center overflow-hidden">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-slate-400">
              <i className="fas fa-box-open text-3xl mb-2 block text-slate-300" />
              <div className="text-sm">No items in this category</div>
            </div>
          ) : (
            <table className="tbl w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="w-[35%] text-left pl-5 py-3.5">Item</th>
                  <th className="w-[25%] text-left py-3.5">Stock</th>
                  <th className="w-[20%] text-left py-3.5">Status</th>
                  <th className="w-[20%] text-right pr-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isCrit = item.quantity <= item.critical_threshold
                  const isLow = item.quantity <= item.low_threshold
                  const cfg = item.conversion_config
                  const display = cfg?.conversions?.[0]
                    ? `${item.quantity} ${cfg.base_unit} (≈${(item.quantity / cfg.conversions[0].factor).toFixed(1)} ${cfg.conversions[0].label})`
                    : `${item.quantity} ${item.unit}`
                  return (
                    <tr key={item.id} className={`transition-colors hover:bg-slate-50/60 ${isCrit ? 'row-critical' : isLow ? 'row-low' : ''}`}>
                      <td data-label="Item" className="pl-5 py-3.5">
                        <div className="font-semibold text-navy text-sm">{item.name}</div>
                        <div className="text-[11px] text-slate-400">{item.item_code}</div>
                        <Calc item={item} />
                      </td>
                      <td data-label="Stock" className="py-3.5">
                        <span className="font-bold text-navy text-sm">{display}</span>
                      </td>
                      <td data-label="Status" className="py-3.5">
                        {isCrit ? <span className="badge badge-critical">Critical</span>
                          : isLow ? <span className="badge badge-low">Low</span>
                            : <span className="badge badge-sufficient">OK</span>}
                      </td>
                      <td data-label="Actions" className="text-right pr-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setStockTarget({ item, mode: 'in' })} className="btn btn-success btn-xs px-3">
                            <i className="fas fa-plus mr-1" /> In
                          </button>
                          <button onClick={() => setStockTarget({ item, mode: 'out' })} className="btn btn-warning btn-xs px-3">
                            <i className="fas fa-minus mr-1" /> Out
                          </button>
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

      {stockTarget && (
        <StockModal item={stockTarget.item} mode={stockTarget.mode} pendingTasks={pendingTasks} onClose={() => setStockTarget(null)} />
      )}

      {showAddItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddItem(false)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Add Relief Item</h3>
              <button onClick={() => setShowAddItem(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              {pendingTasks.length > 0 && (
                <div className="mb-4 bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <i className="fas fa-boxes-packing text-amber-600" />
                      Pending Donated Goods ({pendingTasks.length})
                    </div>
                    <span className="text-[10px] text-amber-700 font-semibold">Click ⚡ Auto-Fill or ✓ Clear</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {pendingTasks.map(task => (
                      <div key={`${task.supplierId}-${task.itemIndex}`}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-navy">{task.item_name}</span>
                          <span className="text-slate-500 text-[11px] ml-1.5">({task.quantity} {task.unit} · {task.supplierName})</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button type="button" onClick={() => handleAutoFillTask(task)}
                            className="btn bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] py-1 px-2.5 rounded-lg flex items-center gap-1">
                            <i className="fas fa-bolt" /> Auto-Fill
                          </button>
                          <button type="button"
                            onClick={async () => {
                              await fulfillDonationTask(task.supplierId, task.itemIndex, null, 0)
                              toast.success(`Cleared task for "${task.item_name}"`)
                            }}
                            title="Mark as already added / Clear task"
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 flex items-center justify-center text-xs transition-all">
                            <i className="fas fa-check" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask && (
                <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-800">
                  <span>Linked to donation: <strong>{selectedTask.item_name}</strong> ({selectedTask.supplierName})</span>
                  <button type="button" onClick={() => setSelectedTask(null)} className="text-blue-500 hover:text-blue-700 text-xs font-bold">Unlink</button>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Item Name *</label>
                <input className="form-input" value={newItem.name}
                  onChange={e => setNewItem(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rice, Canned Tuna" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-input" value={newItem.category_id}
                  onChange={e => setNewItem(f => ({ ...f, category_id: parseInt(e.target.value) }))}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Initial Quantity</label>
                  <input type="number" min="0" className="form-input" value={newItem.quantity}
                    onChange={e => setNewItem(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit *</label>
                  <input className="form-input" value={newItem.unit}
                    onChange={e => setNewItem(f => ({ ...f, unit: e.target.value }))}
                    placeholder="kg, cans, pcs" />
                </div>
                <div className="form-group">
                  <label className="form-label">Low Alert at</label>
                  <input type="number" className="form-input" value={newItem.low_threshold}
                    onChange={e => setNewItem(f => ({ ...f, low_threshold: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Critical Alert at</label>
                  <input type="number" className="form-input" value={newItem.critical_threshold}
                    onChange={e => setNewItem(f => ({ ...f, critical_threshold: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddItem(false)} className="btn btn-gray">Cancel</button>
              <button onClick={handleAddItem} className="btn btn-primary"><i className="fas fa-plus" /> Add Item</button>
            </div>
          </motion.div>
        </div>
      )}

      {showAddCat && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddCat(false)}>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="modal-box">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Add Category</h3>
              <button onClick={() => setShowAddCat(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input className="form-input" value={newCat.name}
                  onChange={e => setNewCat(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Baby Care" autoFocus />
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
              <button onClick={handleAddCat} className="btn btn-primary"><i className="fas fa-plus" /> Add</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
