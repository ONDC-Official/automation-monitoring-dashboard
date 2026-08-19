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
import McpOverview from "@/pages/mcp/overview";
import McpIncidents from "@/pages/mcp/incidents";
import McpSessions from "@/pages/mcp/sessions";
import McpJournal from "@/pages/mcp/journal";

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

/**
 * The MCP pages route their detail views by URL rather than local state, so a
 * fingerprint or session ref is shareable and survives a reload. Each one is
 * the same page component with an optional param.
 */
const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/redis" element={<Redis />} />
      <Route path="/logs" element={<LogsPage />} />
      <Route path="/metrics" element={<MetricsPage />} />
      <Route path="/grafana" element={<Grafana />} />

      <Route path="/mcp" element={<McpOverview />} />
      <Route path="/mcp/incidents" element={<McpIncidents />} />
      <Route path="/mcp/incidents/:fingerprint" element={<McpIncidents />} />
      <Route path="/mcp/sessions" element={<McpSessions />} />
      <Route path="/mcp/sessions/:sessionRef" element={<McpSessions />} />
      <Route path="/mcp/journal" element={<McpJournal />} />
      <Route path="/mcp/journal/:sessionRef" element={<McpJournal />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
