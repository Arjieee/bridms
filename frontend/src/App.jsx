import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import { apiFetch } from "./api/client";
import { useGlobalEscape } from "./components/ui/useGlobalEscape";
import { useSessionSecurity } from "./hooks/useSessionSecurity";
import InitialLoadingScreen from "./components/ui/InitialLoadingScreen";
import ErrorBoundary from "./components/ui/ErrorBoundary";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import PublicQRVerify from "./pages/PublicQRVerify";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminInventory from "./pages/admin/Inventory";
import AdminBeneficiaries from "./pages/admin/Beneficiaries";
import AdminQR from "./pages/admin/QRVerification";
import AdminDist from "./pages/admin/Distribution";
import AdminSuppliers from "./pages/admin/Suppliers";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";

import StaffLayout from "./pages/staff/StaffLayout";

import BeneficiaryLayout from "./pages/beneficiary/BeneficiaryLayout";
import BeneficiaryDashboard from "./pages/beneficiary/Dashboard";
import BeneficiaryHistory from "./pages/beneficiary/History";
import BeneficiaryCommunity from "./pages/beneficiary/CommunityBoard";

function Guard({ children, role }) {
  const { user, token, setUser, clearUser } = useAuthStore();
  const [verifying, setVerifying] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkBackendSession() {
      if (!token) {
        clearUser();
        if (isMounted) {
          setAuthorized(false);
          setVerifying(false);
        }
        return;
      }

      try {
        const data = await apiFetch('/accounts/me');
        if (isMounted) {
          if (data && data.user) {
            setUser(data.user);
            setAuthorized(true);
          } else {
            clearUser();
            toast.error('Session invalid. Please log in again.');
            setAuthorized(false);
          }
          setVerifying(false);
        }
      } catch (err) {
        if (isMounted) {
          clearUser();
          toast.error(err.message || 'Backend server is offline. Access denied.');
          setAuthorized(false);
          setVerifying(false);
        }
      }
    }

    checkBackendSession();
    return () => {
      isMounted = false;
    };
  }, [token]);

  if (verifying) {
    return <InitialLoadingScreen message="Connecting to Barangay Puerto API..." />;
  }

  if (!authorized || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "staff") return <Navigate to="/staff" replace />;
    return <Navigate to="/beneficiary" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, token } = useAuthStore();
  if (user && token) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "staff") return <Navigate to="/staff" replace />;
    return <Navigate to="/beneficiary" replace />;
  }
  return children;
}

// Scroll-to-top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export default function App() {
  useGlobalEscape();
  useSessionSecurity();
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 13,
            borderRadius: 12,
            padding: "10px 16px",
          },
          success: { style: { background: "#065f46", color: "#fff" } },
          error: { style: { background: "#7f1d1d", color: "#fff" } },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-qr" element={<PublicQRVerify />} />
        <Route path="/verify" element={<PublicQRVerify />} />


        <Route
          path="/admin"
          element={
            <Guard role="admin">
              <AdminLayout />
            </Guard>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="beneficiaries" element={<AdminBeneficiaries />} />
          <Route path="qr" element={<AdminQR />} />
          <Route path="distribution" element={<AdminDist />} />
          <Route path="suppliers" element={<AdminSuppliers />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route
          path="/staff"
          element={
            <Guard role="staff">
              <StaffLayout />
            </Guard>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="beneficiaries" element={<AdminBeneficiaries />} />
          <Route path="qr" element={<AdminQR />} />
          <Route path="distribution" element={<AdminDist />} />
          <Route path="suppliers" element={<AdminSuppliers />} />
          <Route path="reports" element={<AdminReports />} />
        </Route>

        <Route
          path="/beneficiary"
          element={
            <Guard role="beneficiary">
              <BeneficiaryLayout />
            </Guard>
          }
        >
          <Route index element={<BeneficiaryDashboard />} />
          <Route path="history" element={<BeneficiaryHistory />} />
          <Route path="community" element={<BeneficiaryCommunity />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
