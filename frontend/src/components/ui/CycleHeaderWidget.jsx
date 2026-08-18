import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';

export default function CycleHeaderWidget() {
  const { cycles, qrCodes } = useAppStore();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [focusedCycleId, setFocusedCycleId] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter active vs completed/ended cycles
  const getCycleStats = (c) => {
    const cQRs = (qrCodes || []).filter((q) => q.cycle_id === c.id);
    const totalQRs = cQRs.length;
    const claimedQRs = cQRs.filter((q) => q.is_claimed).length;
    const percent = totalQRs > 0 ? Math.round((claimedQRs / totalQRs) * 100) : 0;
    const isCompleted = totalQRs > 0 && claimedQRs === totalQRs;
    return { totalQRs, claimedQRs, percent, isCompleted };
  };

  const activeCycles = (cycles || []).filter((c) => {
    if (!c.is_active) return false;
    const { isCompleted } = getCycleStats(c);
    return !isCompleted;
  });

  const inactiveCycles = (cycles || []).filter((c) => {
    if (!c.is_active) return true;
    const { isCompleted } = getCycleStats(c);
    return isCompleted;
  });

  // Current cycle shown on topbar pill (only active cycles)
  const activeCycle =
    activeCycles.find((c) => String(c.id) === String(focusedCycleId)) ||
    activeCycles[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Sleek Header Pill Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`h-9 px-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all duration-200 shadow-xs ${
          activeCycle?.is_active
            ? 'bg-blue-50/90 hover:bg-blue-100 border-blue-200/80 text-blue-900'
            : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-700'
        }`}
        title="Current Distribution Cycle"
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            activeCycle?.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span className="font-display font-bold max-w-[90px] sm:max-w-[140px] md:max-w-[180px] truncate">
          {activeCycle ? activeCycle.name : 'No Active Cycle'}
        </span>
        {activeCycles.length > 1 && (
          <span className="px-1.5 py-0.2 rounded-full bg-blue-200/80 text-blue-800 font-extrabold text-[9px]">
            +{activeCycles.length - 1}
          </span>
        )}
        <i
          className={`fas fa-chevron-down text-[9px] transition-transform duration-200 ${
            open ? 'rotate-180 text-blue-600' : 'text-slate-400'
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 sm:w-84 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-rotate text-blue-600 text-xs" />
                <span className="font-display font-extrabold text-xs text-navy uppercase tracking-wider">
                  Distribution Cycles
                </span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                {activeCycles.length} Active
              </span>
            </div>

            <div className="p-3 max-h-96 overflow-y-auto space-y-3">
              {/* Active Distribution Cycles List */}
              {activeCycles.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider px-1">
                    Active Cycles ({activeCycles.length})
                  </div>
                  {activeCycles.map((cycle) => {
                    const { totalQRs, claimedQRs, percent } = getCycleStats(cycle);
                    const isFocused = String(activeCycle?.id) === String(cycle.id);

                    return (
                      <div
                        key={cycle.id}
                        onClick={() => {
                          setFocusedCycleId(cycle.id);
                          setOpen(false);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                          isFocused
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50/60 border-blue-300 shadow-xs ring-2 ring-blue-500/10'
                            : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-display font-bold text-xs text-navy truncate">
                              {cycle.name}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {cycle.type ? cycle.type.toUpperCase() : 'RELIEF'} ·{' '}
                              {cycle.puroks?.length || 0} Puroks
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        </div>

                        {/* Progress Bar */}
                        {totalQRs > 0 && (
                          <div className="pt-1">
                            <div className="flex justify-between text-[10px] font-semibold text-slate-600 mb-1">
                              <span>Claimed Progress</span>
                              <span className="text-blue-700 font-bold">
                                {claimedQRs} / {totalQRs} ({percent}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200/60">
                  <i className="fas fa-circle-pause text-slate-300 text-2xl mb-1.5 block" />
                  <div className="text-xs font-bold text-slate-600">No active cycle running</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Activate a distribution cycle in Settings.
                  </div>
                </div>
              )}

              {/* Inactive / Ended Cycles List */}
              {inactiveCycles.length > 0 && (
                <div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                    Ended / Previous Cycles ({inactiveCycles.length})
                  </div>
                  <div className="space-y-1.5">
                    {inactiveCycles.map((c) => {
                      const { totalQRs, claimedQRs, percent, isCompleted } = getCycleStats(c);
                      const badgeLabel = isCompleted ? 'Completed' : 'Ended';
                      const badgeStyle = isCompleted
                        ? 'bg-emerald-100 text-emerald-700 font-bold'
                        : 'bg-slate-200 text-slate-600 font-semibold';

                      return (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-xs border border-slate-100"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-semibold text-navy truncate">{c.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {c.type ? c.type.toUpperCase() : 'RELIEF'}
                              {totalQRs > 0
                                ? ` · ${claimedQRs}/${totalQRs} claimed (${percent}%)`
                                : c.created_at
                                ? ` · ${new Date(c.created_at).toLocaleDateString('en-PH')}`
                                : ''}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${badgeStyle}`}>
                            {badgeLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Link to Settings */}
            {user?.role === 'admin' && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate('/admin/settings?tab=cycles', { state: { tab: 'cycles' } });
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1.5 w-full py-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <i className="fas fa-gear text-blue-500 text-xs" />
                  <span>Manage Cycles in Settings</span>
                  <i className="fas fa-arrow-right text-[10px]" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
