import { useEffect } from 'react'

/**
 * Global Escape key listener: closes the topmost modal.
 * Add to the root App component to enable ESC-to-close on all modals.
 */
export function useGlobalEscape() {
  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') {
        // Find topmost modal overlay and click its close button
        const overlays = document.querySelectorAll('.modal-overlay')
        const topMost = overlays[overlays.length - 1]
        if (topMost) {
          // Trigger close by clicking the X button if present
          const closeBtn = topMost.querySelector('.btn-gray.btn-xs, button[aria-label="Close"]')
          if (closeBtn) closeBtn.click()
        }
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])
}
