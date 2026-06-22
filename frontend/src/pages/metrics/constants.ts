export const PANELS = [
  {
    title: "HTTP request rate",
    description: "sum by (status) (rate(http_requests_total[5m]))",
    query: "sum by (status) (rate(http_requests_total[5m]))",
  },
  {
    title: "HTTP p95 latency (s)",
    description:
      "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
    query:
      "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
  },
  {
    title: "Cache ops rate by result",
    description: "sum by (result) (rate(cache_operations_total[5m]))",
    query: "sum by (result) (rate(cache_operations_total[5m]))",
  },
  {
    title: "Redis health by db",
    description: "redis_health_status",
    query: "redis_health_status",
  },
];
