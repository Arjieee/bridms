import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

export default function LogoutConfirm({ onCancel, onConfirm }) {
  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="modal-box max-w-sm">
        <div className="modal-header">
          <h3 className="font-display font-bold text-base text-navy">
            <i className="fas fa-right-from-bracket text-red-500 mr-2" />Confirm Logout
          </h3>
          <button onClick={onCancel} className="btn btn-gray btn-xs">
            <i className="fas fa-xmark" />
          </button>
        </div>
        <div className="modal-body">
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <i className="fas fa-triangle-exclamation text-red-500 text-xl" />
            </div>
            <div className="font-display font-bold text-navy text-base mb-1">Are you sure you want to log out?</div>
            <div className="text-sm text-slate-500">You'll need to sign in again to access your account.</div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn btn-gray">
            <i className="fas fa-xmark" /> Cancel
          </button>
          <button onClick={onConfirm} className="btn btn-danger">
            <i className="fas fa-right-from-bracket" /> Yes, Log Out
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
