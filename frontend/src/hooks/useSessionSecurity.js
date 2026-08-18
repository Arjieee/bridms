import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../api/client';

const BACKGROUND_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes background app-switch / screen lock threshold
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes (1 hour) idle inactivity timeout

export function useSessionSecurity() {
  const { token, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const hiddenTimeRef = useRef(null);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    // --- 1. INACTIVITY TIMEOUT LOGIC ---
    const handleLogoutInactivity = () => {
      clearUser();
      toast.error('Logged out due to 1 hour of inactivity.', { id: 'idle-logout' });
      navigate('/login', { replace: true });
    };

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(handleLogoutInactivity, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    // --- 2. MOBILE APP-SWITCH & SCREEN LOCK & SINGLE SESSION CHECK ---
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTimeRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const awayTime = hiddenTimeRef.current ? Date.now() - hiddenTimeRef.current : 0;
        hiddenTimeRef.current = null;

        if (awayTime >= BACKGROUND_TIMEOUT_MS) {
          clearUser();
          toast.error('Logged out for security due to prolonged inactivity (over 30 minutes).', { id: 'switch-logout' });
          navigate('/login', { replace: true });
          return;
        }

        // Revalidate active session with backend to immediately catch single-session conflicts
        apiFetch('/accounts/me').catch((err) => {
          if (err.message && (err.message.includes('another device') || err.message.includes('session'))) {
            clearUser();
            toast.error(err.message, { id: 'session-conflict' });
            navigate('/login', { replace: true });
          }
        });
      }
    };

    const handlePageHide = () => {
      hiddenTimeRef.current = Date.now();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [token, clearUser, navigate]);
}
