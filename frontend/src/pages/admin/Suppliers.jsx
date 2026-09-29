import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { fuzzyMatch } from '../../utils/fuzzySearch'
import { exportToCsv } from '../../utils/csvExport'
import toast from 'react-hot-toast'

const DONOR_TYPES = [
  'Government Agency',
  'NGO / Charity',
  'Private Donor / Individual',
  'Organization / Corporate',
  'Religious / Church',
  'Supplier / Partner',
]

export default function AdminSuppliers() {
  const { suppliers, addSupplier } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    org_name: '',
    contact_person: '',
    contact_number: '',
    donation_date: new Date().toISOString().split('T')[0],
    donor_type: 'Government Agency',
  })

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.org_name.trim()) {
      toast.error('Organization / Donor Name is required.')
      return
    }
    if (!form.contact_person.trim()) {
      toast.error('Contact Person is required.')
      return
    }

    setIsSubmitting(true)
    const res = await addSupplier({
      org_name: form.org_name.trim(),
      contact_person: form.contact_person.trim(),
      contact_number: form.contact_number.trim(),
      donation_date: form.donation_date,
      donor_type: form.donor_type,
    })
    setIsSubmitting(false)

    if (res?.ok) {
      toast.success(`Donor "${form.org_name}" recorded successfully! 🎉`)
      setShowAdd(false)
      setForm({
        org_name: '',
        contact_person: '',
        contact_number: '',
        donation_date: new Date().toISOString().split('T')[0],
        donor_type: 'Government Agency',
      })
    } else {
      toast.error(res?.message || 'Failed to add donor.')
    }
  }

  const filteredSuppliers = (suppliers || []).filter(s => {
    if (searchQuery) {
      const targetFields = [
        s.org_name || s.name,
        s.contact_person,
        s.contact_number || s.contact_num,
        s.donor_type,
        s.donation_date,
        s.donor_code,
      ]
      if (!fuzzyMatch(targetFields, searchQuery)) return false
    }
    return true
  })

  const handleExportCSV = () => {
    const headers = [
      { label: 'Organization / Donor Name', key: 'org_name' },
      { label: 'Contact Person',            key: 'contact_person' },
      { label: 'Contact Number',            key: 'contact_number' },
      { label: 'Donation Date',             key: 'donation_date' },
      { label: 'Donor Type',                key: 'donor_type' },
    ]
    const rows = filteredSuppliers.map(s => ({
      org_name: s.org_name || s.name,
      contact_person: s.contact_person || 'N/A',
      contact_number: s.contact_number || s.contact_num || 'N/A',
      donation_date: s.donation_date || 'N/A',
      donor_type: s.donor_type || 'General Donor',
    }))
    exportToCsv('Donors_Directory', headers, rows)
  }

  const getBadgeClass = (type = '') => {
    const t = type.toLowerCase()
    if (t.includes('gov')) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (t.includes('ngo') || t.includes('charity')) return 'bg-amber-100 text-amber-800 border-amber-200'
    if (t.includes('private') || t.includes('indiv')) return 'bg-purple-100 text-purple-800 border-purple-200'
    if (t.includes('supp') || t.includes('partner')) return 'bg-rose-100 text-rose-800 border-rose-200'
    if (t.includes('relig') || t.includes('church')) return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }

  return (
    <div className="confidential space-y-5">
      {/* Top Header & Actions */}
      <div className="section-header mb-5 no-print">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy">Suppliers & Donors Directory</h1>
          <div className="section-sub">
            {filteredSuppliers.length} registered donor{filteredSuppliers.length !== 1 ? 's' : ''} (Information Only)
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative min-w-[180px] sm:min-w-[220px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search donor name, contact, type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input text-xs pl-8 py-2 w-full rounded-xl bg-white border-slate-200"
            />
          </div>
          <button onClick={handleExportCSV} className="btn btn-gray btn-sm cursor-pointer" title="Export Donors to CSV">
            <i className="fas fa-file-csv text-emerald-600 text-sm" /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="btn btn-outline btn-sm flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Preview and print official donors directory"
          >
            <i className="fas fa-print" /> <span className="hidden sm:inline">Print</span>
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm">
            <i className="fas fa-user-plus" /> <span>Add Donor</span>
          </button>
        </div>
      </div>

      {/* Info Notice Banner */}
      <div className="no-print p-3.5 bg-blue-50/80 rounded-xl border border-blue-200/80 flex items-center justify-between text-xs text-blue-900">
        <div className="flex items-center gap-2.5">
          <i className="fas fa-circle-info text-blue-600 text-sm" />
          <span>
            This module displays <strong>donors information only</strong>. To record incoming relief goods or donated items, please use the <strong>Receiving Donors</strong> module.
          </span>
        </div>
        <a href="/admin/receiving" className="font-bold text-blue-700 hover:text-blue-900 underline whitespace-nowrap hidden md:inline-block">
          Go to Receiving Donors <i className="fas fa-arrow-right ml-1" />
        </a>
      </div>

      {/* Donors Content Section */}
      <div>
        {/* Empty State */}
        {filteredSuppliers.length === 0 && (
          <div className="card p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <i className="fas fa-handshake text-4xl mb-3 block text-slate-300" />
            <div className="text-sm font-semibold text-slate-600">No donor or supplier records found</div>
            <div className="text-xs text-slate-400 mt-1">Try refining your search query or click "Add Donor" to register one.</div>
          </div>
        )}

        {/* Donors List (Showing ONLY: Org Name, Contact Person, Contact Number, Donation Date, Donor Type) */}
        {filteredSuppliers.length > 0 && (
          <div className="card overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="overflow-x-auto">
              <table className="tbl w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500 font-bold uppercase">
                    <th className="py-3.5 px-5">Organization / Donor Name</th>
                    <th className="py-3.5 px-4">Contact Person</th>
                    <th className="py-3.5 px-4">Contact Number</th>
                    <th className="py-3.5 px-4">Donation Date</th>
                    <th className="py-3.5 px-4">Donor Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSuppliers.map(s => {
                    const name = s.org_name || s.name
                    const phone = s.contact_number || s.contact_num || 'N/A'
                    const contact = s.contact_person || 'N/A'
                    const date = s.donation_date || 'N/A'
                    const type = s.donor_type || 'Organization'

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-display font-bold text-sm text-navy flex items-center gap-2">
                            <span>{name}</span>
                            {s.donor_code && (
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                {s.donor_code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <i className="fas fa-user text-slate-400 text-[10px]" />
                            <span>{contact}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <i className="fas fa-phone text-slate-400 text-[10px]" />
                            <span>{phone}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <i className="fas fa-calendar-day text-slate-400 text-[10px]" />
                            <span>{date}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${getBadgeClass(type)}`}>
                            {type}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Donor Modal (Strictly Donors Info Only: Org Name, Contact Person, Contact Number, Donation Date, Donor Type) */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <i className="fas fa-handshake" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-navy">Record Supplier / Donor</h3>
                  <p className="text-[11px] text-slate-400">Save donor details in the directory</p>
                </div>
              </div>
              <button onClick={() => setShowAdd(false)} className="btn btn-gray btn-xs">
                <i className="fas fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="modal-body space-y-3.5">
                <div className="form-group">
                  <label className="form-label text-xs font-bold text-navy">
                    Organization / Donor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="form-input text-xs"
                    value={form.org_name}
                    onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
                    placeholder="e.g. Philippine Red Cross, DSWD, Mayor's Office"
                    autoFocus
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label text-xs font-bold text-navy">
                      Contact Person <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="form-input text-xs"
                      value={form.contact_person}
                      onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                      placeholder="e.g. Maria Santos"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs font-bold text-navy">Contact Number</label>
                    <input
                      className="form-input text-xs"
                      value={form.contact_number}
                      onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))}
                      placeholder="09XXXXXXXXX"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label text-xs font-bold text-navy">Donation Date</label>
                    <input
                      type="date"
                      className="form-input text-xs"
                      value={form.donation_date}
                      onChange={e => setForm(f => ({ ...f, donation_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs font-bold text-navy">Donor Type</label>
                    <select
                      className="form-input text-xs"
                      value={form.donor_type}
                      onChange={e => setForm(f => ({ ...f, donor_type: e.target.value }))}
                    >
                      {DONOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/70 text-[11px] text-blue-900 flex items-start gap-2">
                  <i className="fas fa-circle-info mt-0.5 text-blue-600" />
                  <div>
                    This registers the donor in the directory. Items/goods will be added and restocked into inventory via the <strong>Receiving Donors</strong> module.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-gray">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary flex items-center gap-1.5">
                  {isSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save" /> Save Donor Record
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <SuppliersPrintPreviewModal
          suppliers={filteredSuppliers}
          searchQuery={searchQuery}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  )
}

/**
 * Printable Suppliers & Donors Directory Modal
 */
function SuppliersPrintPreviewModal({ suppliers, searchQuery, onClose }) {
  if (!suppliers) return null

  const handlePrint = () => {
    window.print()
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

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
        <div id="suppliers-directory-printable" className="space-y-4 text-slate-800">
          {/* Header */}
          <div className="text-center border-b pb-4 border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Republic of the Philippines · City of Cagayan de Oro
            </div>
            <div className="text-lg font-black text-navy uppercase tracking-tight mt-0.5">
              Barangay Puerto Disaster Risk Reduction &amp; Relief Operations
            </div>
            <div className="inline-block mt-2 px-3.5 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-blue-800 font-bold text-xs uppercase tracking-wide">
              Official Suppliers &amp; Donors Directory
            </div>
          </div>

          {/* Reference Meta Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Date Generated</div>
                <div className="font-bold text-slate-800 text-xs mt-0.5">{currentDate}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Donors Listed</div>
                <div className="font-mono font-black text-navy text-sm mt-0.5">{suppliers.length} Records</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Registry Scope</div>
                <div className="font-bold text-blue-700 text-xs mt-0.5 truncate">
                  {searchQuery ? `Filtered: "${searchQuery}"` : 'Official Complete Registry'}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 flex items-center justify-between">
              <span>Registered Donors &amp; Partner Suppliers</span>
              <span className="text-slate-500 font-semibold text-[10px] normal-case">
                {suppliers.length} {suppliers.length === 1 ? 'record' : 'records'} total
              </span>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">Organization / Donor Name</th>
                  <th className="py-2.5 px-3">Contact Person</th>
                  <th className="py-2.5 px-3">Contact Number</th>
                  <th className="py-2.5 px-3">Donation Date</th>
                  <th className="py-2.5 px-3">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.length > 0 ? (
                  suppliers.map((s, idx) => (
                    <tr key={s.id || idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-navy text-xs">
                        {s.org_name || s.name}
                        {s.donor_code && (
                          <span className="ml-1.5 text-[9px] text-slate-500 font-mono bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                            {s.donor_code}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium text-xs">
                        {s.contact_person || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono text-xs">
                        {s.contact_number || s.contact_num || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 text-xs whitespace-nowrap">
                        {s.donation_date || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {s.donor_type || 'General'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 px-3 text-center text-slate-500 italic">
                      No supplier or donor records found to print.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Signature Sign-offs */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 pb-1 h-8" />
              <div className="font-bold text-navy mt-1.5">Prepared By</div>
              <div className="text-[10px] text-slate-500">Logistics &amp; Relief Records Custodian</div>
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
            <i className="fas fa-file-shield text-blue-500" />
            <span>Official Barangay Relief Administration Document</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-outline btn-sm px-3.5 flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer font-semibold shadow-2xs"
            >
              <i className="fas fa-print" /> Print Directory
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
