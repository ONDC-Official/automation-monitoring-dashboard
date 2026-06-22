import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/login";
import OverviewPage from "@/pages/overview";
import Redis from "@/pages/redis";
import LogsPage from "@/pages/logs";
import MetricsPage from "@/pages/metrics";
import Grafana from "@/pages/grafana";

const ProtectedLayout = () => {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/redis" element={<Redis />} />
      <Route path="/logs" element={<LogsPage />} />
      <Route path="/metrics" element={<MetricsPage />} />
      <Route path="/grafana" element={<Grafana />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
