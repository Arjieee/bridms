import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bar, Line, Pie } from 'react-chartjs-2'
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import { useAppStore } from '../../store/appStore'

Chart.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend)

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function AdminDashboard() {
  const { households, inventory, distributions, cycles, qrCodes, puroks, sectors } = useAppStore()
  const [distFilter, setDistFilter] = useState('purok')
  const [chartType, setChartType] = useState('bar') // 'bar' | 'line'

  const [chartMode, setChartMode] = useState('year') // 'year' | 'specific_year' | 'month' | 'custom'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()])
    distributions.forEach(d => {
      if (d.dist_date) {
        const y = new Date(d.dist_date).getFullYear()
        if (y) years.add(y)
      }
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [distributions])

  const getCycleStatus = (c) => {
    if (!c) return 'Ended'
    const cQRs = (qrCodes || []).filter((q) => q.cycle_id === c.id)
    const totalQRs = cQRs.length
    const claimedQRs = cQRs.filter((q) => q.is_claimed).length
    const isCompleted = totalQRs > 0 && claimedQRs === totalQRs
    if (isCompleted) return 'Completed'
    if (c.is_active) return 'Active'
    return 'Ended'
  }

  const activeCycle = cycles.find(c => c.is_active && getCycleStatus(c) === 'Active')
  const totalStock = inventory.reduce((sum, i) => sum + i.quantity, 0)
  const today = new Date().toISOString().split('T')[0]
  const todayDists = distributions.filter(d => d.dist_date === today).length
  const lowStock = inventory.filter(i => i.quantity <= i.low_threshold).length
  // Active cycle progress
  const activeCycleQRs = activeCycle ? qrCodes.filter(q => q.cycle_id === activeCycle.id) : []
  const activeClaimed = activeCycleQRs.filter(q => q.is_claimed).length
  const activeProgress = activeCycleQRs.length > 0
    ? `${activeClaimed}/${activeCycleQRs.length}`
    : todayDists.toString()

  const barData = useMemo(() => {
    const thisYear = new Date().getFullYear()

    let labels = []
    let counts = []
    let datasetLabel = 'Distributions'

    if (chartMode === 'year') {
      const allCounts = Array(12).fill(0)
      distributions.forEach(d => {
        const date = new Date(d.dist_date)
        if (date.getFullYear() === thisYear) allCounts[date.getMonth()]++
      })
      let lastWithData = -1
      allCounts.forEach((c, i) => { if (c > 0) lastWithData = i })
      const currentMonth = new Date().getMonth()
      const lastMonthIdx = Math.max(currentMonth, lastWithData)
      labels = MONTHS.slice(0, lastMonthIdx + 1)
      counts = allCounts.slice(0, lastMonthIdx + 1)
      datasetLabel = `${thisYear} Distributions`
    } else if (chartMode === 'specific_year') {
      const y = Number(selectedYear)
      const allCounts = Array(12).fill(0)
      distributions.forEach(d => {
        const date = new Date(d.dist_date)
        if (date.getFullYear() === y) allCounts[date.getMonth()]++
      })
      labels = MONTHS
      counts = allCounts
      datasetLabel = `${y} Distributions`
    } else if (chartMode === 'month') {
      const m = Number(selectedMonth)
      const daysInMonth = new Date(thisYear, m + 1, 0).getDate()
      const allCounts = Array(daysInMonth).fill(0)

      distributions.forEach(d => {
        const date = new Date(d.dist_date)
        if (date.getFullYear() === thisYear && date.getMonth() === m) {
          const day = date.getDate() - 1
          if (day >= 0 && day < daysInMonth) allCounts[day]++
        }
      })

      labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`)
      counts = allCounts
      datasetLabel = `${MONTHS[m]} Distributions`
    } else {
      if (!startDate || !endDate || startDate > endDate) {
        labels = []
        counts = []
      } else {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const dates = []
        const dateCounts = []
        const curr = new Date(start)

        while (curr <= end) {
          const dateStr = curr.toISOString().split('T')[0]
          dates.push(dateStr)
          const count = distributions.filter(d => d.dist_date === dateStr).length
          dateCounts.push(count)
          curr.setDate(curr.getDate() + 1)
        }

        labels = dates.map(d => {
          const parts = d.split('-')
          return `${parts[1]}/${parts[2]}`
        })
        counts = dateCounts
        datasetLabel = 'Custom Range'
      }
    }

    const isLine = chartType === 'line'
    return {
      labels,
      datasets: [{
        label: datasetLabel,
        data: counts,
        backgroundColor: isLine ? 'rgba(26, 86, 219, 0.12)' : 'rgba(26, 86, 219, 0.85)',
        borderColor: '#1a56db',
        borderWidth: isLine ? 2.5 : 0,
        borderRadius: isLine ? 0 : 6,
        hoverBackgroundColor: isLine ? undefined : '#2563eb',
        fill: isLine,
        tension: 0.38,
        pointRadius: isLine ? 3.5 : 0,
        pointHoverRadius: isLine ? 6 : 0,
        pointBackgroundColor: '#1a56db',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      }]
    }
  }, [distributions, chartMode, selectedYear, selectedMonth, startDate, endDate, chartType])

  const isDataEmpty = useMemo(() => {
    if (!barData.datasets || barData.datasets.length === 0) return true
    const data = barData.datasets[0].data || []
    return data.length === 0 || data.every(val => val === 0)
  }, [barData])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 11, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 8,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y} package${ctx.parsed.y !== 1 ? 's' : ''} distributed`,
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: '#94a3b8', font: { size: 10 } },
        grid: { color: '#f1f5f9' },
      },
      x: {
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { display: false },
      },
    },
  }), [])

  const cycleQRs = qrCodes.filter(q => q.cycle_id === activeCycle?.id)
  const claimed = cycleQRs.filter(q => q.is_claimed).length

  const pieData = activeCycle && cycleQRs.length > 0 ? {
    labels: ['Claimed', 'Unclaimed'],
    datasets: [{
      data: [claimed, cycleQRs.length - claimed],
      backgroundColor: ['#10b981', '#e2e8f0'],
      borderColor: ['#059669', '#cbd5e1'],
      borderWidth: 2,
    }]
  } : null

  const overviewData = distFilter === 'purok'
    ? puroks.map(p => {
        const hhsInPurok = households.filter(h => h.purok_id === p.id)
        const qrs = cycleQRs.filter(q => hhsInPurok.some(h => h.id === q.household_id))
        const c = qrs.filter(q => q.is_claimed).length
        return { name: p.name, total: qrs.length, claimed: c }
      })
    : sectors.map(s => {
        const qrs = cycleQRs.filter(q => q.cycle_type === s.code)
        const c = qrs.filter(q => q.is_claimed).length
        return { name: s.name, total: qrs.length, claimed: c }
      })

  const statCards = [
    { icon: 'fa-users',                bg: '#eff6ff', color: '#1a56db', val: households.length,        label: 'Households' },
    { icon: 'fa-boxes-stacked',        bg: '#f0fdf4', color: '#10b981', val: totalStock.toLocaleString('en-PH', { maximumFractionDigits: 0 }), label: 'Stock Items' },
    { icon: 'fa-truck',                bg: '#fff7ed', color: '#f59e0b', val: activeProgress,           label: activeCycle ? 'Active Cycle' : 'Today Dist.' },
    { icon: 'fa-triangle-exclamation', bg: '#fff1f2', color: '#ef4444', val: lowStock,                 label: 'Low Stock' },
  ]

  return (
    <div>
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map((s, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
            className="stat-card group cursor-default"
          >
            <div className="stat-icon group-hover:scale-110 transition-transform duration-300" style={{ background: s.bg, color: s.color }}>
              <i className={`fas ${s.icon}`} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-xl text-navy truncate group-hover:text-blue-700 transition-colors">{s.val}</div>
              <div className="text-[11px] text-slate-500 truncate">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="card p-4 lg:col-span-2">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-100 min-h-[40px]">
            <div className="flex items-center gap-2.5">
              <div className="font-display font-extrabold text-sm text-navy">
                Distributions
              </div>
              {/* Chart Type Toggle (Bar vs Line) */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`px-2 py-0.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                    chartType === 'bar'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Switch to Bar Chart"
                >
                  <i className="fas fa-chart-simple text-[11px]" />
                  <span className="hidden sm:inline">Bar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`px-2 py-0.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                    chartType === 'line'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Switch to Line Chart"
                >
                  <i className="fas fa-chart-line text-[11px]" />
                  <span className="hidden sm:inline">Line</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap flex-shrink-0 justify-end h-8">
              {chartMode === 'specific_year' && (
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="form-input h-8 !py-0 !px-2.5 text-xs font-semibold !w-auto bg-slate-50 border-slate-200 rounded-lg hover:bg-white hover:border-blue-400 hover:shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 cursor-pointer">
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}

              {chartMode === 'month' && (
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="form-input h-8 !py-0 !px-2.5 text-xs font-semibold !w-auto bg-slate-50 border-slate-200 rounded-lg hover:bg-white hover:border-blue-400 hover:shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 cursor-pointer">
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
              )}

              {chartMode === 'custom' && (
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-0 rounded-lg border border-slate-200 h-8">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="form-input h-7 !py-0 !px-1 text-xs font-semibold text-slate-800 !w-auto bg-transparent border-0 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-400">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="form-input h-7 !py-0 !px-1 text-xs font-semibold text-slate-800 !w-auto bg-transparent border-0 focus:ring-0 cursor-pointer"
                  />
                </div>
              )}

              <select
                value={chartMode}
                onChange={e => setChartMode(e.target.value)}
                className="form-input h-8 !py-0 !px-2.5 text-xs font-semibold !w-auto bg-slate-50 border-slate-200 rounded-lg hover:bg-white hover:border-blue-400 hover:shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 cursor-pointer">
                <option value="year">This Year</option>
                <option value="specific_year">Specific Year</option>
                <option value="month">Specific Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>

          <div className="relative" style={{ height: 220 }}>
            {chartType === 'bar' ? (
              <Bar data={barData} options={chartOptions} />
            ) : (
              <Line data={barData} options={chartOptions} />
            )}

            {isDataEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-xl pointer-events-none">
                <div className="text-center p-3 max-w-xs">
                  <i className="fas fa-chart-column text-2xl text-slate-300 mb-1.5 block" />
                  <div className="text-xs font-bold text-slate-600">No Distribution Records Yet</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Distributions recorded in operations will automatically plot here.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="card p-4 flex flex-col">
          <div className="font-display font-bold text-sm text-navy mb-3 truncate">
            {activeCycle ? activeCycle.name : 'No Active Cycle'}
          </div>
          {pieData ? (
            <div className="flex flex-col items-center gap-3">
              <div style={{ width: 160, height: 160 }}>
                <Pie data={pieData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 8 } } },
                }} />
              </div>
              <div className="text-xs text-slate-500 text-center">
                <span className="font-bold text-emerald-600">{claimed}</span> claimed of {' '}
                <span className="font-bold text-slate-700">{cycleQRs.length}</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm py-6">
              <i className="fas fa-rotate text-3xl mb-2 text-slate-300" />
              {activeCycle ? 'No QR codes generated yet' : 'No active cycle'}
            </div>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="font-display font-bold text-sm text-navy">Distribution Overview</div>
          <div className="flex gap-2">
            {['purok', 'sector'].map(f => (
              <button key={f} onClick={() => setDistFilter(f)}
                className={`btn btn-sm capitalize ${distFilter === f ? 'btn-primary' : 'btn-gray'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mobile-card-table">
          <table className="tbl w-full table-fixed">
            <thead>
              <tr>
                <th className="w-[28%]">{distFilter === 'purok' ? 'Purok' : 'Sector'}</th>
                <th className="w-[15%]">Total</th>
                <th className="w-[15%]">Claimed</th>
                <th className="w-[15%]">Remaining</th>
                <th className="w-[27%]">Progress</th>
              </tr>
            </thead>
            <tbody>
              {overviewData.filter(d => d.total > 0).length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="py-8 text-center text-slate-400 text-sm">
                    <i className="fas fa-chart-bar text-2xl mb-2 block text-slate-300" />
                    No active cycle data
                  </div>
                </td></tr>
              ) : overviewData.filter(d => d.total > 0).map((d, i) => {
                const pct = d.total > 0 ? Math.round((d.claimed / d.total) * 100) : 0
                return (
                  <tr key={i}>
                    <td data-label="Name"><strong className="text-navy">{d.name}</strong></td>
                    <td data-label="Total">{d.total}</td>
                    <td data-label="Claimed"><span className="text-emerald-600 font-bold">{d.claimed}</span></td>
                    <td data-label="Remaining"><span className="text-red-500 font-bold">{d.total - d.claimed}</span></td>
                    <td data-label="Progress">
                      <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[80px]">
                          <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
