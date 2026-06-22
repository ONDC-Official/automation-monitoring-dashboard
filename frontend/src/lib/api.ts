// Typed client for the monitoring backend. All calls go through the Vite
// dev proxy (`/api` -> http://localhost:4000).

export type BusinessType =
    | 'MOCK_DATA'
    | 'FLOW_STATUS'
    | 'EXTRA_FLOW_STATUS'
    | 'PLAYGROUND'
    | 'TRANSACTION'
    | 'SUBSCRIBER'
    | 'SESSION'
    | 'RUNNER_CONFIG'
    | 'UNKNOWN';

export interface HealthResponse {
    status: 'ok' | 'degraded';
    deps: {
        redisDb0: boolean;
        redisDb1: boolean;
        prometheus: boolean;
        loki: boolean;
        grafana: boolean;
        monitoredService: boolean;
    };
}

export interface DbsResponse {
    businessTypes: BusinessType[];
    dbs: Array<{ db: number; dbsize: number; label: string }>;
}

export interface ScanResult {
    db: number;
    cursor: string;
    keys: Array<{
        key: string;
        businessType: BusinessType;
        ttl: number;
        type: string;
    }>;
}

export interface InspectResult {
    key: string;
    db: number;
    businessType: BusinessType;
    parts: Record<string, string>;
    type: string;
    ttl: number;
    sizeBytes: number;
    raw: unknown;
    decoded: unknown | null;
    validation: { ok: boolean; errors: string[] };
}

export interface DashboardRef {
    uid: string;
    title: string;
    url: string;
    folderTitle?: string;
    tags: string[];
}

export interface PromResponse {
    status: string;
    data: {
        resultType: string;
        result: Array<{
            metric: Record<string, string>;
            value?: [number, string];
            values?: Array<[number, string]>;
        }>;
    };
}

export interface LokiResponse {
    status: string;
    data: {
        resultType: string;
        result: Array<{
            stream: Record<string, string>;
            values: Array<[string, string]>;
        }>;
    };
}

class ApiError extends Error {
    status: number;
    body?: unknown;
    constructor(status: number, message: string, body?: unknown) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

async function request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path, window.location.origin);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
        }
    }
    const res = await fetch(url.toString().replace(window.location.origin, ''));
    if (!res.ok) {
        let body: unknown;
        try {
            body = await res.json();
        } catch {
            body = await res.text();
        }
        throw new ApiError(res.status, `${res.status} ${res.statusText}`, body);
    }
    return res.json() as Promise<T>;
}

export const api = {
    health: () => request<HealthResponse>('/api/health'),

    // ---- Redis ----
    redisDbs: () => request<DbsResponse>('/api/redis/dbs'),
    redisScan: (p: { db: number; match?: string; cursor?: string; count?: number }) =>
        request<ScanResult>('/api/redis/scan', p),
    redisInspect: (db: number, key: string) =>
        request<InspectResult>('/api/redis/inspect', { db, key }),

    // ---- Metrics (Prometheus) ----
    promQuery: (query: string, time?: string) =>
        request<PromResponse>('/api/metrics/query', { query, time }),
    promRange: (p: { query: string; start: string; end: string; step: string }) =>
        request<PromResponse>('/api/metrics/query_range', p),
    promTargets: () => request<unknown>('/api/metrics/targets'),
    promRules: () => request<unknown>('/api/metrics/rules'),

    // ---- Logs (Loki) ----
    logsQuery: (p: { query: string; start?: string; end?: string; limit?: number; direction?: string }) =>
        request<LokiResponse>('/api/logs/query_range', p),
    logsLabels: () => request<{ data: string[] }>('/api/logs/labels'),
    logsLabelValues: (label: string) =>
        request<{ data: string[] }>(`/api/logs/label/${encodeURIComponent(label)}/values`),
    /** URL for an EventSource live tail. */
    logsTailUrl: (query: string) => `/api/logs/tail?query=${encodeURIComponent(query)}`,

    // ---- Grafana ----
    grafanaDashboards: () => request<{ dashboards: DashboardRef[] }>('/api/grafana/dashboards'),
    grafanaEmbedUrl: (uid: string, p?: { from?: string; to?: string; theme?: string }) =>
        request<{ url: string }>(`/api/grafana/embed/${encodeURIComponent(uid)}`, p),
};

export { ApiError };
