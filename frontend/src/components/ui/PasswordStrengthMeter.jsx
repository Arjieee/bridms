export function checkStrength(pw) {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[!@#$%^&*()_+\-=\[\]{};:'"\\|,.<>\/?]/.test(pw),
  }
  const score = Object.values(checks).filter(Boolean).length
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#e2e8f0', '#dc2626', '#f97316', '#f59e0b', '#3b82f6', '#10b981']
  return { score, checks, label: labels[score] || '', color: colors[score] || '#e2e8f0' }
}

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null
  const { score, checks, label, color } = checkStrength(password)
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1.5">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
            style={{ background: i <= score ? color : '#e2e8f0' }} />
        ))}
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-[11px] text-slate-500">Password strength</span>
        <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {[
          ['length', '8+ characters'],
          ['upper', 'Uppercase letter'],
          ['lower', 'Lowercase letter'],
          ['number', 'Number'],
          ['special', 'Special char'],
        ].map(([k, l]) => (
          <div key={k} className="flex items-center gap-1.5"
            style={{ fontSize: 11, color: checks[k] ? '#10b981' : '#94a3b8' }}>
            <i className={`fas ${checks[k] ? 'fa-circle-check' : 'fa-circle'}`} style={{ fontSize: 9 }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}
