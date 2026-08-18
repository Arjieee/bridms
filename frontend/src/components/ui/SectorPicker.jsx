const SECTORS = [
  { code: 'pwd',         label: 'PWD',            icon: 'fa-wheelchair',     color: '#1a56db' },
  { code: 'senior',      label: 'Senior Citizen', icon: 'fa-person-cane',    color: '#f59e0b' },
  { code: 'osy',         label: 'OSY',            icon: 'fa-graduation-cap', color: '#7c3aed' },
  { code: 'solo_parent', label: 'Solo Parent',    icon: 'fa-person',         color: '#ec4899' },
  { code: 'teenage_mom', label: 'Teenage Mom',    icon: 'fa-baby',           color: '#ef4444' },
]

export default function SectorPicker({ selected = [], onChange }) {
  const toggle = (code) =>
    onChange(selected.includes(code) ? selected.filter(s => s !== code) : [...selected, code])
  return (
    <div className="flex flex-wrap gap-2">
      {SECTORS.map(s => (
        <button
          key={s.code}
          type="button"
          onClick={() => toggle(s.code)}
          className={`sector-chip ${selected.includes(s.code) ? 'selected' : ''}`}
          style={selected.includes(s.code) ? {
            borderColor: s.color,
            background: `${s.color}15`,
            color: s.color,
          } : {}}>
          <i className={`fas ${s.icon} text-[11px]`} />
          {s.label}
        </button>
      ))}
    </div>
  )
}

export { SECTORS }
