import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
// Named import, not default: pino-http's CJS default is not callable once
// NodeNext resolves this file as ESM.
import { pinoHttp } from 'pino-http';
import { config } from './config/env.js';
import logger from './observability/logger.js';
import { buildApiRoutes } from './routes/index.js';
import authRoutes from './routes/auth.js';
import { requireAdminToken } from './middlewares/auth.js';
import { errorHandler } from './middlewares/error.js';
import type { McpRuntime } from './mcp/index.js';
import { ingestRoutes } from './mcp/routes/ingest.routes.js';
import { mcpMetricsRoutes } from './mcp/routes/metrics.routes.js';

export const createServer = (mcp?: McpRuntime): Application => {
    const app = express();

    // helmet defaults block iframe embedding via CSP/frame headers; this API
    // serves JSON only (Grafana is embedded directly from the frontend), so
    // the defaults are fine here.
    app.use(helmet());
    app.use(cors({ origin: config.corsOrigin, credentials: true }));

    // ---- The engine's ingest ----------------------------------------------
    //
    // Mounted BEFORE `express.json()` and BEFORE `requireAdminToken`. Both are
    // load-bearing, and neither is obvious enough to survive a tidy-up unstated:
    //
    //  1. `ingestRoutes` installs its OWN body parser at INGEST_BODY_LIMIT_BYTES,
    //     which is configurable upward from 2mb. If the app-wide parser below ran
    //     first it would drain the stream and set `req._body`, the route's parser
    //     would no-op, and the app-wide 2mb limit would silently win — a 413 to
    //     the engine on any deployment that raised the limit.
    //  2. The engine authenticates with INGEST_API_KEY, not an operator bearer.
    //     Behind `requireAdminToken` — the human's browser login — no engine
    //     could ever deliver a report.
    //
    // `compression()` below is not part of this: it touches responses only, and
    // an ingest response is two fields of JSON.
    if (mcp !== undefined) {
        app.use(
            '/ingest',
            ingestRoutes({
                service: mcp.container.services.ingest,
                apiKey: mcp.container.config.INGEST_API_KEY,
                bodyLimitBytes: mcp.container.config.INGEST_BODY_LIMIT_BYTES,
                logger,
            })
        );
    }

    app.use(compression());
    app.use(express.json({ limit: '2mb' }));
    app.use(
        pinoHttp({
            logger,
            // Tail SSE stream is long-lived; don't auto-log its completion.
            autoLogging: { ignore: req => req.url?.startsWith('/api/logs/tail') ?? false },
        })
    );

    app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    // This service's own Prometheus exposition. Off `requireAdminToken` on
    // purpose — a scraper has no login — and named `/mcp-metrics` so it cannot
    // be confused with the `/api/metrics/*` proxy that queries Prometheus.
    if (mcp !== undefined && config.mcp.metricsEnabled) {
        app.use('/mcp-metrics', mcpMetricsRoutes());
    }

    // Login is public — it's how a client obtains its bearer token. Mounted
    // before the gate so it isn't itself blocked by requireAdminToken.
    app.use('/api/auth', authRoutes);
    app.use('/api', requireAdminToken, buildApiRoutes(mcp));

    app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
    app.use(errorHandler);

    return app;
};
