import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { OverviewPage } from '@/pages/OverviewPage';
import { RedisExplorerPage } from '@/pages/RedisExplorerPage';
import { LogsPage } from '@/pages/LogsPage';
import { MetricsPage } from '@/pages/MetricsPage';
import { GrafanaPage } from '@/pages/GrafanaPage';

export default function App() {
    return (
        <AppShell>
            <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/redis" element={<RedisExplorerPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/metrics" element={<MetricsPage />} />
                <Route path="/grafana" element={<GrafanaPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AppShell>
    );
}
