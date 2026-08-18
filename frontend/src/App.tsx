import { lazy, Suspense } from "react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { ReportThreat } from "./pages/ReportThreat";
import { ThreatFeedDetail } from "./pages/ThreatFeedDetail";
import { CampaignDetail } from "./pages/CampaignDetail";
import { ZeroTrustSim } from "./pages/ZeroTrustSim";
import { Policies } from "./pages/Policies";
import { AuditTrail } from "./pages/AuditTrail";

const ThreatGlobe = lazy(() => import("./pages/ThreatGlobe"));
const Analytics = lazy(() => import("./pages/Analytics"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/report" element={<ReportThreat />} />
        <Route path="/reports/:id" element={<ThreatFeedDetail />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/zero-trust" element={<ZeroTrustSim />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/audit" element={<AuditTrail />} />
        <Route
          path="/globe"
          element={
            <Suspense fallback={<p className="text-slate-500 text-sm">Loading globe…</p>}>
              <ThreatGlobe />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<p className="text-slate-500 text-sm">Loading analytics…</p>}>
              <Analytics />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
