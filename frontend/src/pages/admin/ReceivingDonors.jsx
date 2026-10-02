import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import toast from 'react-hot-toast'

const COMMON_UOMS = [
  'sacks',
  'cans',
  'boxes',
  'packs',
  'kg',
  'pcs',
  'bottles',
  'bundles',
  'tins',
  'cartons',
]

const DONOR_TYPES = [
  { value: 'organization', label: 'Organization / Corporate', color: 'bg-blue-100 text-blue-700' },
  { value: 'individual',   label: 'Private Donor / Individual', color: 'bg-purple-100 text-purple-700' },
  { value: 'government',   label: 'Government Agency', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'ngo',          label: 'NGO / Charity', color: 'bg-amber-100 text-amber-700' },
  { value: 'supplier',     label: 'Supplier / Partner', color: 'bg-rose-100 text-rose-700' },
]

export default function ReceivingDonors() {
  const { inventory, categories, donors, suppliers, receivings, searchDonors, createReceiving, fetchReceivings } = useAppStore()

  // Form State
  const [donorQuery, setDonorQuery] = useState('')
  const [selectedDonor, setSelectedDonor] = useState(null)
  const [donorType, setDonorType] = useState('organization')
  const [contactPerson, setContactPerson] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [notes, setNotes] = useState('')

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Items to receive: [{ item_name: '', category_id: '', quantity: '', uom: 'pcs', remarks: '' }]
  const [items, setItems] = useState([
    { item_name: '', category_id: '', quantity: '', uom: 'pcs', remarks: '' }
  ])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchHistory, setSearchHistory] = useState('')
  const [selectedBatch, setSelectedBatch] = useState(null)

  // Available donors pool for instant suggestions
  const allDonorsPool = (donors && donors.length > 0) ? donors : (suppliers || [])

  // Real-time donor search suggestions (Google Search-like autocomplete)
  useEffect(() => {
    if (!donorQuery.trim()) {
      setSuggestions(allDonorsPool.slice(0, 10))
      return
    }

    const timer = setTimeout(async () => {
      const results = await searchDonors(donorQuery)
      if (results && results.length > 0) {
        setSuggestions(results)
      } else {
        // Fallback local search against store donors
        const term = donorQuery.toLowerCase().trim()
        const matched = allDonorsPool.filter(d => 
          (d.name || d.org_name || '').toLowerCase().includes(term) ||
          (d.contact_person || '').toLowerCase().includes(term) ||
          (d.donor_type || '').toLowerCase().includes(term)
        )
        setSuggestions(matched)
      }
      setShowDropdown(true)
    }, 120)

    return () => clearTimeout(timer)
  }, [donorQuery, searchDonors, allDonorsPool])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectDonor = (d) => {
    setSelectedDonor(d)
    const donorName = d.name || d.org_name || ''
    setDonorQuery(donorName)
    setDonorType(d.donor_type || 'organization')
    setContactPerson(d.contact_person || '')
    setContactNumber(d.contact_number || d.contact_num || '')
    if (d.email) setDonorEmail(d.email)
    setShowDropdown(false)
    toast.success(`Selected donor: "${donorName}"`)
  }

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { item_name: '', category_id: '', quantity: '', uom: 'pcs', remarks: '' }
    ])
  }

  const removeItemRow = (index) => {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const donorNameClean = donorQuery.trim()
    if (!donorNameClean) {
      toast.error('Please search and select or enter a Donor / Organization name.')
      return
    }

    // Validate items
    const validItems = items.filter(
      (it) => it.item_name.trim() && parseFloat(it.quantity) > 0
    )

    if (validItems.length === 0) {
      toast.error('Please provide at least one item with a valid name and quantity.')
      return
    }

    // MANDATORY REQUIREMENT: Identify Category before saving
    for (const it of validItems) {
      if (!it.category_id) {
        toast.error(`Please select a Category for "${it.item_name}" before saving.`)
        return
      }
    }

    setIsSubmitting(true)
    const payload = {
      donor_id: selectedDonor ? selectedDonor.id : undefined,
      donor_name: donorNameClean,
      donor_type: donorType,
      contact_person: contactPerson.trim() || undefined,
      contact_number: contactNumber.trim() || undefined,
      email: donorEmail.trim() || undefined,
      items: validItems.map((it) => ({
        item_name: it.item_name.trim(),
        category_id: Number(it.category_id),
        quantity: parseFloat(it.quantity),
        uom: it.uom.trim() || 'pcs',
        remarks: it.remarks?.trim() || undefined,
      })),
      notes: notes.trim() || undefined,
    }

    const res = await createReceiving(payload)
    setIsSubmitting(false)

    if (res.ok) {
      toast.success(res.message || 'Donation received and inventory restocked successfully! 🎉')
      // Reset form
      setDonorQuery('')
      setSelectedDonor(null)
      setDonorType('organization')
      setContactPerson('')
      setContactNumber('')
      setDonorEmail('')
      setNotes('')
      setItems([{ item_name: '', category_id: '', quantity: '', uom: 'pcs', remarks: '' }])
      fetchReceivings()
    } else {
      toast.error(res.message || 'Failed to record donation receiving.')
    }
  }

  // Filtered receiving batches
  const filteredReceivings = (receivings || []).filter((r) => {
    if (!searchHistory.trim()) return true
    const term = searchHistory.toLowerCase()
    const donorMatch = r.donor?.name?.toLowerCase().includes(term)
    const codeMatch = r.receive_code?.toLowerCase().includes(term)
    const itemMatch = (r.items || []).some((it) =>
      it.item_name?.toLowerCase().includes(term)
    )
    return donorMatch || codeMatch || itemMatch
  })

  return (
    <div className="space-y-6">


      {/* Main Receiving Form Card */}
      <div className="card p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i className="fas fa-hand-holding-heart text-base" />
            </div>
            <div>
              <div className="font-display font-bold text-base text-navy uppercase tracking-wide">
                Incoming Donation Intake
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Top Field: ORG NAME / DONOR with Autocomplete Search Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <label className="form-label text-xs font-bold text-navy flex items-center justify-between mb-1.5">
              <span>
                <i className="fas fa-search text-blue-500 mr-1.5" />
                SEARCH DONOR / ORGANIZATION <span className="text-red-500">*</span>
              </span>
              {selectedDonor && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDonor(null)
                    setDonorQuery('')
                    setContactPerson('')
                    setContactNumber('')
                  }}
                  className="text-[11px] text-blue-600 hover:underline font-normal"
                >
                  <i className="fas fa-rotate-left mr-1" />Clear Selection
                </button>
              )}
            </label>

            <div className="relative">
              <input
                type="text"
                className="form-input text-sm font-semibold text-navy pr-10 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Type or search donor (e.g. Red Cross, DSWD, Mayor's Office)..."
                value={donorQuery}
                onChange={(e) => {
                  setDonorQuery(e.target.value)
                  setSelectedDonor(null)
                  setShowDropdown(true)
                }}
                onFocus={() => {
                  setSuggestions(donorQuery.trim() ? suggestions : allDonorsPool.slice(0, 10))
                  setShowDropdown(true)
                }}
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <i className="fas fa-search text-xs" />
              </div>
            </div>

            {/* Live Autocomplete Suggestions Dropdown */}
            <AnimatePresence>
              {showDropdown && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto"
                >
                  <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Registered Donors ({suggestions.length})</span>
                    <span className="text-[9px] font-normal text-slate-400">Click to select</span>
                  </div>
                  {suggestions.map((d) => {
                    const dName = d.name || d.org_name || 'Donor'
                    const dCode = d.donor_code || ''
                    const dContact = d.contact_person || ''
                    const dPhone = d.contact_number || d.contact_num || ''
                    const dType = d.donor_type || 'organization'

                    return (
                      <div
                        key={d.id || dName}
                        onClick={() => handleSelectDonor(d)}
                        className="px-4 py-2.5 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-navy truncate flex items-center gap-2">
                            <span>{dName}</span>
                            {dCode && <span className="text-[10px] text-slate-400 font-mono">({dCode})</span>}
                          </div>
                          {dContact && (
                            <div className="text-[11px] text-slate-400 truncate">
                              Contact: {dContact} {dPhone ? `· ${dPhone}` : ''}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize bg-slate-100 text-slate-600">
                          {dType}
                        </span>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Notice when entering a new unregistered donor */}
            {!selectedDonor && donorQuery.trim() && suggestions.length === 0 && (
              <div className="mt-1 text-[11px] text-blue-600 flex items-center gap-1.5">
                <i className="fas fa-plus-circle" />
                <span>New donor will be recorded as <strong>"{donorQuery.trim()}"</strong></span>
              </div>
            )}
          </div>

          {/* Selected Donor Information Display / Edit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
            <div>
              <label className="form-label text-[11px] text-slate-500 mb-1">Donor Type</label>
              <select
                className="form-select text-xs py-1.5"
                value={donorType}
                onChange={(e) => setDonorType(e.target.value)}
              >
                {DONOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label text-[11px] text-slate-500 mb-1">Contact Person</label>
              <input
                type="text"
                className="form-input text-xs py-1.5"
                placeholder="e.g. Maria Santos"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label text-[11px] text-slate-500 mb-1">Contact Number</label>
              <input
                type="text"
                className="form-input text-xs py-1.5"
                placeholder="e.g. 0917XXXXXXX"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Items Entry Grid with MANDATORY CATEGORY SELECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="form-label text-xs font-bold text-navy mb-0 flex items-center gap-1.5">
                  <i className="fas fa-boxes-stacked text-blue-500" />
                  Donated Items to Restock <span className="text-red-500">*</span>
                </label>
                <div className="text-[11px] text-slate-400">
                  Select item category, name, and quantity before saving
                </div>
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1.5 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200"
              >
                <i className="fas fa-plus" /> Add Item
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2.5 items-center p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/70 hover:border-blue-300 transition-colors"
                >
                  {/* Category Selector (Mandatory) */}
                  <div className="col-span-12 sm:col-span-3">
                    <label className="text-[10px] font-bold text-navy uppercase mb-1 block">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={`form-select text-xs py-2 w-full font-semibold ${
                        !row.category_id ? 'border-amber-400 bg-amber-50/40 text-amber-900' : 'text-navy'
                      }`}
                      value={row.category_id}
                      onChange={(e) => handleItemChange(idx, 'category_id', e.target.value)}
                      required
                    >
                      <option value="">-- Choose Category --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Item Name */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="text-[10px] font-bold text-navy uppercase mb-1 block">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input text-xs py-2"
                      placeholder="e.g. Canned Sardines, Rice, Blanket..."
                      list={`inv-list-${idx}`}
                      value={row.item_name}
                      onChange={(e) => {
                        const val = e.target.value
                        handleItemChange(idx, 'item_name', val)
                        // If matching an existing inventory item, auto-select category
                        const matched = inventory.find(
                          (i) => i.name.toLowerCase() === val.trim().toLowerCase()
                        )
                        if (matched) {
                          if (matched.category_id && !row.category_id) {
                            handleItemChange(idx, 'category_id', matched.category_id)
                          }
                          if (matched.unit && !row.uom) {
                            handleItemChange(idx, 'uom', matched.unit)
                          }
                        }
                      }}
                      required
                    />
                    <datalist id={`inv-list-${idx}`}>
                      {inventory.map((inv) => {
                        const cat = categories.find((c) => c.id === inv.category_id)
                        return (
                          <option key={inv.id} value={inv.name}>
                            {`${inv.name} [${inv.unit}] (${inv.quantity} ${inv.unit} in stock - ${cat?.name || 'General'})`}
                          </option>
                        )
                      })}
                    </datalist>

                    {/* Quick UOM helper chips if this item already exists in inventory with one or more units */}
                    {row.item_name.trim() && (
                      (() => {
                        const matches = inventory.filter(
                          (i) => i.name.toLowerCase() === row.item_name.trim().toLowerCase()
                        )
                        if (matches.length === 0) return null
                        return (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-semibold">Existing UOM:</span>
                            {matches.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  handleItemChange(idx, 'uom', m.unit)
                                  if (m.category_id) handleItemChange(idx, 'category_id', m.category_id)
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                  row.uom?.toLowerCase() === m.unit?.toLowerCase()
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                                }`}
                                title={`Click to use ${m.unit} (${m.quantity} currently in stock)`}
                              >
                                {m.unit} ({m.quantity})
                              </button>
                            ))}
                          </div>
                        )
                      })()
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="col-span-6 sm:col-span-2">
                    <label className="text-[10px] font-bold text-navy uppercase mb-1 block">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      className="form-input text-xs py-2 font-bold text-navy"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      required
                    />
                  </div>

                  {/* UOM - Unit of Measure */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] font-bold text-navy uppercase mb-1 block">
                      UOM <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input text-xs py-2"
                      placeholder="Unit"
                      list={`uom-list-${idx}`}
                      value={row.uom}
                      onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                      required
                    />
                    <datalist id={`uom-list-${idx}`}>
                      {COMMON_UOMS.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </div>

                  {/* Delete button */}
                  <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-end">
                    <label className="text-[10px] text-transparent select-none mb-1 block">X</label>
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      disabled={items.length === 1}
                      title="Remove Row"
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <i className="fas fa-trash-can text-xs" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes / Remarks Field */}
          <div>
            <label className="form-label text-xs text-slate-500 mb-1">
              Notes / Donation Memo (Optional)
            </label>
            <input
              type="text"
              className="form-input text-xs"
              placeholder="e.g. Typhoon relief donation batch, official turnover memo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Form Actions: Bottom-right [SAVE] button */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="text-[11px] text-slate-400">
              * Required fields
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary px-7 py-2.5 font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-floppy-disk" /> SAVE RECEIVING RECORD
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Recent Receiving Transactions Table */}
      <div className="card p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display font-bold text-base text-navy">Recent Receiving Batches</h2>
          </div>
          <div className="relative w-full sm:w-64">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              className="form-input text-xs pl-8 py-1.5"
              placeholder="Search donor or item..."
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredReceivings.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <i className="fas fa-box-open text-3xl mb-2 block text-slate-300" />
              <div className="text-sm">No receiving records found</div>
            </div>
          ) : (
            <table className="tbl w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500 font-bold uppercase">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Batch Code</th>
                  <th className="py-3 px-4">Donor / Supplier</th>
                  <th className="py-3 px-4">Items Received</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredReceivings.map((batch) => {
                  const donor = batch.donor
                  const dateStr = new Date(batch.date || batch.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {batch.receive_code}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-navy">{donor?.name || 'Anonymous Donor'}</div>
                        <span className="text-[10px] text-slate-400 capitalize">
                          {donor?.donor_type || 'organization'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {(batch.items || []).slice(0, 2).map((it, idx) => (
                            <span
                              key={idx}
                              className="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-navy text-[11px]"
                            >
                              +{it.quantity} {it.uom} {it.item_name}
                            </span>
                          ))}
                          {(batch.items || []).length > 2 && (
                            <span className="text-[10px] text-slate-400">
                              +{(batch.items || []).length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {batch.received_by || 'Staff'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedBatch(batch)}
                          className="btn btn-outline btn-xs px-2.5"
                          title="View Details"
                        >
                          <i className="fas fa-eye mr-1" /> View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Batch Details Modal */}
      {selectedBatch && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSelectedBatch(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="card p-6 w-full max-w-lg bg-white rounded-2xl shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-mono font-bold text-blue-600">
                  {selectedBatch.receive_code}
                </div>
                <div className="font-display font-bold text-lg text-navy">Donation Receipt</div>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-navy hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="fas fa-xmark text-sm" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl">
              <div>
                <div className="text-slate-400 font-semibold mb-0.5">Donor / Organization</div>
                <div className="font-bold text-navy">{selectedBatch.donor?.name || 'N/A'}</div>
                <div className="text-[11px] text-slate-500 capitalize">
                  {selectedBatch.donor?.donor_type}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold mb-0.5">Date Received</div>
                <div className="font-bold text-navy">
                  {new Date(selectedBatch.date || selectedBatch.created_at).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500">By: {selectedBatch.received_by}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-navy mb-2">Items Received & Restocked</div>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                      <th className="py-2 px-3 text-right">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedBatch.items || []).map((it, i) => {
                      const cat = categories.find((c) => c.id === it.category_id)
                      return (
                        <tr key={i}>
                          <td className="py-2 px-3 font-semibold text-navy">{it.item_name}</td>
                          <td className="py-2 px-3 text-slate-500">{cat?.name || 'General'}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600">
                            +{it.quantity}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500">{it.uom}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedBatch.notes && (
              <div className="text-xs p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-900">
                <strong>Notes:</strong> {selectedBatch.notes}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedBatch(null)} className="btn btn-gray btn-sm">
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
