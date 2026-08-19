import 'dotenv/config';

/**
 * Centralised, typed config. Read once at boot. Mirrors the env conventions
 * of the monitored service (REDIS_* vars, etc.) so it points at the same infra.
 */

const num = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

/** Truthy `1|true|yes`, falsy `0|false|no|""`, otherwise the fallback. */
const bool = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined) return fallback;
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes'].includes(v)) return true;
    if (['0', 'false', 'no', ''].includes(v)) return false;
    return fallback;
};

export const config = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    // 4090, matching .env.example, the Dockerfile's EXPOSE and the frontend's
    // Vite proxy target. The old 4000 default agreed with none of them.
    port: num(process.env.PORT, 4090),
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

    /**
     * The MCP section — the corpus, triage loop and MCP server for
     * `automation-mcp` (the mock-NP engine).
     *
     * `mongoUrl` unset is the section's ONLY off switch. Unset, the backend
     * still boots and everything above keeps working; the MCP surface answers
     * 503 and the frontend hides its nav. That is deliberate: this dashboard's
     * first subject is the playground service, and an operator who only
     * watches that one must not be made to run a MongoDB.
     */
    mcp: {
        mongoUrl: process.env.MONGO_URL || undefined,
        mongoDb: process.env.MONGO_DB || 'automation_mcp_dashboard',
        // Journal lines are the bulky, least individually valuable documents,
        // and the only thing here with a TTL.
        telemetryRetentionDays: num(process.env.TELEMETRY_RETENTION_DAYS, 30),

        // Shared secret the engine presents on /ingest/*. Set the SAME value as
        // FEEDBACK_API_KEY / MIRROR_API_KEY on the engine.
        ingestApiKey: process.env.INGEST_API_KEY || undefined,
        ingestBodyLimitBytes: num(process.env.INGEST_BODY_LIMIT_BYTES, 2_000_000),

        metricsToken: process.env.METRICS_TOKEN || undefined,
        // Default OFF, unlike the repo this came from. This dashboard has
        // never exposed its own /mcp-metrics, so `false` is the
        // behaviour-preserving default — and it keeps the production
        // "METRICS_ENABLED needs METRICS_TOKEN" refinement below from
        // refusing the first deploy that sets MONGO_URL.
        metricsEnabled: bool(process.env.METRICS_ENABLED, false),
    },
} as const;

/** True when the MCP section is configured. See `config.mcp` above. */
export const mcpEnabled = (): boolean => config.mcp.mongoUrl !== undefined;

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

    // ---- MCP section. All skipped entirely when MONGO_URL is unset. --------
    if (!mcpEnabled()) return;

    const { mcp } = config;

    // The ingest is a public write surface into the corpus that decides what
    // gets fixed. Refusing to boot is the only way to be sure it is not open.
    if (config.nodeEnv === 'production' && !mcp.ingestApiKey) {
        throw new Error(
            'INGEST_API_KEY is required when NODE_ENV=production — the ingest is a public write surface'
        );
    }

    if (
        config.nodeEnv === 'production' &&
        mcp.metricsEnabled &&
        !mcp.metricsToken
    ) {
        throw new Error(
            'METRICS_ENABLED with no METRICS_TOKEN is refused when NODE_ENV=production'
        );
    }
};
