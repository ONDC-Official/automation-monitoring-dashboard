import 'dotenv/config';

/**
 * Centralised, typed config. Read once at boot. Mirrors the env conventions
 * of the monitored service (REDIS_* vars, etc.) so it points at the same infra.
 */

const num = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: num(process.env.PORT, 4000),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),

    adminToken: process.env.ADMIN_TOKEN || undefined,

    // Dashboard login credentials. Validated server-side by /api/auth/login so
    // they never ship in the browser bundle. On success the client is handed
    // `adminToken` as its bearer for subsequent /api calls.
    auth: {
        username: process.env.AUTH_USERNAME || undefined,
        password: process.env.AUTH_PASSWORD || undefined,
    },

    redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: num(process.env.REDIS_PORT, 6379),
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        db0: num(process.env.REDIS_DB_0, 0),
        db1: num(process.env.REDIS_DB_1, 1),
        scanPageSize: num(process.env.REDIS_SCAN_PAGE_SIZE, 200),
    },

    prometheusUrl: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
    lokiUrl: process.env.LOKI_URL ?? 'http://localhost:3100',
    grafanaUrl: process.env.GRAFANA_URL ?? 'http://localhost:3005',
    grafanaApiToken: process.env.GRAFANA_API_TOKEN || undefined,
    // Basic-auth fallback for Grafana's HTTP API (e.g. /api/search) when no
    // service-account token is set. Defaults to Grafana's admin/admin.
    grafanaUser: process.env.GRAFANA_USER || 'admin',
    grafanaPassword: process.env.GRAFANA_PASSWORD || 'admin',
    serviceHealthUrl:
        process.env.SERVICE_HEALTH_URL ||
        'http://localhost:3000/mock/playground/health',
} as const;

export type Config = typeof config;

/** Fail fast on clearly-misconfigured upstreams. */
export const validateEnv = (): void => {
    const required: Array<[string, string]> = [
        ['REDIS_HOST', config.redis.host],
        ['PROMETHEUS_URL', config.prometheusUrl],
        ['LOKI_URL', config.lokiUrl],
        ['GRAFANA_URL', config.grafanaUrl],
    ];
    const missing = required.filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`
        );
    }
};
