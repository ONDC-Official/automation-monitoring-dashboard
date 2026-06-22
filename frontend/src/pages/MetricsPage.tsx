import { PageHeader } from '@/components/PageHeader';
import { PromChart } from '@/components/PromChart';

// Native Recharts panels built from the service's Prometheus metrics
// (see automation-mock-playground-service/src/observability/metrics.ts).
// Richer/heavier panels are embedded from Grafana on the Grafana page.
const PANELS = [
    {
        title: 'HTTP request rate',
        description: 'sum by (status) (rate(http_requests_total[5m]))',
        query: 'sum by (status) (rate(http_requests_total[5m]))',
    },
    {
        title: 'HTTP p95 latency (s)',
        description:
            'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))',
        query: 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))',
    },
    {
        title: 'Cache ops rate by result',
        description: 'sum by (result) (rate(cache_operations_total[5m]))',
        query: 'sum by (result) (rate(cache_operations_total[5m]))',
    },
    {
        title: 'Redis health by db',
        description: 'redis_health_status',
        query: 'redis_health_status',
    },
];

export function MetricsPage() {
    return (
        <div className="space-y-4">
            <PageHeader
                title="Metrics"
                description="Native charts from the Prometheus query API. Edit the queries in src/pages/MetricsPage.tsx."
            />
            <div className="grid gap-4 lg:grid-cols-2">
                {PANELS.map(p => (
                    <PromChart key={p.title} {...p} />
                ))}
            </div>
        </div>
    );
}
