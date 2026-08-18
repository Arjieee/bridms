import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { fuzzyMatch } from '../../utils/fuzzySearch'
import { exportToCsv } from '../../utils/csvExport'
import toast from 'react-hot-toast'

const blankItem = () => ({ item_name: '', quantity: '', unit: '' })
const DONOR_TYPES = ['Government Agency', 'NGO', 'Private Donor', 'LGU', 'Church/Religious', 'Other']

export default function AdminSuppliers() {
  const { suppliers, addSupplier } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState({
    org_name: '',
    contact_person: '',
    contact_num: '',
    donation_date: new Date().toISOString().split('T')[0],
    donor_type: 'Government Agency',
    items: [blankItem()],
  })

  const updateItem = (i, k, v) =>
    setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }))

  const handleAdd = async () => {
    if (!form.org_name || !form.contact_person) {
      toast.error('Organization and contact person required.')
      return
    }
    if (form.items.length === 0 || form.items.every(i => !i.item_name)) {
      toast.error('Add at least one donated item.')
      return
    }
    const res = await addSupplier({
      ...form,
      items: form.items.filter(i => i.item_name),
    })
    if (res?.ok) {
      toast.success(`"${form.org_name}" recorded. Pending inventory restock task created!`)
      setShowAdd(false)
      setForm({
        org_name: '',
        contact_person: '',
        contact_num: '',
        donation_date: new Date().toISOString().split('T')[0],
        donor_type: 'Government Agency',
        items: [blankItem()],
      })
    } else {
      toast.error(res?.message || 'Failed to add supplier.')
    }
  }

  const filteredSuppliers = suppliers.filter(s => {
    if (searchQuery) {
      const itemsStr = (s.items || []).map(i => `${i.item_name} ${i.quantity}${i.unit || ''}`).join(' ')
      const targetFields = [s.org_name, s.contact_person, s.contact_num, s.donor_type, itemsStr]
      if (!fuzzyMatch(targetFields, searchQuery)) return false
    }
    return true
  })

  const handleExportCSV = () => {
    const headers = [
      { label: 'Organization / Supplier', key: 'org_name' },
      { label: 'Contact Person', key: 'contact_person' },
      { label: 'Contact Number', key: 'contact_num' },
      { label: 'Donor Type', key: 'donor_type' },
      { label: 'Donation Date', key: 'donation_date' },
      { label: 'Donated Goods & Quantities', key: 'items_summary' },
      { label: 'Fulfillment Status', key: 'status' },
    ]
    const rows = filteredSuppliers.map(s => {
      const itemsSummary = (s.items || []).map(i => `${i.item_name} (${i.quantity} ${i.unit || ''})`).join('; ')
      const allFulfilled = (s.items || []).every(i => i.is_fulfilled)
      return {
        org_name: s.org_name,
        contact_person: s.contact_person,
        contact_num: s.contact_num || 'N/A',
        donor_type: s.donor_type || 'General Donor',
        donation_date: s.donation_date || 'N/A',
        items_summary: itemsSummary || 'No items listed',
        status: allFulfilled ? 'Stocked in Inventory' : 'Pending Intake',
      }
    })
    exportToCsv('Suppliers_Donations', headers, rows)
  }

  return (
    <div className="confidential">
      <div className="section-header mb-5 no-print">
        <div>
          <div className="section-sub">{filteredSuppliers.length} record{filteredSuppliers.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative min-w-[160px] sm:min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search donor or item..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input text-xs pl-8 py-1.5 w-full rounded-xl bg-white border-slate-200"
            />
          </div>
          <button onClick={handleExportCSV} className="btn btn-gray btn-sm cursor-pointer" title="Export Donations to CSV">
            <i className="fas fa-file-csv text-emerald-600 text-sm" /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button onClick={() => window.print()} className="btn btn-outline btn-sm">
            <i className="fas fa-print" /> <span className="hidden sm:inline">Print</span>
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">
            <i className="fas fa-plus" /> <span className="hidden sm:inline">Add Donor</span>
          </button>
        </div>
      </div>

      <div className="print-centered">
        <div className="hidden print:block mb-6">
          <div className="text-center">
            <div className="font-display font-extrabold text-2xl text-navy">Barangay Puerto</div>
            <div className="text-sm text-slate-600">Suppliers & Donors Report</div>
            <div className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}</div>
          </div>
          <hr className="my-4 border-slate-300" />
        </div>

        {filteredSuppliers.length === 0 && (
          <div className="card p-10 text-center text-slate-400">
            <i className="fas fa-handshake text-4xl mb-3 block text-slate-300" />
            <div className="text-sm font-semibold">No donor or supplier records found</div>
            <div className="text-xs mt-1">Try refining your search query or click "Add Donor".</div>
          </div>
        )}

        <div className="space-y-3">
          {filteredSuppliers.map(s => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm text-navy">{s.org_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.contact_person} · {s.contact_num}</div>
                  <div className="text-[11px] text-slate-400">
                    <i className="fas fa-calendar mr-1" />{s.donation_date}
                  </div>
                </div>
                <span className="badge badge-approved flex-shrink-0">{s.donor_type}</span>
              </div>
              {s.items?.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">Donated Items</div>
                  {s.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-b-0">
                      <span className="text-navy font-medium">{item.item_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs font-semibold">{item.quantity} {item.unit}</span>
                        <span className={`badge ${item.fulfilled ? 'badge-approved' : 'badge-pending'}`}>
                          {item.fulfilled ? 'Restocked' : 'Pending Inventory'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="modal-box lg">
            <div className="modal-header">
              <h3 className="font-display font-bold text-base text-navy">Record Supplier / Donor</h3>
              <button onClick={() => setShowAdd(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div className="form-group">
                <label className="form-label">Organization / Donor Name *</label>
                <input className="form-input" value={form.org_name}
                  onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
                  placeholder="e.g. DSWD Region 10" autoFocus />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Contact Person *</label>
                  <input className="form-input" value={form.contact_person}
                    onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number</label>
                  <input className="form-input" value={form.contact_num}
                    onChange={e => setForm(f => ({ ...f, contact_num: e.target.value }))}
                    placeholder="09XXXXXXXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Donation Date</label>
                  <input type="date" className="form-input" value={form.donation_date}
                    onChange={e => setForm(f => ({ ...f, donation_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Donor Type</label>
                  <select className="form-input" value={form.donor_type}
                    onChange={e => setForm(f => ({ ...f, donor_type: e.target.value }))}>
                    {DONOR_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Donated Items</label>
                  <button onClick={() => setForm(f => ({ ...f, items: [...f.items, blankItem()] }))}
                    className="btn btn-outline btn-xs">
                    <i className="fas fa-plus" /> Add
                  </button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <input className="form-input flex-1" value={item.item_name}
                      onChange={e => updateItem(i, 'item_name', e.target.value)}
                      placeholder="Item name" />
                    <input type="number" className="form-input w-20" value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" />
                    <input className="form-input w-20" value={item.unit}
                      onChange={e => updateItem(i, 'unit', e.target.value)} placeholder="Unit" />
                    {form.items.length > 1 && (
                      <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}
                        className="text-red-400 hover:text-red-600 px-2">
                        <i className="fas fa-trash text-sm" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                <i className="fas fa-circle-info mr-1" />
                Saving sends a reminder to admins to update inventory. Items are NOT automatically added.
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAdd(false)} className="btn btn-gray">Cancel</button>
              <button onClick={handleAdd} className="btn btn-primary">
                <i className="fas fa-save" /> Save Record
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
