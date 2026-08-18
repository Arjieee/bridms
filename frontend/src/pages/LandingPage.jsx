import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

function Counter({ target, suffix = '' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      let c = 0
      const step = Math.max(1, Math.ceil(target / 60))
      const t = setInterval(() => {
        c += step
        if (c >= target) { setCount(target); clearInterval(t) }
        else setCount(c)
      }, 25)
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

const features = [
  { icon: 'fa-boxes-stacked', title: 'Inventory Monitoring', desc: 'Track relief goods in real-time with smart calculators and low-stock alerts.', color: '#10b981' },
  { icon: 'fa-users',         title: 'Household Management', desc: 'Register households with complete member profiles and sector affiliations.', color: '#3b82f6' },
  { icon: 'fa-qrcode',        title: 'QR Code Verification', desc: 'Scan household QR codes instantly — claims are recorded automatically.', color: '#8b5cf6' },
  { icon: 'fa-truck',         title: 'Distribution Tracking', desc: 'Manage sector-based relief distributions with standardized packages.', color: '#f59e0b' },
  { icon: 'fa-handshake',     title: 'Suppliers & Donors', desc: 'Track donations and receive reminders to update inventory accordingly.', color: '#ec4899' },
  { icon: 'fa-chart-pie',     title: 'Reports & Analytics', desc: 'Transparent per-purok and per-sector charts with print support.', color: '#06b6d4' },
]

const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className="font-body">
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-4 flex items-center justify-between transition-all duration-300 ${scrolled ? 'bg-navy/95 backdrop-blur-md border-b border-white/10' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md border border-white/20">
            <img src="/logo.png" alt="Barangay Puerto Seal" className="w-full h-full object-cover rounded-full" />
          </div>
          <div>
            <div className="font-display font-bold text-sm text-white leading-tight">Barangay Puerto</div>
            <div className="text-[10px] text-white/45">CDO, Misamis Oriental 9000</div>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button onClick={() => navigate('/login')} className="btn btn-outline border-white/30 text-white hover:bg-white/10 text-sm sm:px-5">
            <i className="fas fa-right-to-bracket" />
            <span className="hidden sm:inline">Login</span>
          </button>
          <button onClick={() => navigate('/register')} className="btn bg-amber-400 text-navy hover:bg-amber-300 text-sm sm:px-5 font-bold">
            <i className="fas fa-user-plus" />
            <span className="hidden sm:inline">Register</span>
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="gradient-mesh min-h-screen relative overflow-hidden flex flex-col justify-center">
        {[
          { s: 120, t: '10%', l: '5%', d: '0s' },
          { s: 80,  t: '65%', l: '3%', d: '1.5s' },
          { s: 160, t: '20%', r: '4%', d: '0.8s' },
          { s: 60,  t: '75%', r: '10%', d: '2s' },
        ].map((p, i) => (
          <div key={i} className="hero-float absolute rounded-full hidden sm:block"
            style={{
              width: p.s, height: p.s,
              top: p.t, left: p.l, right: p.r,
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.08)',
              animationDelay: p.d,
            }} />
        ))}

        <motion.div
          initial="hidden" animate="show" variants={stagger}
          className="relative z-10 max-w-3xl mx-auto px-6 sm:px-8 text-center pt-24 pb-20">
          <motion.div variants={fadeUp}
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-amber-400/30 bg-amber-400/10">
            <i className="fas fa-star text-amber-400 text-xs" />
            <span className="text-white/85 text-xs font-semibold font-display">Official Barangay Digital System</span>
          </motion.div>

          <motion.h1 variants={fadeUp}
            className="font-display font-extrabold text-white leading-tight mb-5"
            style={{ fontSize: 'clamp(28px, 5vw, 54px)' }}>
            Relief Inventory &<br />
            <span className="text-amber-400">Distribution</span> Monitoring
          </motion.h1>

          <motion.p variants={fadeUp} className="text-white/65 text-base leading-relaxed mb-10 max-w-xl mx-auto">
            A modern digital platform empowering <strong className="text-white/90">Barangay Puerto</strong> to manage relief goods,
            verify beneficiaries by sector, and ensure every household receives fair assistance during emergencies.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <button onClick={() => navigate('/register')}
              className="btn bg-amber-400 text-navy hover:bg-amber-300 font-bold px-6 py-3 text-base w-full sm:w-auto">
              <i className="fas fa-user-plus" /> Register Household
            </button>
            <button onClick={() => navigate('/login')}
              className="btn border-2 border-white/30 text-white hover:bg-white/10 px-6 py-3 text-base w-full sm:w-auto">
              <i className="fas fa-right-to-bracket" /> Sign In
            </button>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 text-white/50 text-sm">
            <span>Scroll to explore</span>
            <i className="fas fa-chevron-down hero-float text-xs" />
          </motion.div>
        </motion.div>
      </section>

      {/* STATS */}
      <section className="bg-navy py-14 px-6 sm:px-8">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-8 sm:gap-12 text-center">
          {[
            { val: 500, suffix: '+', label: 'Beneficiaries Capacity' },
            { val: 5,   suffix: '+', label: 'Puroks Covered' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}>
              <div className="font-display font-extrabold text-amber-400" style={{ fontSize: 'clamp(36px, 6vw, 56px)', lineHeight: 1 }}>
                <Counter target={s.val} suffix={s.suffix} />
              </div>
              <div className="text-white/55 text-sm mt-2">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-16 sm:py-20 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display font-extrabold text-2xl sm:text-3xl text-navy mb-3">
              Everything You Need
            </motion.h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              A complete suite of tools built for barangay-level disaster response and relief management.
            </p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeUp}
                className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-4"
                  style={{ background: f.color + '15', color: f.color }}>
                  <i className={`fas ${f.icon}`} />
                </div>
                <div className="font-display font-bold text-navy text-base mb-2">{f.title}</div>
                <div className="text-slate-500 text-sm leading-relaxed">{f.desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-16 px-6 sm:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white mb-3">
            Ready to Get Started?
          </h2>
          <p className="text-white/65 text-sm mb-6 max-w-md mx-auto">
            Register your household to receive notifications about distribution cycles and access your relief QR codes.
          </p>
          <button onClick={() => navigate('/register')}
            className="btn bg-amber-400 text-navy hover:bg-amber-300 font-bold px-6 py-3 text-base">
            <i className="fas fa-user-plus" /> Register Now
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white/60 py-8 px-6 sm:px-8 text-center text-xs">
        <div className="max-w-3xl mx-auto">
          <div className="font-display font-bold text-white text-sm mb-2">Barangay Puerto Relief Management System</div>
          <div className="mb-2">Cagayan de Oro City, Misamis Oriental 9000</div>
          <div className="text-white/40">© 2026 Barangay Puerto. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
